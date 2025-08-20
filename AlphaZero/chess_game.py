import numpy as np
import chess


class Chess:
    """Chess environment implementing the AlphaZero `Game` interface.

    The design mirrors the lightweight interfaces already used for
    Connect‑Four and Tic‑Tac‑Toe so that the existing AlphaZero logic works
    unchanged.
    """

    # ------------------------------------------------------------------ #
    #                               Init                                 #
    # ------------------------------------------------------------------ #
    def __init__(self):
        self.row_count = 8
        self.column_count = 8

        # Build a *fixed* action mapping – one index per distinct UCI move
        # (from‑square, to‑square, optional promotion).  There are at most
        # 64*64*4 ≈ 16k unique moves, well within PyTorch tensor limits.
        self.move_to_index: dict[str, int] = {}
        self.index_to_move: dict[int, chess.Move] = {}
        self._init_action_mapping()
        self.action_size = len(self.move_to_index)

        # Number of planes in the encoded board representation
        #  • 12 piece planes (6 white + 6 black)
        #  • 1 side‑to‑move plane
        #  • 4 castling planes (WK, WQ, BK, BQ)
        #  • 1 en‑passant plane
        self.num_input_planes = 18

    # ------------------------------------------------------------------ #
    #                        Interface methods                            #
    # ------------------------------------------------------------------ #
    def __repr__(self):
        return "Chess"

    def get_initial_state(self):
        """Return a fresh python‑chess `Board`."""
        return chess.Board()

    def get_next_state(self, state: chess.Board, action: int, player: int):
        """Push *action* to *state* and return the resulting position.

        The function mutates a **copy** of the incoming board to avoid side
        effects, mirroring the pattern used by Connect‑Four.
        """
        board = state.copy(stack=False)
        board.push(self.decode_action(action))
        return board

    # ------------------------------------------------------------------ #
    #                      Game‑theoretic helpers                         #
    # ------------------------------------------------------------------ #
    def get_valid_moves(self, state: chess.Board):
        valid = np.zeros(self.action_size, dtype=np.uint8)
        for move in state.legal_moves:
            idx = self.encode_action(move)
            if idx is not None:
                valid[idx] = 1
        return valid

    def get_value_and_terminated(self, state: chess.Board, action: int):
        if state.is_game_over():
            outcome = state.outcome()
            if outcome is None or outcome.winner is None:
                return 0, True  # draw
            return (1 if outcome.winner else -1), True
        return 0, False

    def get_opponent(self, player: int):
        return -player

    def get_opponent_value(self, value: int):
        return -value

    def change_perspective(self, state: chess.Board, player: int):
        """Return a *copy* of *state* that always has the side‑to‑move as
        *white* (player == 1).

        For the black player (player == -1) we mirror the board.  Note that
        `mirror()` is **in‑place** and returns `None`, so we have to call it
        first and then return the board object.
        """
        board = state.copy(stack=False)
        if player == -1:
            board.mirror()
        return board

    # ------------------------------------------------------------------ #
    #                       State‑plane encoding                          #
    # ------------------------------------------------------------------ #
    def get_encoded_state(self, state: chess.Board):
        planes = np.zeros((self.num_input_planes, 8, 8), dtype=np.float32)

        # piece planes – white pieces on planes 0‑5, black on 6‑11
        for square, piece in state.piece_map().items():
            row = 7 - chess.square_rank(square)
            col = chess.square_file(square)
            plane = (piece.piece_type - 1) + (0 if piece.color == chess.WHITE else 6)
            planes[plane][row][col] = 1.0

        # side to move plane (all ones if white to move)
        planes[12][:] = 1.0 if state.turn == chess.WHITE else 0.0

        # castling rights
        if state.has_kingside_castling_rights(chess.WHITE):
            planes[13][:] = 1.0
        if state.has_queenside_castling_rights(chess.WHITE):
            planes[14][:] = 1.0
        if state.has_kingside_castling_rights(chess.BLACK):
            planes[15][:] = 1.0
        if state.has_queenside_castling_rights(chess.BLACK):
            planes[16][:] = 1.0

        # en‑passant square
        if state.ep_square is not None:
            row = 7 - chess.square_rank(state.ep_square)
            col = chess.square_file(state.ep_square)
            planes[17][row][col] = 1.0

        return planes

    # ------------------------------------------------------------------ #
    #                     Action encoding / decoding                      #
    # ------------------------------------------------------------------ #
    def _init_action_mapping(self):
        idx = 0
        for from_sq in chess.SQUARES:
            for to_sq in chess.SQUARES:
                # None represents a normal move (no promotion)
                for promo in (None, chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN):
                    move = chess.Move(from_sq, to_sq, promotion=promo)
                    uci = move.uci()
                    if uci not in self.move_to_index:
                        self.move_to_index[uci] = idx
                        self.index_to_move[idx] = move
                        idx += 1

    def encode_action(self, move: chess.Move):
        return self.move_to_index.get(move.uci())

    def decode_action(self, index: int) -> chess.Move:
        return self.index_to_move[index]
