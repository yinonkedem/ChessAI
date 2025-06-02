import uuid
import chess

class GameManager:
    """
    Very small in-memory ‘database’.
    Keys are game_id strings; values are python-chess Board objects.
    """
    def __init__(self):
        self._games: dict[str, chess.Board] = {}

    # ---------- public API ----------

    def create_game(self, fen: str | None = None) -> str:
        board = chess.Board(fen) if fen else chess.Board()
        game_id = uuid.uuid4().hex[:8]        # 8-char id
        self._games[game_id] = board
        return game_id

    def get_board(self, game_id: str) -> chess.Board:
        return self._games[game_id]           # KeyError if unknown

    def move(self, game_id: str, uci: str) -> chess.Board:
        board = self.get_board(game_id)
        move = chess.Move.from_uci(uci)
        if move in board.legal_moves:
            board.push(move)
            return board
        raise ValueError("Illegal move")

# ---------- export a SINGLETON ----------
game_manager = GameManager()
