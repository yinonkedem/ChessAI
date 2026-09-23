# tools/ — offline build tooling

Build-time data generation for the app. Nothing here runs in production, and
nothing here is part of `npm run build`.

> Not to be confused with `backend/tools/`, which holds runtime admin scripts
> (e.g. `set_password.py`). This directory generates committed data files.

## Opening book

```bash
backend/venv/bin/python tools/build_openings.py
```

Uses the backend venv because that is where `python-chess` already lives — the
frontend deliberately ships no chess library, which is the whole reason every
move is resolved to UCI here, once, instead of in the browser on every drill.

| Path | What it is |
|---|---|
| `repertoires.json` | **The only file you edit.** Which lines to teach, and the prose explaining them. |
| `eco-source/*.tsv` | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0 public domain. Vendored so the build is reproducible offline. |
| `build_openings.py` | The generator. |
| → `frontend/public/openings/` | Generated output. **Committed.** |

Output lives in `public/`, not `src/`, for two reasons: CRA inlines JSON
imported from `src/` into the main JS bundle, and `.gitignore` has a bare
`data/` rule that matches a `data` directory at *any* depth — so
`frontend/src/data/` would have been silently untracked.

### Adding a line

Add it to `repertoires.json` with its moves in SAN, then re-run the build. You
do **not** write the ECO code or the official opening name: the script derives
both from the resulting position.

The build is deliberately strict, because bad book data would show a learner a
wrong "correct" move. It fails on an illegal move, a promotion, a duplicate
line id, a line the learner never moves in, or more `ideas` than moves.

Two more rules, both errors:

- **Every learner move needs an idea.** A shared prefix only needs explaining
  once, in any line that passes through it. The home page advertises 100%, and
  this check is what makes that true.
- **Ideas go on the learner's moves only.** `ideas` is index-aligned with the
  plies, and the drill never shows an idea on an opponent move — so one there
  is always an off-by-one. 65 of them once sat undetected.

The summary table's `choices` column counts positions where the learner has
more than one book move. That's what makes the tree more than a set of lines to
memorise, so it's worth growing on purpose.

### Checking move quality with Stockfish

```bash
backend/venv/bin/python tools/check_book.py                 # whole book, ~10 min
backend/venv/bin/python tools/check_book.py kings-gambit    # repertoire ids containing this
```

The build proves moves are *legal*; this checks they're *good*. It grades every
learner move against Stockfish's choice (depth 18) and flags any that give away
more than 70cp — which is how a plausible-but-wrong move in hand-written theory
gets caught before it's taught as "the book move". Its first run found a real
one: the London main line taught `8.Bxd6` where `8.dxc5` wins material, because
the d6 bishop is pinned against the queen on c7.

Gambits and offbeat defences give up something by design, so a repertoire can
raise its own bar with `"engineSlackCp"` (the King's Gambit uses 60, since 2.f4
alone costs about a pawn by engine standards). Needs `stockfish` on `PATH` or
`$STOCKFISH_BIN`. Opponent moves aren't graded: a dubious opponent move is still
worth teaching the answer to.

### Naming, and why it is position-based

Each line's ECO code and name come from the **deepest position in the line that
the dataset recognises** — not from a name you type, and not from matching the
move sequence:

- Names repeat. "London System" appears four times with different move orders.
- Move sequences miss transpositions. The dataset reaches the Caro-Kann
  Classical via `3. Nd2`; most players go `3. Nc3`. Same position, different
  path. ECO classifies positions, so the position is the right key.

### The label check

A warning (not an error) fires when your `label` shares no words with the
official name. It exists because **a line can silently transpose into a
different opening** — during the first build, a line written as the "Scotch
Gambit" turned out to reach an Italian Game, and a "Hungarian Defense" became a
Scotch. Teaching a wrong variation name is a real defect.

When a mismatch is intentional (e.g. "Giuoco Piano" is what players call the
line the dataset files as "Italian Game: Classical Variation"), silence it per
line:

```json
"labelOk": true,
"labelOkWhy": "the dataset calls this the Italian Classical Variation"
```

### Refreshing the ECO dataset

```bash
for f in a b c d e; do
  curl -sSL -o tools/eco-source/$f.tsv \
    https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv
done
backend/venv/bin/python tools/build_openings.py
```

Re-run the frontend test afterwards — it replays every line through the app's
own arbiter, which is what catches a convention mismatch between python-chess
and `frontend/src/arbiter`:

```bash
cd frontend && CI=true npx react-scripts test --testPathPattern=openings
```
