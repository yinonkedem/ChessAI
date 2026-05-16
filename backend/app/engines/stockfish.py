import os
from functools import lru_cache
from pathlib import Path
from shutil import which

from stockfish import Stockfish

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_BUNDLED_CANDIDATES = [
    _BACKEND_ROOT / "bin" / "stockfish.exe",
    _BACKEND_ROOT / "bin" / "stockfish",
]


def _resolve_stockfish_path() -> str:
    env_path = os.environ.get("STOCKFISH_BIN")
    if env_path and Path(env_path).is_file():
        return env_path

    on_path = which("stockfish")
    if on_path:
        return on_path

    for candidate in _BUNDLED_CANDIDATES:
        if candidate.is_file():
            return str(candidate)

    fallback = "/usr/games/stockfish"
    if Path(fallback).is_file():
        return fallback

    raise FileNotFoundError(
        "Could not locate the Stockfish binary. Set the STOCKFISH_BIN env var "
        f"or place the executable at one of: {[str(c) for c in _BUNDLED_CANDIDATES]}"
    )


@lru_cache(maxsize=1)
def _stockfish() -> Stockfish:
    return Stockfish(
        path=_resolve_stockfish_path(),
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
