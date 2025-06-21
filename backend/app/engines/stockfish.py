from functools import lru_cache
from shutil import which
from stockfish import Stockfish
import os

_STOCKFISH_PATH = (
        os.environ.get("STOCKFISH_BIN")      # let the user override in .env
        or which("stockfish")                # /usr/bin/stockfish on Debian-based images
        or "/usr/games/stockfish"            # fallback for some distros
)

@lru_cache(maxsize=1)
def _stockfish() -> Stockfish:
    return Stockfish(
        path=_STOCKFISH_PATH,
        parameters={"Threads": 2, "Skill Level": 20},
    )

def best_move(fen: str, depth: int = 15):
    sf = _stockfish()
    sf.set_fen_position(fen)
    sf.set_depth(depth)
    return {
        "best_move": sf.get_best_move(),
        "info": sf.get_evaluation(),
    }
