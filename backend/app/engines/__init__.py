from .stockfish import best_move as stockfish_best
from .random_engine import best_random_move

ENGINE_REGISTRY = {
    "stockfish": stockfish_best,
    "random":    best_random_move,
    # register future engines here: "my_nn": my_nn_best
}
