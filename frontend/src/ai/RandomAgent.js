// ai/RandomAgent.js  – clone of AIAgent with tiny edits
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
    clearCandidates,
    setLastMove
} from "../reducer/actions/move";
import {
    updateCastling,
    detectStalemate,
    detectInsufficientMaterial,
    detectCheckmate
} from "../reducer/actions/game";
import {Status} from "../constants";    // adjust relative path

const RandomAgent = () => {
    const {appState, dispatch} = useAppContext();
    const isBusy = useRef(false);

    useEffect(() => {
        if (appState.status !== Status.ongoing ||
            appState.opponentType !== "rand" ||
            isBusy.current) return;

        const botColor = appState.userColor === "white" ? "b" : "w";
        if (appState.turn !== botColor) return;

        isBusy.current = true;
        (async () => {
            try {
                // 1️⃣ FEN for the current board
                const board = appState.position.at(-1);
                const fen = positionToFen({
                    position: board,
                    turn: appState.turn,
                    castleDirection: appState.castleDirection,
                });

                // 2️⃣ Ask backend for a random legal move
                const {best_move} = await getBestMove({
                    fen,
                    depth: 1,          // ignored by the random engine
                    engine: "random",  // ⬅️ key line
                });
                if (!best_move) throw new Error("Random engine returned nothing");

                // 3️⃣ Convert UCI → board coords
                const coords = uciToCoords(best_move);
                const [[fr, ff], [tr, tf]] = coords;
                const promotion = coords.promotion || null;
                const piece = board[fr][ff];

                // 4️⃣ Update castling rights if king / rook moved
                if (piece.endsWith("k") || piece.endsWith("r")) {
                    const dir = getCastlingDirections({
                        castleDirection: appState.castleDirection,
                        piece,
                        file: ff,
                        rank: fr,
                    });
                    if (dir) dispatch(updateCastling(dir));
                }

                // 5️⃣ Build the new board
                let newPosition;
                if (promotion) {
                    newPosition = copyPosition(board);
                    newPosition[fr][ff] = "";
                    newPosition[tr][tf] = botColor + promotion;
                } else {
                    newPosition = arbiter.performMove({
                        position: board,
                        piece,
                        rank: fr,
                        file: ff,
                        x: tr,
                        y: tf,
                    });
                }

                const newMove = getNewMoveNotation({
                    piece,
                    rank: fr,
                    file: ff,
                    x: tr,
                    y: tf,
                    position: board,
                    promotesTo: promotion,
                });

                dispatch(makeNewMove({newPosition, newMove}));
                dispatch(clearCandidates());
                dispatch(setLastMove({ from:[fr, ff], to:[tr, tf] }));

                // 6️⃣ End-game checks
                const opp = botColor === "w" ? "b" : "w";
                const side = botColor === "w" ? "white" : "black";

                if (arbiter.insufficientMaterial(newPosition))
                    dispatch(detectInsufficientMaterial());
                else if (arbiter.isStalemate(newPosition, opp,
                    appState.castleDirection[side]))
                    dispatch(detectStalemate());
                else if (arbiter.isCheckMate(newPosition, opp,
                    appState.castleDirection[side]))
                    dispatch(detectCheckmate(botColor));
            } catch (err) {
                console.error("❌ RandomAgent failed:", err);
            } finally {
                isBusy.current = false;
            }
        })();
    }, [appState.turn, appState.position, appState.opponentType, appState.status, appState.userColor, appState.castleDirection, dispatch]);

    return null;
};

export default RandomAgent;
