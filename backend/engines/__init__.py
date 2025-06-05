# engines/__init__.py
import asyncio, pathlib
from stockfish import Stockfish
import chess, random

ENGINE_PATH = pathlib.Path(__file__).parent / "stockfish" / "stockfish.exe"

def stockfish_best(fen: str, depth: int) -> str:
    sf = Stockfish(str(ENGINE_PATH), depth=depth)
    sf.set_fen_position(fen)
    return sf.get_best_move()

# --- example placeholder AI (random legal move) -----------
def random_ai_best(fen: str, depth: int) -> str:          # depth ignored
    board = chess.Board(fen)
    return random.choice(list(board.legal_moves)).uci()

# ---- central registry ------------------------------------
ENGINE_REGISTRY = {
    "stockfish": stockfish_best,
    "random":    random_ai_best,   # add your own models here
}
