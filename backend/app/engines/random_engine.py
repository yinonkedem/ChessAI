import random
import chess  # python-chess is already in requirements

def best_random_move(fen: str, _depth: int = 0, _movetime_ms: int | None = None) -> dict:
    """
    Pick a uniformly-random legal move for the given FEN.
    `_depth` and `_movetime_ms` are ignored but kept so the signature matches Stockfish's.
    """
    board = chess.Board(fen)
    move = random.choice(list(board.legal_moves))
    return {"best_move": move.uci(), "info": {"type": "random"}}
