"""Syzygy-based perfect play for ≤7 pieces."""
import os
from functools import lru_cache

import chess
import chess.syzygy

TB_DIR = os.getenv("SYZYGY_PATH", "/tablebases")  # overridable in docker-compose

@lru_cache(maxsize=1)
def _tb() -> chess.syzygy.Tablebase:
    tb = chess.syzygy.Tablebase()
    tb.add_directory(TB_DIR, load_wdl=True, load_dtz=True)
    return tb

def _wdl(board: chess.Board) -> int:
    """+2/+1 = win, 0 = draw, -1/-2 = loss (for *side-to-move*)"""
    return _tb().probe_wdl(board)  # KeyError if the TB isn’t available

def best_move(fen: str, *_):
    board = chess.Board(fen)

    # 1️⃣ Reject (>7) piece positions early so caller can fall back
    if len(board.piece_map()) > 7:
        return {"best_move": None, "info": {"reason": ">7 pieces"}}

    try:
        root_wdl = _wdl(board)
    except KeyError:
        return {"best_move": None, "info": {"reason": "missing tables"}}

    best, best_score = None, (-3 if board.turn else 3)  # white max / black min

    # 2️⃣ Enumerate legal moves and keep the one that gives the best WDL
    for move in board.legal_moves:
        board.push(move)
        try:
            score = _wdl(board)
        except KeyError:
            score = None  # table missing — skip
        board.pop()

        if score is None:
            continue

        # WDL is always from the *current* side-to-move’s perspective, so
        # after we push a move it’s the *opponent*’s turn — invert.
        score = -score

        better = score > best_score if board.turn else score < best_score
        if better:
            best, best_score = move, score

    return {
        "best_move": best.uci() if best else None,
        "info": {"root_wdl": root_wdl, "selected_wdl": best_score}
    }
