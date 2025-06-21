import random
import chess  # python-chess is already in requirements

def best_random_move(fen: str, _depth: int = 0) -> dict:
    """
    Pick a uniformly-random legal move for the given FEN.
    `_depth` is ignored but kept so the signature matches Stockfish's.
    """
    board = chess.Board(fen)
    move = random.choice(list(board.legal_moves))      # e.g. Move.from_uci("e2e4")
    return {"best_move": move.uci(), "info": {"type": "random"}}
