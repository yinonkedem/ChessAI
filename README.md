# ♟️ Chess AI – Play, Learn, Evolve

A full-stack **chess playground** powered by **Stockfish** (classical engine) and an experimental **AlphaZero-style** prototype.  
Play a strong engine, analyze custom positions, get hints, and explore modern AI ideas (policy/value networks + MCTS).

- **Live site:** https://yinon-chess-ai.vercel.app/
- **Repo:** https://github.com/yinonkedem/ChessAI

---

## ✨ Features

- **Engine play & analysis.** Server-side Stockfish with tunable depth/skill.
- **Custom position sandbox.** Load any FEN or set up positions on the board.
- **Single-move “Hint.”** Learn without reading full engine lines.
- **Modern stack.** FastAPI backend, React frontend (Node.js), clean API.

---

## 🧩 Architecture (high-level)

| Layer        | Tech                              | Notes |
|--------------|-----------------------------------|-------|
| Frontend     | React 18, Node.js                 | Responsive UI, board interactions, hint button |
| Backend API  | FastAPI, `python-chess`, Stockfish| `/engine/best-move`, JSON responses |
| Engine       | Stockfish 16+ (external binary)   | Controlled via Python wrapper |
| Extras       | “Random” engine (dev/demo)        | Picks a random legal move (useful for testing) |

---

## 🚀 Run locally (no Docker)

### Prerequisites
- **Python** 3.10+  
- **Node.js** 18+ and **npm**
- **Stockfish binary** installed on your machine  
  - On Windows: download an official build and note its path (e.g. `C:\Tools\stockfish\stockfish.exe`)  
  - On macOS/Linux: install via package manager or download a release

> The backend will look for the binary via the `STOCKFISH_BIN` environment variable. Set it to your Stockfish path.

### 1) Backend (FastAPI)

**macOS/Linux**
```bash
# from repo root
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# set Stockfish path (example)
export STOCKFISH_BIN="/usr/local/bin/stockfish"   # adjust to your path

# run API (http://127.0.0.1:8000)
uvicorn app.main:app --reload --port 8000
