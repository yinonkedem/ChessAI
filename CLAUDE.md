# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChessAI is a full-stack web chess application with three independent parts:
- **frontend/** — React 19 app (CRA + TypeScript-config, JS source) deployed on Vercel
- **backend/** — FastAPI Python app deployed on Render, backed by **MongoDB Atlas** (free M0 cluster)
- **AlphaZero/** — Standalone ML module for training chess agents (not integrated into the web app)

Live site: https://yinon-chess-ai.vercel.app/

---

## Commands

### Frontend

```bash
cd frontend
npm start          # Dev server at localhost:3000
npm run build      # Production build
npm test           # Run tests
npm run lint       # ESLint check
```

Local dev expects `frontend/.env.development.local` with:
```
REACT_APP_API_HOST=http://127.0.0.1:8000
```

### Backend

Run from inside `backend/` (the `app/` package isn't reachable from the repo root):

```powershell
cd backend
.\venv\Scripts\Activate.ps1                       # Windows; or `source venv/bin/activate` on *nix
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Stockfish path resolution lives in `backend/app/engines/stockfish.py` and looks, in order:

1. `$STOCKFISH_BIN`
2. `which stockfish`
3. `backend/bin/stockfish.exe` or `backend/bin/stockfish` (bundled binary, auto-detected)
4. `/usr/games/stockfish` (Render Dockerfile install path)
5. Otherwise raises a `FileNotFoundError` listing the candidates it tried.

Most local dev needs no env var because step 3 finds the bundled `backend/bin/stockfish.exe`.

Or with Docker Compose (FastAPI only — MongoDB lives in Atlas, not in the compose file):

```bash
cd backend
docker-compose up --build
```

**Database:** MongoDB (Beanie ODM on top of Motor). Connect via `MONGODB_URI` in `backend/.env`. No migrations — Beanie creates indexes on app startup via `init_beanie()` in `app/db.py`. The two collections (`users`, `games`) are created on first insert.

To bootstrap a local dev DB: create a free MongoDB Atlas M0 cluster, allow your IP, copy the SRV connection string into `backend/.env` as `MONGODB_URI=mongodb+srv://...`. The app reads `.env` automatically (via `python-dotenv` in `app/settings.py`).

### AlphaZero

```bash
cd AlphaZero
pip install -r requirements.txt
python main.py     # Train from scratch
# Pretrained models are in AlphaZero/Models/
```

---

## Architecture

### Backend (FastAPI)

**Entry point:** `backend/app/main.py` — mounts the auth and engine routers, configures CORS for localhost:3000, 127.0.0.1:3000, the LAN dev IP, and the Vercel deployment. Exposes a single `GET /health` endpoint. Demo/load-test endpoints (`/fail`, `/slow`, `/random`, `/load`, `/logs`) were removed during the audit.

**Routers:**
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` — JWT-based auth (`backend/app/auth/router.py`). JWT subject is the user's Mongo `_id` as a string (not the username), so a future username change wouldn't invalidate tokens.
- `POST /auth/change-password` — `{current_password, new_password}`, requires auth. 403 if the current password is wrong, 400 if the new one is identical, 422 if it's outside 8–72 characters. Returns 204. **Existing tokens stay valid** — the JWT subject is the user id and there's no token blocklist, so changing a password does not sign other sessions out.
- `DELETE /auth/me` — `{password}`, requires auth. Hard-deletes the user **and all their games** (games first, so a partial failure can't orphan rows). 403 on a wrong password, 204 on success. The username and email become reusable immediately — this is the supported "reset my password" path for a user who can still log in but wants to start over.

**Password rules:** 8–72 characters, enforced by the shared `Password` annotated type in `auth/router.py` and applied to signup and change-password alike. The 72-byte ceiling is bcrypt's — it silently ignores anything beyond it, so a longer password would overstate its own strength.

**Admin password reset:** `backend/tools/set_password.py` — the escape hatch for a genuinely forgotten password, since there is no email flow. Talks straight to Mongo via `backend/.env`, so it needs no running server. `./venv/bin/python tools/set_password.py --list` to see users, `... tools/set_password.py <username>` to set one. Reads the password from a hidden prompt (never an argument, so it stays out of shell history) and enforces the same 8–72 rule.
- `POST /engine/best-move` — Chess engine query (`backend/app/routers/engine.py`)
  - Body: `{"fen": "...", "depth": 1-30}`
  - Query param: `?engine=stockfish` (default) or `?engine=random`
  - Returns: `{"best_move": "e2e4", "info": {...}}`
- `GET /training/cards`, `GET /training/due`, `POST /training/review`, `GET /training/progress`,
  `GET /training/stats`, `DELETE /training/repertoire/{id}` — opening-trainer spaced repetition
  (`backend/app/routers/training.py`). All require `Bearer` auth. `POST /training/review` takes a
  **batch** and is deliberately three round trips regardless of size (one read, one
  `bulk_write` upsert, one user update); the per-review `find_one`+`save` loop it replaced took
  seconds against Atlas. Replaying a batch is idempotent — the unique
  `(user_id, repertoire_id, path)` index plus the not-yet-due skip make it a no-op.
- `POST /games`, `GET /games`, `GET /games/{id}` — Persisted game history per user (`backend/app/routers/games.py`). All require `Bearer` auth. `POST /games` atomically `$inc`s the user's `stats` sub-document (games_played + wins/losses/draws by `result`).

**Engine registry:** `backend/app/engines/__init__.py` — maps engine name strings to callable functions. Adding a new engine: implement the function and add it to `ENGINE_REGISTRY`.

**Database:** MongoDB (Beanie ODM + Motor async driver). Documents in `backend/app/models.py`:
- `User` (collection `users`) — `username` (unique), `email` (unique), `password_hash`, `disabled`, `created_at`, `stats: UserStats` (embedded sub-doc with `games_played`, `wins`, `losses`, `draws`).
- `Game` (collection `games`) — `user_id` (ObjectId), `user_color` (`w`/`b`), `opponent_type` (`ai`/`rand`/`human`), `result` (`win`/`loss`/`draw` from the user's perspective), `reason`, `moves` (SAN list), `final_fen`, `created_at`.

`init_db()` in `backend/app/db.py` creates the `AsyncIOMotorClient` and registers documents with Beanie. Wired into FastAPI via a `lifespan` handler in `app/main.py`.

**Stockfish:** Lazy singleton via `@lru_cache`. See path resolution above.

**Config (`backend/app/settings.py`):**
- `MONGODB_URI` — required. In dev, settings raise a helpful "set MONGODB_URI in .env" error if missing. In production (`ENV=production`), raises `RuntimeError`.
- `MONGODB_DB_NAME` — defaults to `"chessai"`.
- `JWT_SECRET_KEY` (preferred) — falls back to legacy `SECRET_KEY` env var. If neither is set and `ENV=production`, the app raises on startup. In dev a fixed insecure key is used.
- `ACCESS_TOKEN_EXPIRE_MINUTES` (defaults to 30).
- `CORS_ORIGINS` — comma-separated env var, parsed to a list. Default for dev: `http://localhost:3000,http://127.0.0.1:3000`. The hardcoded LAN IP and stray `"*"` are gone — set your LAN IP via `.env` if you need it.
- `.env` is auto-loaded by `python-dotenv` from `backend/.env`; no need for `--env-file`.

### Frontend (React 19)

**Entry & routing:** `index.js` mounts `<App/>` via `createBrowserRouter`. `App.js` wraps everything in `<AuthProvider>` and `<AppContext.Provider>`, then renders a persistent `Toolbar` plus `<EngineAgents/>`, then a `<Routes>` block:
- `/login` → `LoginPage` (public — full-screen login/signup)
- `/` → `HomePage` (public landing page that leads with the trainer; a "welcome back" card with due reviews for returning learners)
- `/play` → `StartScreen` (game setup) — **requires auth**. Was `/` until 2026-09-23.
- `/game` → `GamePage` (live board + control panel) — **requires auth**
- `/custom` → `EditorPage` (custom-position editor) — **requires auth**

Auth-gated routes are wrapped in `<ProtectedRoute>` (`frontend/src/auth/ProtectedRoute.js`); unauthenticated users get redirected to `/login` with a `state.from` so they bounce back to the requested URL after logging in.

**State:** Global state via Context + `useReducer` persisted to `localStorage` (`hooks/usePersistedReducer.js`). The hook accepts a factory function so `RESET_ALL` and `NEW_GAME` always return a fresh object — no shared array references between sessions.

All state transitions go through `frontend/src/reducer/Reducer.js`. Action types are in `actionTypes.js`; complex action creators (game-end detection, move generation) live in `reducer/actions/`. The initial state is exposed as a `createInitGameState()` factory in `constants.js`.

**Engine agents** (`frontend/src/ai/`):
- `useEngineAgent.js` — single React hook parameterised by `{engine, opponentType}`. Fires as a side effect when it's the engine's turn, calls the backend, converts UCI → coordinates, updates castling, checks for game-end. Guards on `!isCustomEditor && isGameSetup`.
- `EngineAgents.js` — mounts `StockfishAgent` (engine `"stockfish"`, opponentType `"ai"`) and `RandomEngineAgent` (engine `"random"`, opponentType `"rand"`). Each only runs when the matching `opponentType` is active. The two old `AIAgent.js`/`RandomAgent.js` files were merged here.

**API layer:**
- `api/apiBase.js` — single source of `API_HOST` and the `apiUrl(path)` helper used by every API module.
- `api/chessBackend.js` — `getBestMove({fen, depth?, movetime_ms?, engine})`. Either `depth` (fixed search depth) or `movetime_ms` (time-based search) is accepted by the backend; today the frontend always sends `depth`.
- `api/auth.js` — `signup`, `login`, `me`, `logout`, `getToken`, `getUser`. Caches user JSON in `localStorage` under `auth_user`. Used by `AuthContext`; UI components should call `useAuth()` rather than these directly.
- `api/games.js` — `saveGame({user_color, opponent_type, result, reason, moves, final_fen})` and `listGames({limit, skip})`. Both pass the JWT via `Authorization: Bearer`.

**Auth surface:**
- `auth/AuthContext.js` — `<AuthProvider>` + `useAuth()` hook. Exposes `{user, isLoading, login, signup, logout, refresh}`. On mount: cached user shows immediately if present, then `me()` revalidates in the background. `isLoading` exists specifically to prevent the protected-route flash on hard refresh.
- `auth/ProtectedRoute.js` — `<ProtectedRoute>` wrapper used in `App.js`. Shows a "Loading…" while `isLoading`, then redirects to `/login` if `!user`.
- `auth/AuthForm.js` — shared form (login/signup tabs + fields + submit) used by both `<LoginPage>` and `<AuthDialog>` so they stay in sync.
- `pages/LoginPage.{js,css}` — full-screen login page; redirects already-authed users to `state.from` (or `/`).
- `components/Toolbar/AuthDialog.js` — modal version of the form, opened from the toolbar's "Log in" button. Now a thin shell around `<AuthForm>`.

**Game persistence:** `components/Popup/GameEnds/GameEnds.js` fires `saveGame()` once on terminal status (mount-keyed via a ref guard). Skips when `gameMode === custom`, when `opponentType === human`, or when `!user`. Translates the reducer's `Status.white`/`Status.black`/`Status.stalemate`/`Status.insufficient` into the backend's `result` (win/loss/draw from the user's perspective) + `reason` (checkmate/stalemate/insufficient_material).

In production the frontend and backend are on different origins so CORS must stay configured on the backend.

**Toolbar** (`components/Toolbar/Toolbar.js`):
- Sticky top bar (64 px mobile / 76 px tablet+) on every route.
- Brand button routes home (`/`) — never prompts, because going home doesn't touch the game.
- "Learn" is the primary button; "Play" goes to `/play` setup and confirms before wiping a game in progress.
- "Editor" link to `/custom` — same confirmation logic.
- `useLocation()` adds an `is-active` class + `aria-current="page"` to whichever button matches the current route.
- Auth area: `Log in` opens `Toolbar/AuthDialog.js` (lifted out of `StartScreen`); when logged in it shows a user chip + `Logout`.

**Chess logic** is implemented client-side in `frontend/src/arbiter/` (legal moves, castling, game-end detection) and `frontend/src/utils/` (FEN serialization, UCI → coordinate conversion). The backend is only consulted for the best-move suggestion, not for move validation.

**SAN disambiguation** for the move list lives in `components/Pieces/disambiguation.js`. `getNewMoveNotation` (in `helper.js`) takes an optional `disambiguation` arg; for non-pawn captures Pieces.js computes whether another peer piece could reach the same square and emits the correct file/rank/full-square prefix.

### CSS layout

Single source of truth: `frontend/src/constants.css`.

```css
--toolbar-height: 64px;        /* 76px @ ≥768px */
--board-pad: 0.5rem;           /* 1rem @ ≥768px */
--board-units: 8.25;           /* 8 playable + 0.25 rank/file gutter */
--tile-size: min(
    (100vw - 2*--board-pad) / --board-units,
    (100svh - --toolbar-height - 4rem) / --board-units,
    --board-max / --board-units
);
```

The board is `8.25 × tile-size`. Dividing the available viewport space by **8.25 (not 8)** is what guarantees the board fits. `Pieces.css` anchors `.pieces` with explicit `width / height = 8 × tile-size` so the playable area is reliably square at every breakpoint — pieces are 12.5% × 12.5% of that.

Verified piece-square math at 320 / 375 / 390 / 430 / 768 px viewports (Playwright).

### AlphaZero (standalone)

Self-play + MCTS training loop in `AlphaZero/alphaZero.py`. The ResNet model is in `models.py`. Games (ConnectFour, TicTacToe, Chess) share a common interface defined in `games.py` / `chess_game.py`. Parallel variants are in `mctsParallel.py` / `alphaZeroParallel.py`. Pretrained weights are in `AlphaZero/Models/`.

---

## Audit & refactor — session log

### Take Back stopping the AI (2026-09-24)

**Bug:** at a high engine depth, clicking Take Back right after moving (before the AI's reply
landed) removed **two** plies instead of one, and — since the second ply didn't exist yet — it
instead deleted the **previous, already-completed** exchange. Worse, the corrupted state could land
on "the AI's turn" while `useEngineAgent`'s `isBusy` guard was still true for the now-stale in-flight
request; when that request resolved it correctly discarded itself (position no longer matched), but
nothing re-fired the effect afterward, so **the AI never moved again**.

**Root cause:** `TAKE_BACK` hardcoded "2 plies for a non-human opponent," which is only correct once
the engine has actually answered (then undoing the pair returns you to your own turn to retry). It
was wrong for the case where the engine's reply is still in flight — there, only your one pending
move should come off. `Reducer.js` now branches on `state.turn`: if it already equals the engine's
colour (its reply hasn't landed), undo 1 ply; otherwise undo the pair as before. Every take-back now
provably ends back on the human's turn, so the "AI needs to move but isBusy is stuck" state can no
longer arise from this action.

**Verified:** `reducer/Reducer.test.js` (6 assertions, both branches, both user colours, and a swept
check across ply counts that take-back never ends on the engine's turn), plus a browser repro against
the confirmed pre-fix bundle (delayed the engine response via route interception to make the race
reliable) showing the exact reported corruption and AI silence, then the same script clean against
the fix — 7/7 — and the ordinary "engine already replied" retry flow re-verified unchanged (2/2).

### Attacks & traps, and master-game depth (2026-09-24)

**35 repertoires, 164 lines, 1,639 positions** (from 19 / 93 / 742).

**16 new repertoires in attack/defence pairs.** Attacks: Fried Liver, Danish, Smith-Morra, Vienna
Gambit (White); Stafford, Traxler, Budapest, Englund (Black). Each has a matching defence repertoire
for the other colour. Trap lines put the beginner's losing reply in the book as the *opponent's*
move, so the learner drills the punishment: the Kieninger trap, the Englund's ...Qc1#, the
Stafford's 6.Bg5?? Nxe4!, the Siberian trap, and others. `category` and `counterpart` go through the
build into `index.json`, and the build checks the links are two-way and from opposite colours. The
Learn page gains an **Attacks & traps** filter (each attack followed by its defence, with a link
between them), and the home page lists the pairs.

**Honesty about unsound gambits.** The Stafford and Englund cost over a pawn by engine standards;
their repertoires carry `engineSlackCp` and a "when White knows it" line that shows the refutation.
Stockfish rejected about 20 of my draft moves along the way, including the Stafford's famous
...h5 (only works if White takes; objectively −5) and 10.h3 in the Smith-Morra, which walks into
...Nxf2.

**Deeper lines from real games: `tools/extend_lines.py`.** Extends each line along the most-played
move in the Lichess explorer, grading every learner move with Stockfish (a popular move that fails
is skipped). Two passes: masters (OTB 2200+), 68 lines and about 700 plies; then Lichess 2000+,
capped at 30 plies, 63 lines, for tails masters rarely reach. 466 new learner moves, each with a
hand-written idea. **Five extensions were trimmed or dropped** because every move passed but the
line *ended* somewhere bad for the learner (e.g. the London Stonewall at −0.9). Needs
`LICHESS_TOKEN` in `backend/.env` (no scopes). Responses are cached in `tools/.explorer-cache.json`,
which is gitignored.

**Checkmate in a drill works:** a mating book move ends the line with the idea shown ("Bg4#:
Checkmate…"), and no game-over popup fires.

**Verified:** build clean, 364 Jest assertions (every tree position legal per the app's arbiter),
the full Stockfish pass (1,687 learner moves at depth 18; its 10 flags, mostly borderline
0.7–1.0 pawn losses, were fixed by switching to the engine's move, except the Frankenstein-Dracula's
5...Nc6, where engines flip between it and ...Be7 with depth, so `vs-vienna-black` carries a 10cp
allowance), 40 browser drills across 8 of the new repertoires including
mate lines, and axe at 0 violations on the Learn and home pages in both themes.

### Drag fix: pieces vanished mid-drag (2026-09-23)

Native HTML5 drag hid the real piece (`display: none`) and relied on the browser's drag *ghost*, a
snapshot of an element positioned by CSS `transform` (and rotated 180° on Black's board), which
browsers often render blank. So the piece disappeared while dragging. **Replaced with pointer
events in `Pieces.js`:** the piece stays on its square at 35% opacity and a full-opacity copy
follows the pointer. The copy is **portalled to `<body>`**, because `position: fixed` inside the
transformed `.board--black` would be fixed to the board, not the viewport, and outside it the copy
is upright for both colours. A 4px threshold separates a drag from a tap, and the click that ends a
drag is suppressed so tap-to-move still works. `Piece.js` is now purely presentational. **Drag now
also works on touch screens**; `touch-action: none` sits on `.piece` only, so the page still scrolls
from empty squares. Verified: 15 browser assertions (mouse as White and Black, touch via CDP,
off-board drop cancels, tap-to-move unaffected).

### Book content expansion II + engine-checked theory (2026-09-23)

**14 repertoires → 19, 55 lines → 93, 349 positions → 742, learner choices 10 → 21.**
New: **Sicilian Dragon** (the real one; the old "Dragon" is the Accelerated), **English**,
**Catalan**, **King's Gambit**, **Alekhine**. Deepened 19 short lines (French, Caro-Kann, Ruy,
Najdorf, Accelerated Dragon, QGD, Scotch) from 10–16 plies to 20–30, and added 7 lines that give the
learner a choice (e.g. 9.Nbd2/9.c3 in the Open Ruy, 5...Qb6/5...Bd7 in the French Advance).

**New: `tools/check_book.py`** grades every learner move against Stockfish (depth 18, flags >70cp
loss; per-repertoire `engineSlackCp` for gambits). Every new line was graded before it went in, and
that caught a dozen of my own errors, including a bishop that just hung to Qxf5, a knight retreat
that dropped a piece, and an illegal ...Nc6 where no knight could reach it. On the **existing** book
its first run found real teaching errors:
- **London main line taught 8.Bxd6**, when 8.dxc5 wins material (the d6 bishop is pinned against the
  queen on c7 by the g3 bishop). Rewritten, plus a new line that *teaches* the punishment.
- **Grünfeld Fianchetto taught 8...Nfd7** (−105cp). Now 8...Nbd7.

**Two new build errors** in `build_openings.py`: every learner move must have an idea (backs the
home page's "100% explained"), and an idea on an **opponent** ply is rejected. The second one
exposed **65 stale ideas** in 12 lines, each an off-by-one copy of the next ply's text. They were
never displayed (the drill only shows learner-move ideas), so they were dead data, now removed.

**A UI bug the browser drills found:** the **last move of every line** had its idea authored but
never shown. `DrillPage`'s completion card replaces `<Feedback/>`. Now the completion card shows it.

**Verified:** build clean with no label warnings, 236 Jest assertions (every one of 1,523 tree
positions legal per the app's own arbiter), 32 full browser drills across 8 repertoires (every
explanation shown, both board orientations, no console errors), and the full Stockfish pass.

### Landing page (2026-09-23)

`/` used to be the auth-gated game setup, so a first-time visitor hit a login wall and never saw
the trainer. It is now a **public `HomePage`** (`pages/HomePage.{js,css}`): hero with a static
board showing 3.Bc4 and the book's own explanation, content counts (read from `index.json`, so they
track the book automatically), how-it-works, the full opening list by colour, and a "just want a
game?" card. Returning learners get a **Welcome back** card: streak, total due, and a button into the
review for whichever repertoire has the most due.

Game setup moved to **`/play`**; toolbar is now Learn (primary) · Play · Progress · Editor, and the
brand goes home. `GameEnds`' "new game" routes to `/play`.

`components/ui/MiniBoard.{js,css}` — a static board for illustrations, deliberately independent of
`AppContext` so a picture can never touch the live game. Reuses `BoardOverlay`.

**A pre-existing bug the hero exposed:** the overlay's `bo-in` keyframe ended `to { opacity: 1 }`
with fill-mode `both`, which overrode `.bo-square`'s `opacity: 0.3` — so the Hint button's square
marker rendered **solid amber and hid the piece it pointed at**. Dropped the `to` frame.

**Verified:** 30 browser assertions (first-time vs returning vs nothing-due, every CTA's target,
`/play` still protected with login bounce-back, a real game vs Stockfish from `/play`, overflow at 9
widths), axe WCAG 2.1 AA 0 violations on `/` in both themes (one contrast fix: `--c-ink-subtle`
fails on `--c-bg`, only passes on `--c-surface`).

### Progress page + accessibility pass (2026-09-20) — Phase 7

**New `/progress` page** (`pages/ProgressPage.{js,css}`): day streak, positions known, due now,
first-time accuracy; a next-seven-days bar chart of upcoming reviews; the Leitner box spread (how
well you know things, not just how much); per-repertoire rings with a Review/Learn action; and a
local reset. Toolbar gains a **Progress** link and a 🔥 **streak chip**.

**Accessibility: axe-core (WCAG 2.1 AA) across 5 routes × 2 themes — 11 violations → 0.**

The contrast failures were the interesting part, because every one of them *looked* fine:

| token | was | measured | now |
|---|---|---|---|
| `--c-ink-subtle` (light) | `#9E9080` | 3.06:1 | `#7E7161` (4.67:1) |
| `--c-primary` vs white text | `#5B8C51` | 3.95:1 | `#4C7A43` (5.03:1) |
| `--c-accent-strong` on soft | `#C9862A` | 2.73:1 | `#96611A` (4.71:1) |
| `--c-ink-subtle` (dark) | `#8A7C6B` | 4.03:1 | `#A89A87` (5.94:1) |
| `.btn--danger` white on `--c-error` | — | 4.11:1 light / 2.93:1 dark | new `--c-danger-bg` / `--c-on-danger` |

