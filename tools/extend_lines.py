"""Propose deeper continuations for book lines, following master practice.

From the last position of each line in repertoires.json, repeatedly take the
most-played move in the Lichess opening explorer, for both sides, until the
position has too few games to count as theory or the line reaches --max-plies.
Every LEARNER move is also graded by Stockfish: if the most-played move gives
away more than the threshold, the next most-played move that passes is used,
and if none does, the extension stops there. Popular is not the same as good,
and the trainer should never teach a mistake as "the book move".

It only *proposes*: output is a JSON file of extended move lists, plus engine
context for each new learner move to help write its idea. Nothing here edits
repertoires.json; ideas are hand-written, and the build refuses a learner move
without one.

    backend/venv/bin/python tools/extend_lines.py --out /tmp/proposals.json
    backend/venv/bin/python tools/extend_lines.py --only najdorf --max-plies 36

Needs LICHESS_TOKEN (a token with no scopes; set it in backend/.env) and
Stockfish on PATH or $STOCKFISH_BIN. Explorer responses are cached in
tools/.explorer-cache.json (gitignored), so re-runs are fast and polite.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import chess
import chess.engine

HERE = Path(__file__).resolve().parent
SPEC = HERE / "repertoires.json"
CACHE = HERE / ".explorer-cache.json"
ENV = HERE.parent / "backend" / ".env"
DBS = {
    # OTB master games, 2200+. The default: this is what "theory" means.
    "masters": "https://explorer.lichess.ovh/masters?{q}",
    # Lichess games 2000+ — for offbeat gambits masters rarely play.
    "lichess": "https://explorer.lichess.ovh/lichess?variant=standard"
               "&speeds=blitz,rapid,classical&ratings=2000,2200,2500&{q}",
}


def token() -> str:
    tok = os.environ.get("LICHESS_TOKEN")
    if not tok and ENV.exists():
        for line in ENV.read_text().splitlines():
            if line.startswith("LICHESS_TOKEN="):
                tok = line.split("=", 1)[1].strip().strip("'\"")
    if not tok:
        sys.exit("LICHESS_TOKEN not set (add it to backend/.env).")
    return tok


class Explorer:
    def __init__(self, db: str):
        self.db = db
        self.tok = token()
        self.cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
        self.dirty = 0

    def query(self, board: chess.Board) -> dict:
        key = f"{self.db}|{board.fen()}"
        if key in self.cache:
            return self.cache[key]
        q = urllib.parse.urlencode({"fen": board.fen(), "moves": 12, "topGames": 0, "recentGames": 0})
        req = urllib.request.Request(DBS[self.db].format(q=q),
                                     headers={"Authorization": f"Bearer {self.tok}"})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read())
                break
            except urllib.error.HTTPError as exc:
                if exc.code == 429:          # rate limited: Lichess asks for a full minute
                    time.sleep(65)
                    continue
                raise
            except urllib.error.URLError:
                time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError("explorer unreachable")
        slim = {"total": data["white"] + data["draws"] + data["black"],
                "moves": [{"uci": m["uci"], "n": m["white"] + m["draws"] + m["black"]}
                          for m in data["moves"]]}
        self.cache[key] = slim
        self.dirty += 1
        if self.dirty % 25 == 0:
            self.save()
        time.sleep(0.4)
        return slim

    def save(self):
        CACHE.write_text(json.dumps(self.cache))


def san_tokens(pgn: str) -> list[str]:
    return [t for t in pgn.split() if not re.match(r"^\d+\.+$", t)]


def to_pgn(sans: list[str]) -> str:
    out = []
    for i, s in enumerate(sans):
        if i % 2 == 0:
            out.append(f"{i // 2 + 1}.")
        out.append(s)
    return " ".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--only", default="", help="only lines/repertoires whose id contains this")
    ap.add_argument("--db", choices=DBS, default="masters")
    ap.add_argument("--min-games", type=int, default=25)
    ap.add_argument("--max-plies", type=int, default=40)
    ap.add_argument("--threshold", type=int, default=70)
    ap.add_argument("--depth", type=int, default=18)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    spec = json.loads(SPEC.read_text())
    ex = Explorer(args.db)
    sf = os.environ.get("STOCKFISH_BIN") or shutil.which("stockfish")
    engine = chess.engine.SimpleEngine.popen_uci(sf)
    engine.configure({"Hash": 256, "Threads": max(1, (os.cpu_count() or 2) - 1)})
    limit = chess.engine.Limit(depth=args.depth)

    def cp(info, pov):
        return info["score"].pov(pov).score(mate_score=10_000)

    proposals = []
    try:
        for rep in spec["repertoires"]:
            side = chess.WHITE if rep["side"] == "w" else chess.BLACK
            bar = args.threshold + rep.get("engineSlackCp", 0)
            for line in rep["lines"]:
                if args.only and args.only not in line["id"] and args.only not in rep["id"]:
                    continue
                # Trap lines end on the point of the trap; extending them would
                # just be a long winning continuation, not theory.
                if line.get("noExtend"):
                    continue
                sans = san_tokens(line["moves"])
                board = chess.Board()
                for s in sans:
                    board.push_san(s)
                added, context, stop = [], [], "max plies"
                while len(sans) + len(added) < args.max_plies:
                    data = ex.query(board)
                    if data["total"] < args.min_games or not data["moves"]:
                        stop = f"only {data['total']} games"
                        break
                    candidates = [m for m in data["moves"] if m["n"] >= args.min_games] or data["moves"][:1]
                    choice = None
                    if board.turn == side:
                        best = engine.analyse(board, limit)
                        best_cp = cp(best, side)
                        for m in candidates:
                            mv = chess.Move.from_uci(m["uci"])
                            board.push(mv)
                            loss = best_cp - cp(engine.analyse(board, limit), side)
                            board.pop()
                            if loss <= bar:
                                choice = (mv, m["n"], loss, best_cp,
                                          board.variation_san(best["pv"][:4]))
                                break
                        if not choice:
                            stop = "no popular learner move passes the engine"
                            break
                    else:
                        choice = (chess.Move.from_uci(candidates[0]["uci"]), candidates[0]["n"], None, None, None)
                    mv, n, loss, best_cp, pv = choice
                    san = board.san(mv)
                    if board.turn == side:
                        context.append({"ply": len(sans) + len(added) + 1, "san": san, "games": n,
                                        "share": round(n / data["total"], 2), "loss": loss,
                                        "eval": best_cp, "enginePv": pv, "fenBefore": board.fen()})
                    board.push(mv)
                    added.append(san)
                if added:
                    proposals.append({"repertoire": rep["id"], "line": line["id"], "side": rep["side"],
                                      "from": len(sans), "to": len(sans) + len(added),
                                      "moves": to_pgn(sans + added), "added": added,
                                      "learnerMoves": context, "stopped": stop})
                print(f"  {line['id']:<34} {len(sans):>2} -> {len(sans) + len(added):>2}  ({stop})",
                      flush=True)
    finally:
        engine.quit()
        ex.save()

    Path(args.out).write_text(json.dumps(proposals, indent=1, ensure_ascii=False))
    print(f"\n{len(proposals)} line(s) extended; proposals in {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
