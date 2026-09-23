"""Grade every learner move in the generated opening book with Stockfish.

The build (build_openings.py) proves each move is *legal*. It can't tell whether
a move is *good*, and hand-written theory is exactly where a plausible but wrong
move slips in, which would teach the learner a mistake as "the book move". This
closes that gap.

For each position where the learner moves, it compares the book move against
Stockfish's best move and reports any that give away more than --threshold
centipawns. Opponent moves aren't graded: they're what the learner has to
*answer*, and a dubious opponent move is still worth teaching the refutation to.

    backend/venv/bin/python tools/check_book.py                 # everything
    backend/venv/bin/python tools/check_book.py kings-gambit    # ids containing this

Gambits legitimately cost material, so a repertoire can raise its own bar with
"engineSlackCp" in repertoires.json. Needs a Stockfish binary: $STOCKFISH_BIN,
else `stockfish` on PATH.

Exit status is 1 if anything is flagged, so it can gate a build.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import chess
import chess.engine

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "frontend" / "public" / "openings"
SPEC = Path(__file__).resolve().parent / "repertoires.json"


def engine_path() -> str:
    path = os.environ.get("STOCKFISH_BIN") or shutil.which("stockfish")
    if not path:
        sys.exit("Stockfish not found: set STOCKFISH_BIN or put `stockfish` on PATH.")
    return path


def board_at(path: str) -> chess.Board:
    board = chess.Board()
    # Keys are concatenated 4-char UCI moves; the build rejects promotions.
    for i in range(0, len(path), 4):
        board.push_uci(path[i:i + 4])
    return board


def score_cp(info, pov: chess.Color) -> int:
    return info["score"].pov(pov).score(mate_score=10_000)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("filter", nargs="?", default="", help="only repertoire ids containing this")
    ap.add_argument("--depth", type=int, default=18)
    ap.add_argument("--threshold", type=int, default=70, help="centipawn loss that gets flagged")
    args = ap.parse_args()

    slack = {r["id"]: r.get("engineSlackCp", 0) for r in json.loads(SPEC.read_text())["repertoires"]}
    index = json.loads((BOOK / "index.json").read_text())

    engine = chess.engine.SimpleEngine.popen_uci(engine_path())
    engine.configure({"Hash": 256, "Threads": max(1, (os.cpu_count() or 2) - 1)})
    limit = chess.engine.Limit(depth=args.depth)

    flagged = []
    graded = 0
    try:
        for entry in index["repertoires"]:
            rid = entry["id"]
            if args.filter not in rid:
                continue
            nodes = json.loads((BOOK / entry["file"]).read_text())["nodes"]
            bar = args.threshold + slack.get(rid, 0)
            for path, node in nodes.items():
                if not node.get("mine"):
                    continue
                board = board_at(path)
                me = board.turn
                best = engine.analyse(board, limit)
                best_cp = score_cp(best, me)
                best_san = board.san(best["pv"][0])
                for reply in node["replies"]:
                    move = chess.Move.from_uci(reply["uci"])
                    board.push(move)
                    after = engine.analyse(board, limit)
                    board.pop()
                    loss = best_cp - score_cp(after, me)
                    graded += 1
                    if loss > bar:
                        flagged.append((rid, path, reply["san"], best_san, loss, best_cp))
            print(f"  {rid:<32} checked", flush=True)
    finally:
        engine.quit()

    print(f"\nGraded {graded} learner moves at depth {args.depth}.")
    if not flagged:
        print(f"None loses more than {args.threshold}cp (plus per-repertoire slack) against Stockfish's choice.")
        return 0

    print(f"\n{len(flagged)} learner move(s) lose too much against the engine's choice:")
    for rid, path, san, best_san, loss, best_cp in flagged:
        ply = len(path) // 4
        print(f"  {rid}: ply {ply + 1} {san}  (-{loss}cp; engine prefers {best_san}, eval {best_cp:+})")
        print(f"      path {path or '(start)'}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
