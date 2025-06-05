import chess
import chess.engine

ENGINE_PATH = "engines/stockfish/stockfish.exe"  # adjust if you chose a different path

board = chess.Board()                            # start position
engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)

result = engine.play(board, chess.engine.Limit(depth=1))
print("Best move at depth-1 is:", result.move)   # e.g. e2e4

engine.quit()
