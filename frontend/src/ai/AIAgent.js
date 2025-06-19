import {useEffect, useRef} from "react";
import {useAppContext} from "../contexts/Context";

import {positionToFen} from "../utils/positionToFen";
import {uciToCoords} from "../utils/uciToCoords";
import {getBestMove} from "../api/chessBackend";

import arbiter from "../arbiter/arbiter";
import {copyPosition, getNewMoveNotation} from "../helper";
import {getCastlingDirections} from "../arbiter/getMoves";

import {
    makeNewMove,
    clearCandidates          // wipes any hint dots that might still be up
} from "../reducer/actions/move";

import {
    updateCastling,
    detectStalemate,
    detectInsufficientMaterial,
    detectCheckmate
} from "../reducer/actions/game";

import {Status} from "../constants";    // adjust relative path


/**
 * Invisible helper that sits in the tree and fires
 * exactly once whenever it's the computer's turn.
 */
const AIAgent = () => {
    const {appState, dispatch} = useAppContext();
    const isBusy = useRef(false);          // prevents double-firing while the
                                           // `await` inside the effect is running

    useEffect(() => {
        // ---------------------------------------------------------------------
        // 1.  Only run if:
        //     • a computer is actually playing
        //     • and it *is* the computer’s turn
        // ---------------------------------------------------------------------
        if (
            appState.status !== Status.ongoing ||
            appState.opponentType !== "ai" ||
            isBusy.current
        ) return;

        const aiColor = appState.userColor === "white" ? "b" : "w";
        if (appState.turn !== aiColor) return;          // user to move → bail

        isBusy.current = true;
        (async () => {
            try {
                // -----------------------------------------------------------------
                // 2.  Ask Stockfish for its best move
                // -----------------------------------------------------------------
                const board = appState.position.at(-1);          // current 8×8 matrix
                const fen = positionToFen({
                    position: board,
                    turn: appState.turn,
                    castleDirection: appState.castleDirection,
                });
                console.log(appState.engineDepth, "depth");

                const {best_move} = await getBestMove({
                    fen,
                    depth: appState.engineDepth
                });
                if (!best_move) throw new Error("Engine returned no move 🤷‍♂️");

                // -----------------------------------------------------------------
                // 3.  Convert UCI → board coords we already work with
                // -----------------------------------------------------------------
                const coords = uciToCoords(best_move);
                const [[fromRank, fromFile], [toRank, toFile]] = coords;
                const promotion = coords.promotion || null;
                const piece = board[fromRank][fromFile];
                if (!piece) throw new Error("No piece on the 'from' square – mismatch!");

                // -----------------------------------------------------------------
                // 4.  Synchronise castling rights (if king/rook moved)
                // -----------------------------------------------------------------
                if (piece.endsWith("k") || piece.endsWith("r")) {
                    const dir = getCastlingDirections({
                        castleDirection: appState.castleDirection,
                        piece,
                        file: fromFile,
                        rank: fromRank,
                    });
                    if (dir) dispatch(updateCastling(dir));
                }

                // -----------------------------------------------------------------
                // 5.  Generate the new board & PGN-like move text
                // -----------------------------------------------------------------
                let newPosition;
                if (promotion) {                // 5-char UCI → pawn promotion
                    newPosition = copyPosition(board);
                    newPosition[fromRank][fromFile] = "";
                    newPosition[toRank][toFile] = aiColor + promotion;   // “bq”, “wn”, …
                } else {
                    newPosition = arbiter.performMove({
                        position: board,
                        piece,
                        rank: fromRank,
                        file: fromFile,
                        x: toRank,
                        y: toFile,
                    });
                }

                const newMove = getNewMoveNotation({
                    piece,
                    rank: fromRank,
                    file: fromFile,
                    x: toRank,
                    y: toFile,
                    position: board,
                    promotesTo: promotion
                });

                dispatch(makeNewMove({newPosition, newMove}));
                dispatch(clearCandidates());         // just housekeeping

                // -----------------------------------------------------------------
                // 6.  End-game detection (same rules you used in Pieces.js)
                // -----------------------------------------------------------------
                const oppTurn = aiColor === "w" ? "b" : "w";
                const castleDirSide = aiColor === "w" ? "white" : "black";

                if (arbiter.insufficientMaterial(newPosition)) {
                    dispatch(detectInsufficientMaterial());
                } else if (
                    arbiter.isStalemate(newPosition, oppTurn, appState.castleDirection[castleDirSide])
                ) {
                    dispatch(detectStalemate());
                } else if (
                    arbiter.isCheckMate(newPosition, oppTurn, appState.castleDirection[castleDirSide])
                ) {
                    dispatch(detectCheckmate(aiColor));
                }
            } catch (err) {
                console.error("❌ AI move failed:", err);
            } finally {
                isBusy.current = false;           // allow the next trigger
            }
        })();
    }, [
        appState.turn,
        appState.position,      // fires right after *every* move
        appState.opponentType,  // in case user restarts the game
        appState.status,
    ]);

    return null;   // invisible
};

export default AIAgent;
