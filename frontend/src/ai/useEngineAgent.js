import { useEffect, useRef } from "react";
import { useAppContext } from "../contexts/Context";

import { positionToFen } from "../utils/positionToFen";
import { uciToCoords } from "../utils/uciToCoords";
import { getBestMove } from "../api/chessBackend";

import arbiter from "../arbiter/arbiter";
import { copyPosition, getNewMoveNotation } from "../helper";
import { getCastlingDirections } from "../arbiter/getMoves";

import {
    makeNewMove,
    clearCandidates,
    setLastMove,
} from "../reducer/actions/move";
import {
    updateCastling,
    detectStalemate,
    detectInsufficientMaterial,
    detectCheckmate,
} from "../reducer/actions/game";
import { Status } from "../constants";

export default function useEngineAgent({ engine, opponentType }) {
    const { appState, dispatch } = useAppContext();
    const isBusy = useRef(false);
    const latestStateRef = useRef(appState);
    latestStateRef.current = appState;

    useEffect(() => {
        if (
            appState.status !== Status.ongoing ||
            appState.opponentType !== opponentType ||
            appState.isCustomEditor ||
            !appState.isGameSetup ||
            isBusy.current
        ) return;

        const aiColor = appState.userColor === "white" ? "b" : "w";
        if (appState.turn !== aiColor) return;

        isBusy.current = true;
        const requestPosition = appState.position;
        const requestTurn = appState.turn;

        (async () => {
            try {
                const board = appState.position.at(-1);
                const fen = positionToFen({
                    position: board,
                    turn: appState.turn,
                    castleDirection: appState.castleDirection,
                });

                const { best_move } = await getBestMove({
                    fen,
                    movetime_ms: appState.engineThinkMs,
                    engine,
                });
                if (!best_move) throw new Error("Engine returned no move");

                const latest = latestStateRef.current;
                if (
                    latest.position !== requestPosition ||
                    latest.turn !== requestTurn ||
                    latest.status !== Status.ongoing ||
                    !latest.isGameSetup ||
                    latest.opponentType !== opponentType
                ) return;

                const coords = uciToCoords(best_move);
                const [[fromRank, fromFile], [toRank, toFile]] = coords;
                const promotion = coords.promotion || null;
                const piece = board[fromRank][fromFile];
                if (!piece) throw new Error("No piece on the 'from' square");

                if (piece.endsWith("k") || piece.endsWith("r")) {
                    const dir = getCastlingDirections({
                        castleDirection: appState.castleDirection,
                        piece,
                        file: fromFile,
                        rank: fromRank,
                    });
                    if (dir) dispatch(updateCastling(dir));
                }

                let newPosition;
                if (promotion) {
                    newPosition = copyPosition(board);
                    newPosition[fromRank][fromFile] = "";
                    newPosition[toRank][toFile] = aiColor + promotion;
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
                    promotesTo: promotion,
                });

                dispatch(makeNewMove({ newPosition, newMove }));
                dispatch(clearCandidates());
                dispatch(setLastMove({ from: [fromRank, fromFile], to: [toRank, toFile] }));

                const oppTurn = aiColor === "w" ? "b" : "w";
                const oppCastleDir = appState.castleDirection[oppTurn];

                if (arbiter.insufficientMaterial(newPosition)) {
                    dispatch(detectInsufficientMaterial());
                } else if (arbiter.isStalemate(newPosition, oppTurn, oppCastleDir)) {
                    dispatch(detectStalemate());
                } else if (arbiter.isCheckMate(newPosition, oppTurn, oppCastleDir)) {
                    dispatch(detectCheckmate(aiColor));
                }
            } catch (err) {
                console.error("Engine move failed:", err);
            } finally {
                isBusy.current = false;
            }
        })();
    }, [
        engine,
        opponentType,
        appState.turn,
        appState.position,
        appState.opponentType,
        appState.status,
        appState.userColor,
        appState.castleDirection,
        appState.engineThinkMs,
        appState.isCustomEditor,
        appState.isGameSetup,
        dispatch,
    ]);
}