Two new tokens exist because the base `--c-error` / `--c-accent` are tuned for *arrows and borders*,
where 3:1 suffices; text on a tinted chip needs 4.5:1. Also removed an `opacity: .75` that was
silently pushing text under AA. **If you retune the palette, re-run the audit** — the originals all
looked plausible and measured badly.

Also fixed a real markup bug: `<dt>`/`<dd>` were not inside a `<dl>`, and once wrapped, a trailing
`<p>` inside each group still made the list invalid. The sub-text now lives inside the `<dd>`.

**Keyboard/semantics verified separately** (axe can't test these): tab reaches all 14 interactive
elements in a sensible order, each with a visible focus indicator; Review is activatable with Enter;
one `<h1>`, one `<main>`, `lang` present; `prefers-reduced-motion` zeroes the duration tokens.

**A CSS ordering trap worth remembering:** the responsive visibility rules at the bottom of
`Toolbar.css` are marked MUST STAY LAST. They are single-class rules, so a later base declaration of
the same property wins on source order — which is exactly what happened when the streak chip's base
`display: inline-flex` got appended below its own hide rule, silently re-showing it.

**Toolbar thresholds are measured, not guessed.** Adding Progress + the streak chip pushed the row
past 320/375/768px. Measured `scrollWidth` at each breakpoint gave: full row needs ~774px once
Editor is visible (so Editor waits for 820), ~387px without it (so Progress drops below 400), streak
below 460. Everything hidden stays reachable — Editor from the start screen's Custom mode, Progress
from the Learn cards. Swept 8 widths × 4 routes: **no horizontal overflow anywhere**.

> **Known gap, not fixed:** the chessboard is **not keyboard-operable**. 32 pieces, none focusable,
> no `role`, no `aria-label`. A keyboard-only or screen-reader user can navigate the whole app and
> reach every button, but cannot play a move. Adding ARIA labels without keyboard input would make
> an audit pass while leaving it unusable, so it is left explicit. Real support means keyboard
> square selection in `Pieces.js` plus announcements — a feature, not polish.

### Backend sync for the trainer (2026-09-20) — Phase 6

Trainer progress now follows a user across devices, while staying local-first: every review is
written to `localStorage` immediately and queued in an **outbox**, and the server is caught up in
one batched request at the end of a session. Signed out, nothing changes — the trainer works
exactly as before.

**Backend:** `TrainingCard` document (first compound indexes in the codebase — the `Indexed()`
field wrapper can't express them, so `Settings.indexes` with `pymongo.IndexModel`), a `TrainerStats`
sub-doc on `User`, `app/training/scheduler.py`, and `app/routers/training.py`.

**Frontend:** `api/training.js`, `trainer/sync.js`, plus an outbox and `mergeServerCards` in
`localStore.js`. `syncOnLogin` pushes local work first, *then* merges — so signing in never
overwrites what this device just did. Conflicts resolve to the **higher box**: two devices disagree
only about how well something is known, and the worst case of the generous reading is seeing a card
slightly late, versus destroying progress the learner earned.

**The duplicated scheduler is guarded.** `backend/tests/test_scheduler_parity.py` reads
`frontend/src/trainer/scheduler.js` and fails if `BOX_DAYS`, `MASTERED_BOX`, `MAX_BOX` or the
relearn delay drift, and checks the JS still drops two boxes on a miss. Verified by deliberately
changing one number and watching it fail. Run: `backend/venv/bin/python -m pytest tests -q`
(`requirements-dev.txt` pins pytest).

**Three real bugs, all found by testing rather than review:**
1. **`update(Inc(...))` followed by `save()` silently undid the increment.** `save()` writes the
   whole in-memory document back, and that copy still held the pre-increment counters — so
   `trainer.reviews` stayed 0 while cards were created. Now one `update()` combining `Inc` with
   `Set` for the streak fields.
2. **The review endpoint was slow enough to look broken.** A `find_one` + `save` per review meant
   ~20 sequential round trips to Atlas for a 10-move session; the client's flush was still in
   flight seconds later and every test read half-written state. Rewritten as one read, one
   `bulk_write`, one user update — 30 reviews now take ~1.1s.
3. **Deleting an account didn't delete its training cards.** `DELETE /auth/me` cascaded to games
   only. Fixed, and 47 orphans left by earlier test runs were cleaned out of the database.

**Verified:** 19 Python assertions (parity + scheduler behaviour), 17 API assertions (batching,
idempotent replay, not-due skip, per-user isolation, 401s, reset), and 16 browser assertions
covering the full cross-device story — drill on device A, sign in on a fresh device B and find the
progress there, drill signed out on device C and have it push on sign-in.

**Note on test scripts:** two rounds of confusing failures came from my own harness modelling the
board position in parallel with the app and drifting out of sync. The sync test now recovers the
position by reading the app's own move list each turn.

### Review mode — clearing what's due (2026-09-20)

Turns "I played through a line" into "I cleared today's reviews". `queue.js`, written and tested in
Phase 5 but unwired, now drives a real session.

**Two modes**, discriminated by `Mode` in the trainer reducer:
- **Learn** (`/learn/:id`) — walk a line from the start, opponent answers from the book, retry a
  missed move as often as you like.
- **Review** (`/learn/:id/review`) — serve the positions that are **due**, one standalone card at a
  time. **One attempt per card.** A miss reveals the book move with a red arrow and the explanation,
  then the queue reinserts it a few cards later; you must get it right twice to graduate it out of
  the session. Only the first encounter is graded.

The catalog grows a **"Review N due →"** button per repertoire when anything is due — the
returning-user path deserves its own button rather than hiding behind "open the repertoire".

**A real bug the browser test caught:** the catalog promised "6 due" and the session queued **40**.
`duePositions` treated *never-seen* positions as due, because `isDue(undefined)` is true — which is
correct for the scheduler (it makes new material available) but wrong for a review session.
Reviewing means "what I already learned and owe"; new material belongs in Learn. `duePositions` now
excludes unseen positions unless asked, and a test asserts the count it returns **equals** what the
catalog displays.

**A second fix, from reading the summary:** it said *"Next review due now"* immediately after
telling you the session was cleared, so the queue could never actually be emptied. Box 0's interval
is 0 days so brand-new material is available at once, but reusing that for a *lapse* is wrong. A
miss now schedules a **10-minute relearn step** (`RELEARN_MS`) instead, and `dueLabel` grew sub-day
wording. The summary now reads "Next review due in 10 min".

**New files:** `pages/ReviewPage.{js,css}`, `trainer/useReviewAgent.js` (the reveal timer — 1.5s on
a hit, 2.6s on a miss, because a miss is the moment worth reading).

**Verified:** 196 Jest assertions (8 new, including that the due count and the served queue agree),
12 browser assertions for a full review session, and re-run regressions for Learn mode (9) and the
arrow overlay (10).

### Spaced repetition, local-first (2026-09-20) — Phase 5

Progress now persists. Answers are scheduled, the catalog shows what's due, and a day streak
accumulates — all in `localStorage`, with **no account required**.

**Leitner boxes, not SM-2.** SM-2's machinery is the 0–5 quality grade driving an ease factor, and
opening recall is *binary*: you played the book move or you didn't. Feeding a binary signal into
SM-2 degenerates into Leitner with extra steps and a drifting ease value. Fixed intervals
(`0/1/3/7/16/35` days) also let the UI say "due in 3 days" as a fact rather than an estimate.
A miss drops **two** boxes rather than resetting to zero — losing everything to one slip makes long
repertoires punishing, and two boxes already resets the interval to a day or less.

**Card = one position, keyed by UCI path** — the same key the tree already uses, so a shared prefix
like `1.e4` is one card however many lines pass through it.

**New files:** `scheduler.js` (pure Leitner + day streak), `localStore.js` (persistence),
`progress.js` (catalog/repertoire selectors), `queue.js` (in-session learning steps),
`components/ui/ProgressRing.js`.

**Two correctness rules that are easy to get wrong, both tested:**
- **Only the first attempt at a position is graded.** Retrying until it sticks is the *learning
  step*, not the review — grading the retry would schedule it as if you had known it.
- **Answering something not yet due does not promote it.** Otherwise replaying a line five times in
  an afternoon pushes everything to the top box without a day passing, and the schedule is a lie.
  A *miss* is always recorded, though: forgetting something you were supposed to know is real
  information whenever it happens.

**A bug the browser test caught:** the "first attempt only" guard originally checked
`session.results`, but `results` is only written on a *correct* answer — so after a miss the guard
was still false and the retry got graded too, scoring the position twice. The marker has to be
`session.attempts`.

**A UX call:** the catalog ring shows **coverage** (positions seen), not mastery. Mastery needs box
4, so a freshly drilled repertoire showed `0` and looked broken. Mastery is text in the meta line.

**Not yet wired:** `queue.js` is written and tested but unused — it belongs to a dedicated
"review due" mode. The current drill walks a line from the root and grades what it meets. The
learning-step queue is what a Review button will use.

**Verified:** 188 Jest assertions (35 new, covering boxes, intervals, streak rollover, the queue's
graduation rules, corrupt/versioned storage, and early-review), plus 11 browser assertions
including that progress survives a reload.

### Board annotation layer + hint ladder (2026-09-20) — Phase 4

The Hint button finally does something. `components/Board/BoardOverlay.{js,css}` draws arrows and
square markers over the board.

**Two-stage hint**, because being nudged teaches more than being told:
1. **Hint** — marks the square of the piece that should move (amber). Duplicate origins are deduped
   when several book moves start from the same piece.
2. **More** — draws the arrow for every book move here. At a branching position you see all of them.

**"Show me"** draws the revealed move as a green arrow, so the reveal is visual rather than just a
line of text.

**Geometry:** `viewBox="0 0 8 8"` — one unit is exactly one square, so `[rank,file]` maps to
`(file + 0.5, 7 - rank + 0.5)` with no pixel maths, no reading `--tile-size` in JS, and no resize
listener. The layer mirrors `.pieces` positioning (`Pieces.css:1-9`) so the two align at every
breakpoint.

**The board flip needed no code at all.** `.board--black` rotates the whole board 180° and the
overlay is a descendant, so an arrow authored in white coordinates lands on the right squares *and*
points the right way. Verified by drilling the King's Indian as Black. (Only text would need the
counter-rotation `.ranks`/`.files` use — there is deliberately none in the overlay.)

**Placement:** sibling of `<Pieces/>` inside `.board`, never a child of `.pieces`, which owns the
drag and click handlers. `z-index: 6` puts it above pieces (`.piece:hover` is 5) and below `.popup`
(1500). `pointer-events: none` means it can never swallow an input.

Annotations are **derived** from session state in `TrainerContext` via `useMemo`, not stored, so
they cannot drift out of sync with the position. `useAnnotations()` returns `[]` outside a drill, so
`/game` and `/custom` are untouched — asserted in the tests.

**Verified:** 10 browser assertions covering the ladder, pointer-events, stacking order, the flipped
board, and the absence of the overlay outside a drill. 153 Jest assertions still green.

### Book content expansion (2026-09-20)

Filled the tree with real material. **9 repertoires → 14, 30 lines → 55, 193 cards → 349**, and
every single learner move is now explained.

| | before | after |
|---|---|---|
| Repertoires | 9 | **14** |
| Lines | 30 | **55** |
| Cards (positions to answer) | 193 | **349** |
| Median line depth | 13 plies | **20 plies** |
| Learner-side branches | 5 | **10** |
| Moves with an explanation | 192/193 | **361/361 (100%)** |

**New: five hard 1.d4 defences** — King's Indian (Mar del Plata, Petrosian, Sämisch, Fianchetto),
Nimzo-Indian (Rubinstein, Classical, Kasparov, Sämisch), Grünfeld (Exchange, Bc4, Russian System,
Fianchetto), Semi-Slav (Meran, Moscow, Anti-Moscow, Botvinnik), Modern Benoni (Classical, Taimanov,
Fianchetto, Modern Main). All 20 lines run 20 plies.

**Deepened 14 existing lines** from ~13 plies to ~18-22, and added 5 new lines that give the learner
a genuine *choice* rather than diverging on the opponent's move: a Najdorf Scheveningen setup
(6...e6 alongside 6...e5), the Caro-Kann Karpov (4...Nd7), the French Rubinstein (3...dxe4), a quiet
4.d3 Italian, and the Ruy delayed exchange.

**The build's own checks earned their keep again** — three of my hand-written continuations were
illegal and the build refused them: `ruy-exchange` repeated a move it had already played,
`scotch-gambit` had White recapturing with a knight that had just been captured, and
`scotch-classical` played `Nc3` onto a square its own pawn occupied. The label check then caught two
lines whose labels didn't match the position they reached.

**A bug in the label check itself:** trimming the emitted `lines` (to stop duplicating move data now
in `nodes`) silently broke `labelOk` suppression, because the flag lived on the full line dict. The
check now runs before the trim.

**Verified:** 153 Jest assertions — including that every one of the 726 tree positions is legal
according to the app's own arbiter, which is what validates 20 lines of hand-written theory. Plus a
browser run drilling the full 20-ply Nimzo-Indian as Black: 10/10 first time, "Perfect line!".

### Tree-shaped opening book (2026-09-20)

Replaces the linear book. **A position can now have several correct replies**, which is what makes
serious openings teachable: a linear book told you `6...e6` was wrong in the Najdorf when it is main
theory. The drill accepts any book move, follows the branch you chose, and tells you how many other
moves were also theory there.

**Authoring did not change.** You still write lines in `tools/repertoires.json`; the build script
merges them on shared prefixes into a position tree. Adding an alternative at move 6 means authoring
one more line, not hand-editing tree structures.

**Format** — each repertoire is now `{ lines: [...lightweight index...], nodes: { "<uci path>": {...} } }`.
The key is the concatenated UCI path (`""` is the start), which is *also* the spaced-repetition card
key planned for Phase 5 — so shared prefixes dedupe automatically. Cards dropped 193 → 124 for the
same content, because `1.e4` is now one card instead of one per line. Payload is 80.6 KB.

**Runtime rewrite:** `book.js` (tree navigation), `buildPosition.js` (replaces `buildLinePrefix.js`,
now path-based), `judgeMove.js` (membership test, not equality), `trainerReducer.js` (path-keyed
state). `DrillPage` shows the variation name live as the line deepens, and flags branching positions.
The opponent picks its reply at random among book moves, so repeated runs explore different lines.

**Two bugs this surfaced:**
- `build_tree` hardcoded `"mine": false` on leaf nodes instead of computing it, mislabelling every
  leaf that lands on the learner's move. Caught by the book test, which checks turn parity.
- The "N book moves here" notice only rendered on the first move of a run, because it lived in the
  empty-feedback branch. Moved to the header.

Also deduplicated 63 ideas that were authored twice on shared prefixes — the tree only needs each
explained once, and the build now warns when two lines describe the same move differently.

**Verified:** 113 Jest assertions, plus a browser run reaching a real branch and confirming the
*alternative* move is accepted. Explanation coverage is 129/130 learner moves (99%).

**Still linear in one sense:** there are only 5 learner-side branches in the current content, since
the existing lines mostly diverge on the opponent's move. Getting real value from the tree needs
curation that deliberately offers choices.

### Opening drill loop (2026-09-20) — Phase 3 of the opening-trainer plan

The first playable part of the trainer. `/learn` lists the repertoires,
`/learn/:repertoireId` drills a line move by move. **Both routes are public** — someone has to be
able to try a drill before signing up.

**The trainer is the sole board writer.** During a drill `Pieces.js` doesn't dispatch a move at all:
it reports the attempt through `useMoveGate()` and returns. The trainer judges it and rebuilds the
*entire* position history from the line prefix. Consequences worth knowing:
- A wrong move never half-applies — nothing to revert, no flicker, no take-back arithmetic.
  The `UNDO_PLY` action the plan called for turned out to be unnecessary.
- `movesList` entries come from the book, which is canonical. `getNewMoveNotation` emits no
  `+`/`#`, so it is never used here.
- Rewind, replay, next-line and jump-to-ply are all one operation: set the ply.

**New files** (all under `frontend/src/trainer/`):
`TrainerContext.js` (provider, `useTrainer`, `useMoveGate`), `trainerReducer.js` (session state
machine), `buildLinePrefix.js`, `judgeMove.js`, `useBookAgent.js`, `openingsRepo.js`, plus
`pages/LearnPage.{js,css}` and `pages/DrillPage.{js,css}`.

**Changes to existing code are small and deliberate:**
- `Reducer.js` gains exactly one case, `LOAD_POSITION_SEQUENCE`. It also sets
  `gameMode: trainer`, `opponentType: "book"` and `isGameSetup: false` — doing that via `SETUP_GAME`
  instead would have reset `turn` to `'w'` and fought the position just loaded.
- Stockfish is muted for free: no registered engine matches `"book"`, so both agents bail at
  `useEngineAgent.js:35`. `isGameSetup: false` is a second, independent guard.
- `Pieces.js`: a 9-line gate after the candidate-move check and **before** the promotion branch, so
  the promotion popup can never open mid-drill.
- `GameEnds.js`: skips `GameMode.trainer` and `opponentType === "book"` (the backend `Game` model
  only accepts `ai|rand|human`, so posting `"book"` would 422), and routes back to `/learn`.
- `getCastlingMoves` now **throws** when handed the `{w,b}` object instead of the per-side string.
  It previously just never matched, silently disabling castling.

**Two traps `buildLinePrefix` has to avoid**, both called out in the plan and both real:
- It returns the **full position history**, not the final board — `getPawnCaptures` detects en
  passant by diffing against `prevPosition`.
- Castling rights are tracked **incrementally** with `getCastlingDirections`, not inferred with
  `helper.js getCastleRights`, which wrongly restores the right when a rook leaves h1 and returns.

**Verified:** 163 Jest assertions (`trainer.test.js` covers the prefix builder, judging, and the
session machine; `openings.test.js` still covers the book). Plus browser runs: a full White line
including a deliberate wrong move, and a full Black line on the CSS-rotated board — no console
errors, no horizontal overflow at 390 or 1280.

**Not yet built:** no spaced repetition (Phase 5), no arrows (Phase 4) — the hint currently only
raises `hintLevel` in state, nothing renders it yet. No progress is persisted anywhere.

### Opening book data pipeline (2026-09-20) — Phase 2 of the opening-trainer plan

Generated book data for the trainer. **30 lines across 9 repertoires, 193 drill cards, 43 KB.**

- **`tools/build_openings.py`** — offline generator. Run with
  `backend/venv/bin/python tools/build_openings.py`. Uses the backend venv because
  `python-chess` already lives there; the frontend still ships no chess library.
- **`tools/repertoires.json`** — the only hand-edited file: which lines to teach, plus prose.
- **`tools/eco-source/*.tsv`** — vendored lichess-org/chess-openings (CC0), 3,815 openings.
- **`frontend/public/openings/`** — generated, committed, fetched at runtime.
- **`tools/README.md`** — how to add a line, refresh the dataset, and read the label check.

**Naming is position-based, not name- or sequence-based.** Two findings forced this:
- Dataset names are **not unique** — "London System" appears 4× with different move orders, so
  looking a line up by name is ambiguous.
- Keying on the move *sequence* misses transpositions: the dataset reaches the Caro-Kann Classical
  via `3.Nd2`, most players play `3.Nc3`. Same position, different path. Switching the key to EPD
  fixed the Caro (generic `B15` → `B18 Classical Variation, Main Line`) and the QGD Exchange.

**The label check earns its keep.** It warns when a curated `label` shares no words with the
official name, because *a line can silently transpose into a different opening*. On the first build
it caught two real errors: a "Scotch Gambit" line that actually reached an Italian Game (duplicating
another repertoire), and a "Hungarian Defense" that became a Scotch. Also corrected: "Orthodox
Defense" → Tartakower (the `...b6` makes it so), "Schmidt" → Mieses, and a London line that was
really the Rapport-Jobava. Intentional mismatches are silenced per line with `"labelOk": true`.

**Output location matters.** `frontend/public/openings/`, **not** `src/data/` — CRA inlines JSON
imported from `src/` into the main bundle, and `.gitignore:13`'s bare `data/` matches at any depth,
so `src/data/` would have been silently untracked. Verified: `git check-ignore` clean, book absent
from `build/static/js/`, present in `build/openings/`.

**`frontend/src/trainer/openings.test.js` is the load-bearing test** — it replays all 30 lines
through the app's **own arbiter**, not python-chess, so a convention mismatch between the two
engines can't ship. 132 assertions, all passing.

> **Gotcha it caught, worth remembering:** `arbiter.getValidMoves` wants `castleDirection` as the
> **string for the side to move** (`'both'|'left'|'right'|'none'`), not the `{w,b}` object. Passing
> the object silently disables castling rather than throwing — `getCastlingMoves`
> (`arbiter/getMoves.js:176`) just never matches. The app gets this right
> (`Piece.js:32`, `Pieces.js:154`); my first test draft did not. Phase 3's `buildLinePrefix` must
> pass the per-side string too.

### Account management: change password + delete account (2026-09-20)

Added so users can self-serve a password change, and so "reset my password" has an answer that
needs no email provider: delete the account and sign up again with the same name.

- **`POST /auth/change-password`** and **`DELETE /auth/me`** — see the Routers section above for
  semantics. Delete cascades to the user's games.
- **`backend/tools/set_password.py`** — admin CLI for the forgotten-password case.
- **`frontend/src/pages/AccountPage.{js,css}`** — new `/account` route (protected): stats summary,
  change-password form, and a red "danger zone" card. Delete requires **two** independent
  confirmations — the password (proof of identity) and typing your own username (proof of intent).
- `Toolbar.js` — the user chip is now a button linking to `/account`, with the same
  `is-active`/`aria-current` treatment as the other nav items.
- `api/auth.js` — `changePassword()`, `deleteAccount()`, plus an `errorMessage()` helper because
  FastAPI 422s return `detail` as a *list of objects*, not a string; the old code would have
  rendered "[object Object]".
- `AuthContext` exposes `deleteAccount` so the in-memory user clears alongside the token.
- `AuthForm.js` — "Forgot password?" copy now points at the Account page first, and only falls back
  to emailing the admin.

**Decision: no email-based reset.** Sending is free (Resend 3k/mo, SendGrid 100/day, Gmail SMTP),
but sending from your own address needs a domain, and Render's free tier blocks outbound SMTP ports.
Not worth the moving parts until the site has users who need 2am self-service. The admin script
covers the case in the meantime.

**Note:** deleting an account requires being logged in, so it does *not* help someone who has
actually forgotten their password — that path is still the admin script.

**Verified:** 16/16 API assertions via curl (wrong password → 403, identical password → 400, short
password → 422, old token invalidated, username reusable), an orphan-games query confirming the
cascade left 0 dangling rows, and 13/13 browser assertions via Playwright covering the full UI
flow including both delete confirmations. `npm run lint` and `npm run build` clean.

### Design system + theming (2026-09-20) — Phase 1 of the opening-trainer plan

Groundwork for a chess **opening trainer** (teach openings by the book, spaced-repetition drilling).
Full plan at `~/.claude/plans/i-want-to-make-sparkling-wombat.md`. This session shipped Phase 1 only.

**New files:**
- `frontend/src/styles/tokens.css` — the single source of colour, radius, shadow, spacing, type and
  motion. Light values on `:root`, dark overrides in one `[data-theme="dark"]` block, so token
  *names* never change between themes and no component knows which is active.
- `frontend/src/styles/primitives.css` — `.card`, `.btn` (+ `--primary/--accent/--ghost/--danger`),
  `.chip`, `.stack`, `.row`. Replaces the **three** competing button definitions that used to live
  in `App.css`, `Toolbar.css` and `StartScreen.css`.
- `frontend/src/hooks/useTheme.js` — `light | dark | system`, persisted to `localStorage`
  (`chess-theme`), stamps `data-theme` on `<html>`. Follows the OS while the user hasn't chosen.

**Changes:**
- **Zero hex literals outside `tokens.css`** — was 39 distinct values across 7 files.
  `grep -rE '#[0-9a-fA-F]{3,8}' src --include='*.css'` should only ever hit `styles/tokens.css`.
  Theme-independent piece colours are tokens too (`--c-piece-white`, `--c-piece-black`).
- **Cinzel + Raleway → Nunito** (single family, 400/600/700/800). Cinzel read "medieval chess club",
  which fought the warm/playful direction. One font request instead of two.
- **Warm light palette** (cream `#F7F1E6`, green `#5B8C51`, amber `#E8A33D`) + a warm dark theme.
  Theme toggle lives in the toolbar.
- `react-powerglitch` **removed** as a dependency — the glitch title effect was its only use.
- `constants.css` is now **board geometry only**. `--light-tile`/`--dark-tile`/`--check`/`--highlight`
  moved into `tokens.css` so the board re-skins per theme. `--tile-size` is untouched.
- **Bug found and fixed:** `.toolbar` sets `box-sizing: content-box` (deliberate — `--toolbar-height`
  excludes the safe-area padding), but `index.css` does `* { box-sizing: inherit }`, so every
  descendant inherited content-box and added padding *on top of* `min-height`. A 48px toolbar button
  was rendering at 74px. Fixed with a `.toolbar *` border-box reset. Pre-existing, not new.
- Focus rings moved onto the palette (`--sh-focus`) instead of the UA blue.

**Verified** with Playwright driving the system Chrome (no browser download): `/`, `/game`,
`/custom`, `/login` × light/dark × 390px/1280px — all 12 combinations, zero horizontal overflow,
toolbar button measured back at 48px. `npm run lint` and `npm run build` both clean.

**Facts established for the trainer work (verified, don't re-derive):**
- `getNewMoveNotation` (`helper.js:53-87`) **never emits `+` or `#`** — book SAN does. Judging must
  compare UCI coordinate tuples, never SAN.
- `.gitignore:13` is a bare `data/`, which matches at *any* depth — `frontend/src/data/` would be
  silently untracked. Generated book data must not live in a directory called `data`.
- `StartScreen.js:17` dispatches `RESET_ALL` on mount, so trainer state cannot live in the global
  reducer — a toolbar tap would wipe it.
- `positionToFen` is lossy (en-passant `-`, clocks `0`/`1`), and `getPawnCaptures` detects en passant
  by diffing against `prevPosition` — so the trainer replays the full position history and never
  needs a FEN at all.
- Setting `opponentType: "book"` mutes both engine agents with **zero** code change
  (`useEngineAgent.js:35` already bails on a mismatch).

### Concurrent-engine deadlock fix (2026-05-27)

- **Bug:** On the live site, after starting a game the AI would stop moving once the user touched the Hint controls. Root cause was **not** in the frontend hook — it was backend concurrency. `/engine/best-move` is a sync FastAPI endpoint, so Starlette runs it in a threadpool and serves overlapping requests on separate threads. The Stockfish engine is a single `@lru_cache` singleton wrapping one subprocess over stdin/stdout (not thread-safe). When an AI-move request and a Hint request overlap (easy on the slow free-tier backend), their UCI commands interleave on the same pipe — replies get crossed (reproduced: a black-to-move request returned the white move `e2e4`) and the pipe then **deadlocks permanently**, so the AI never moves again until the backend restarts.
- **Fix:** Added a module-level `threading.Lock` in `backend/app/engines/stockfish.py` guarding the whole `set_fen_position → set_depth/get_best_move → get_evaluation` sequence so each request is atomic. Reproduced the deadlock and verified the fix with a concurrent two-thread script (sequential calls always worked; concurrent calls hung pre-fix, pass post-fix with correct per-position moves). `random_engine.py` needs no lock (fresh `chess.Board` per call, no shared engine state).
- **Note:** kept the endpoint sync (CPU-bound blocking call belongs in the threadpool, not the event loop); the lock just serializes engine access.

### Render deploy + Stockfish tuning (2026-05-16)

**Render bring-up fixes** (in order they hit):
- `email-validator` 1.3.1 → 2.2.0 in `backend/requirements.txt`. Pydantic v2 (pulled in by Beanie) requires `>=2.0`.
- Added `certifi` to `requirements.txt`; pass `tlsCAFile=certifi.where()` to the `AsyncIOMotorClient` in `backend/app/db.py`. Standard fix for Motor + Atlas on Linux containers; harmless even if not strictly required.
- Pinned `bcrypt==4.0.1` alongside `passlib[bcrypt]==1.7.4`. `bcrypt` 4.1+ strictly rejects strings >72 bytes; `passlib` 1.7.4's `detect_wrap_bug` self-test hits that path on first hash and 500s every signup. Lock to 4.0.1.
- **Manual config (not code):** Atlas Network Access → `0.0.0.0/0` allowlist (Render's outbound IPs are dynamic). Atlas's `TLSV1_ALERT_INTERNAL_ERROR` actually means "IP not allowed", not a real TLS failure.
- **Manual config (not code):** Atlas Database Access → created DB user with `readWrite` on `chessai`; Render `MONGODB_URI` uses that user's password.

**Stockfish quick-tuning** (`backend/app/engines/stockfish.py`):
- Added `Hash: 256` (MB) to the Stockfish parameters dict (was using the ~16 MB default — huge speedup at any depth).
- `best_move(fen, depth, movetime_ms=None)` now accepts an optional `movetime_ms`. If provided, calls `sf.get_best_move_time(ms)` (time-based search, reaches deeper on simple positions); otherwise the old `set_depth(N) + get_best_move()` path. `random_engine.best_random_move` signature updated to match.
- `backend/app/routers/engine.py` `BestMoveIn` schema gained `movetime_ms: int | None` (range 50–10000).

**Frontend strength controls**:
- Two independent depth settings in app state: `engineDepth` (default 15, for the AI opponent) and `hintDepth` (default 10, for the Hint button). Both range 1–20.
- `StartScreen.js` has the "Engine depth" slider (only visible when opponent=ai).
- `HintButton.js` has its own inline "Depth" slider rendered below the button so the user can tune hint strength mid-game without going back to setup.
- `localStorage` key bumped twice: `chess-state` → `chess-state-v2` (during the brief `engineThinkMs` experiment) → `chess-state-v3` (after restoring `engineDepth`). Bumping the key cleanly discards stale persisted state.
- Reducer action types: `SET_ENGINE_DEPTH` + new `SET_HINT_DEPTH`. Action creators: `setEngineDepth`, `setHintDepth` (in `reducer/actions/game.js`).

**Engine choice decision:** Stockfish is the right engine for this app — strongest available, free, CPU-friendly, mature. Possible future additions: ship a newer Stockfish binary in the Dockerfile (Debian's apt package is older), add Maia as a "human-like opponent" alternative (registry in `app/engines/__init__.py` is ready), expose Stockfish `Skill Level 0–20` instead of just depth for true difficulty scaling.

### Mongo migration + auth gate (this session)
- **Database swap (PostgreSQL → MongoDB Atlas).** Removed `sqlmodel`, `sqlalchemy`, `alembic`, `psycopg2-binary` from `requirements.txt`; added `motor` + `beanie`. Deleted `backend/alembic/`, `alembic.ini`, `dev.db`, the old `backend/app/auth/models.py`. New `backend/app/models.py` defines Beanie `User` (with embedded `UserStats`) and `Game` documents. New `backend/app/db.py` initialises Beanie in a FastAPI `lifespan` handler. `auth/router.py`, `auth/dependencies.py`, `auth/utils.py` all rewritten async against Beanie. JWT subject changed from `username` → user `ObjectId` string.
- **New `/games` API.** `backend/app/routers/games.py` — `POST /games` (saves a game + atomically `$inc`s the user's stats sub-doc), `GET /games` (paginated user history), `GET /games/{id}` (404 if not owned by the current user). All routes require `get_current_active_user`.
- **CORS env-driven.** `CORS_ORIGINS` comma-separated env var in `backend/app/settings.py`. The hardcoded `192.168.86.1:3000` and the catch-all `"*"` are gone. Default for dev: `localhost:3000` + `127.0.0.1:3000`.
- **`.env` auto-loads.** `settings.py` calls `load_dotenv()` so the standard `uvicorn app.main:app` invocation picks up `backend/.env`. New `backend/.env.example` documents the required vars.
- **Frontend auth gate.** New `auth/AuthContext.js` (`<AuthProvider>`, `useAuth()`), `auth/ProtectedRoute.js`, `auth/AuthForm.js` (shared form), `pages/LoginPage.{js,css}`. Routes `/`, `/game`, `/custom` are protected; unauthenticated visitors redirect to `/login`. `Toolbar` no longer fetches `me()` itself — consumes `useAuth()`. `AuthDialog` refactored to a thin wrapper around `AuthForm` so the modal and the page stay in sync.
- **Game persistence on game-end.** `GameEnds.js` fires `saveGame()` once per terminal status (ref-guarded), skipping custom-editor / human-vs-human / logged-out cases.
- **Engine agent race window closed.** `useEngineAgent.js` now snapshots `appState.position` + `appState.turn` at request fire and re-checks the latest state (via a render-updated `latestStateRef`) after the await. Stale responses caused by a take-back / new-game during an in-flight Stockfish request are dropped without dispatching. Pattern is StrictMode-safe (only state changes invalidate; double-mount with unchanged state still dispatches).
- **AWS scrub.** `aws-keys.txt`, `yinon-key.pem`, `newKey.pem` deleted from working tree (the two tracked files staged for removal via `git rm`). `.gitignore` extended with `*.pem`, `*.key`, `aws-keys.txt`, `.env`/`.env.*` (with `!.env.example` exception). **Manual follow-up still required:** rotate AWS access key `AKIAWCSOJLEYD6TPLE4G` in the AWS console — it's permanently in git history; rotation is what closes the security hole.

### Backend cleanup
- Removed demo/load-test endpoints from `main.py` (`/fail`, `/slow/{seconds}`, `/random`, `/load/{n}`, `/logs/{count}`, duplicate `/health`).
- Deleted `backend/app/auth/config.py` (dead — defined a different `SECRET_KEY` and a fake `USERS_DB`).
- Deleted `backend/app/auth/schemas.py` (dead — replaced by inline pydantic models in the auth router).
- `settings.py`: prefers `JWT_SECRET_KEY` (with `SECRET_KEY` fallback for back-compat); raises in production if unset; `ACCESS_TOKEN_EXPIRE_MINUTES` is env-driven.
- `engines/stockfish.py`: cross-platform path resolver with explicit candidate list and a clear error message.

### Frontend bug fixes
- **Take-back desync** — `Reducer.js TAKE_BACK` now uses `slice(0, -steps)` and `lastMoveStack.at(-1)` instead of always slicing 1.
- **Wrong castle-direction key** — `Pieces.js` and the engine agent used `castleDirection["white"|"black"]` (always `undefined`); now uses `castleDirection[opponent]` keyed on `"w"|"b"`.
- **HintButton status check** — was comparing to lowercase `"promoting"`; now uses `Status.promoting`.
- **`GameEnds.js`** — was destructuring `mode` from app state but the field is `gameMode`; the "back to /custom" path was always falling through to `/`.
- **Promotion popup couldn't be cancelled** — backdrop click now dismisses it.
- **Reducer `CAN_CASTLE`** mutated `state.castleDirection` directly; now spreads.
- **`initGameState` shared array references across resets** — replaced with `createInitGameState()` factory.
- **`Pieces.js` selection-clearing effect** keyed on the position-array reference; switched to `history.length` so it only fires on actual position changes.
- **`Piece.js` drag cleanup** restored display correctly when the node unmounts mid-drag (ref + cleanup hook).
- **Engine agent regression (StrictMode race)** — the unified `useEngineAgent` had a `cleanup → cancelled = true` mechanism that, in dev StrictMode's double mount, killed the AI's first response after a page rehydrate. Removed the cancellation; `isBusy` ref alone prevents concurrent fires. Reproduced and fixed via Playwright.
- **`Pieces.js` editor branch** dispatched `ENTER_CUSTOM_MODE` with a `newPosition` payload the reducer dropped; that branch was unreachable anyway, so it was deleted.
- **`getNewMoveNotation`** SAN disambiguation for non-pawn captures was missing; new `disambiguation.js` walks peer pieces and emits the correct file/rank/full prefix.
- **`AIAgent.js` + `RandomAgent.js`** were ~95% identical; merged into `useEngineAgent.js` + `EngineAgents.js`.
- **`api/auth.js` + `api/chessBackend.js`** had inconsistent base-URL fallbacks; consolidated into `api/apiBase.js`.
- **`getLegalMoves`** — exported, never called; removed.
- **`auth.js` `setUser`** export was unused; renamed to internal `cacheUser`.
- **Stray `console.log("depth")`** in the engine agent removed.
- Routes/components stopped passing the unused `orientation` prop down through `Board → Files/Ranks/Popup/PromotionBox`.
- `EditorPage` no longer wraps `CustomEditor` in the `.App` 2-column grid wrapper.
- `<style>` injected at runtime in `CustomEditor.js` moved into `CustomEditor.css`.

### Mobile-first CSS rewrite
- Stripped every existing `@media` rule and mobile override across `App.css`, `Board.css`, `Pieces.css`, `Control.css`, `MovesList.css`, `StartScreen.css`, `CustomEditor.css`, `Popup.css`.
- New layout from scratch with mobile as the default and a single 768 px breakpoint.
- 44 px / 48 px touch targets across buttons, tray pieces, toolbar items.
- `touch-action: manipulation` on the pieces layer; drag disabled on `(hover: none)` so taps don't initiate drags on phones.
- Board sizing rewritten so the full 8.25-tile board fits the viewport — pieces are square at every breakpoint, no horizontal scroll. Verified at 320 / 375 / 390 / 430 / 768.
- Safe-area-inset padding on `.page` and the toolbar.

### Toolbar + AuthDialog
- New `components/Toolbar/Toolbar.{js,css}`: sticky elevated bar with gradient background, blur, and shadow. Brand + New Game (primary) + Editor + auth.
- Min 48 px button height, 0.7 / 1.2 rem padding, 1 rem font (1.05 rem ≥768 px).
- Hover (pointer devices only): translateY(-1px), brighter background, larger shadow.
- Active / tap: `translateY(1px) scale(0.97)` press feel.
- `is-active` class for the current route: gold underline (`box-shadow: 0 -3px 0 #ffd700 inset`) + brighter background; `aria-current="page"`.
- Lifted login/signup UI out of `StartScreen.js` into `Toolbar/AuthDialog.{js,css}`.

### Interactivity polish
- Tile hover (pointer devices only): subtle inner-shadow tint.
- Candidate move dots changed from gray to **green** (`rgba(20, 130, 60, 0.7)`); capture rings to **red** (`rgba(220, 60, 50, 0.85)`). Both pulse on a 1.6 s breath.
- Selected source square (tap-to-move): gold-bordered overlay rendered as `<div className="selected-square p-{file}{rank}">` inside `.pieces`. 160 ms scale-fade pop.
- Last-move overlay fades in over 220 ms.
- Checked king pulses red on top of the gold base.
- Pieces get `cursor: grab` + drop-shadow on hover; `cursor: grabbing` on `:active`.
- Global `<button>` styling (App.css) — same hover-lift / active-press / disabled-grayscale treatment as toolbar buttons. Inherited by TakeBack / Hint / setup / editor buttons.
- Page transitions: `.page { animation: page-in 220ms ease both }` — soft opacity + 6 px translate-Y on every route mount.
- Popups (Promotion / GameEnd) and their backdrops fade in (180 / 220 ms). Opacity-only because `transform` would conflict with the existing `.board--black .popup--inner { transform: rotate(180deg) }`.
- Every animation has a `prefers-reduced-motion: reduce` escape hatch.

### Decisions deferred to user choice
- **Toolbar nav links:** user picked "New Game" only; I added an "Editor" link in Section 1 of the polish pass. If you'd rather drop it, remove the second `<button>` in `Toolbar.js` — the toolbar is structured for one-line additions/removals.
- **Auth in toolbar vs StartScreen:** chose to *replace* (auth lives in the toolbar now). The old `auth-bar` and modal styles were removed from `StartScreen.css`.

---

## Known issues / TODO

### Backend / ops
- **AWS access key still exposed in git history.** The working-tree files are deleted and `.gitignore`d, but the tracked AWS key (`AKIAWCSOJLEYD6TPLE4G`) and `yinon-key.pem` remain in past commits. **You must rotate the AWS key in the console** — that's what actually closes the hole. Once rotated, optionally run `git filter-repo` / BFG to scrub them from history (rewrites every commit hash; force-push required).
- **Production env on Render:** confirm Render is set with `ENV=production`, `JWT_SECRET_KEY`, `MONGODB_URI` (Atlas SRV string), `MONGODB_DB_NAME=chessai`, and `CORS_ORIGINS=https://yinon-chess-ai.vercel.app`. The Postgres `DATABASE_URL` from before can be removed; the Render Postgres add-on can be deprovisioned.
- **MongoDB Atlas free tier (M0):** sleeps inactive clusters; first request after idle takes ~10 s. Not a bug — just expected behaviour on the free plan.

### Frontend
- **`react@^19` + `react-scripts@5`** is unsupported officially. Out of scope for this audit; consider migrating to Vite (or Next.js) at some point.
- **Mobile drag fallback:** HTML5 drag-and-drop doesn't fire on iOS Safari; tap-to-move is the primary path on touch. Drag is also disabled on `(hover: none)` to avoid accidental drags during scroll. If you want richer touch interaction, consider `react-dnd` with `react-dnd-touch-backend`, or a long-press-to-drag implementation.
- **Reduced motion:** all animations honor `prefers-reduced-motion: reduce`. Spot-check on a real device if you change animations.
- **Browser visual checks:** all Playwright checks in this session were geometry/state assertions, not pixel-level layout. Spot-check the toolbar, the candidate-move pulses, the popups, and the page fade on a real device.
- **Save-on-game-end is fire-and-forget.** A network blip while saving the final game silently logs to console — the popup still shows. Acceptable for now; if you want stricter UX, surface a small "couldn't save" toast.

### Plumbing
- `frontend/src/frontend_src-tree.txt` still references the deleted `AIAgent.js` / `RandomAgent.js` filenames. Stale, harmless — regenerate or delete it.
- `frontend/.env.development.local` is git-ignored (created locally). New devs need to create it manually with `REACT_APP_API_HOST=http://127.0.0.1:8000`.
- `backend/.env` is now git-ignored. Use `backend/.env.example` as the template for new local setups.

### Next-session bug list

User flagged some bugs to fix in a future session. **Capture them here as you discover them so we don't lose context between sessions.** Add bullets below; include exact reproduction steps + observed-vs-expected.

- _(none captured yet — add when user describes them)_

### Possible improvements parked for later

These were discussed but deferred. Not bugs, just options:
- **Tech-currency updates** — bump TypeScript 4→5, `@testing-library/user-event` 13→14, optionally migrate `react-scripts` (CRA, deprecated by React team Feb 2025) → Vite, optionally `react-router-dom` v6 → v7.
- **Component-hierarchy cleanup** — `frontend/src/routes.js` is a redundant catch-all wrapper. Could be flattened. Provider stack itself is fine (only `AuthProvider` + `AppContext.Provider`; DevTools duplicates are `StrictMode`'s dev-only double-render, not a bug).
- **Stockfish enhancements** — ship newer Stockfish binary in Dockerfile, add Maia engine option, expose Stockfish `Skill Level 0–20` for difficulty scaling, switch to `python-chess`'s `chess.engine.SimpleEngine` for multipv / streaming.

---

## Quick local-run cheatsheet

One-time setup:
1. Create a free MongoDB Atlas M0 cluster, allow your IP, copy the SRV connection string.
2. Copy `backend/.env.example` → `backend/.env` and fill in `MONGODB_URI` and `JWT_SECRET_KEY` (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).
3. Optional: create `frontend/.env.development.local` with `REACT_APP_API_HOST=http://127.0.0.1:8000`.

```powershell
# Tab 1 — backend
cd C:\Users\yinon\Desktop\chessAI\ChessAI\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Tab 2 — frontend
cd C:\Users\yinon\Desktop\chessAI\ChessAI\frontend
npm start
```

Stockfish is auto-discovered at `backend/bin/stockfish.exe`. No `STOCKFISH_BIN` needed unless you've moved the binary. Mongo init runs in the FastAPI lifespan handler — if your `MONGODB_URI` is wrong, the server fails on startup with a clear Motor connection error.
