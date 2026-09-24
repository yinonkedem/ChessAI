import { GameMode, Status, createInitGameState } from "../constants";
import actionTypes from "./actionTypes";
import { createEmptyPosition, getCastleRights, isInsufficientMaterial, scoreForMove } from "../helper";

export const reducer = (state, action) => {

    switch (action.type) {
        case actionTypes.NEW_MOVE: {
            // CustomEditor.js dispatches this same action for free piece
            // placement while setting up a position — never a real chess
            // move, so it's never scored.
            const delta = state.isCustomEditor
                ? { w: 0, b: 0 }
                : scoreForMove({
                    prevPosition: state.position[state.position.length - 1],
                    newPosition: action.payload.newPosition,
                    mover: state.turn,
                });

            return {
                ...state,
                position: [...state.position, action.payload.newPosition],
                movesList: [...state.movesList, action.payload.newMove],
                scoreLog: [...state.scoreLog, delta],
                turn: state.turn === 'w' ? 'b' : 'w',
            };
        }

        // The opening trainer owns the board outright: instead of applying one
        // move at a time, it recomputes the whole position history from the
        // line prefix and loads it here. That makes rewind, replay, next-card
        // and jump-to-ply all the same operation, and means a wrong move never
        // half-applies (nothing to undo, no flicker).
        case actionTypes.LOAD_POSITION_SEQUENCE: {
            const { positions, movesList, castleDirection, lastMove, turn, userColor } =
                action.payload;
            return {
                ...state,
                position: positions,
                movesList,
                castleDirection,
                turn,
                userColor: userColor ?? state.userColor,
                lastMove: lastMove ?? null,
                lastMoveStack: lastMove ? [lastMove] : [],
                // The trainer never dispatches NEW_MOVE (it replaces the whole
                // history here instead), so it's never scored — reset for
                // hygiene in case a scored game preceded it.
                scoreLog: [],
                candidateMoves: [],
                promotionSquare: null,
                status: Status.ongoing,
                // Set here rather than via SETUP_GAME, which would also reset
                // `turn` to 'w' and fight the position we just loaded.
                gameMode: GameMode.trainer,
                // No registered engine matches "book", so both agents in
                // EngineAgents bail (useEngineAgent.js:35). isGameSetup:false
                // is a second, independent guard.
                opponentType: "book",
                isGameSetup: false,
            };
        }

        case actionTypes.GENERATE_CANDIDATE_MOVES: {
            return { ...state, candidateMoves: action.payload.candidateMoves };
        }

        case actionTypes.CLEAR_CANDIDATE_MOVES: {
            return { ...state, candidateMoves: [] };
        }

        case actionTypes.PROMOTION_OPEN: {
            return {
                ...state,
                status: Status.promoting,
                promotionSquare: { ...action.payload },
            };
        }

        case actionTypes.PROMOTION_CLOSE: {
            return {
                ...state,
                status: Status.ongoing,
                promotionSquare: null,
            };
        }

        case actionTypes.CAN_CASTLE: {
            return {
                ...state,
                castleDirection: {
                    ...state.castleDirection,
                    [state.turn]: action.payload,
                },
            };
        }

        case actionTypes.STALEMATE: {
            return { ...state, status: Status.stalemate };
        }

        case actionTypes.INSUFFICIENT_MATERIAL: {
            return { ...state, status: Status.insufficient };
        }

        case actionTypes.WIN: {
            return {
                ...state,
                status: action.payload === 'w' ? Status.white : Status.black,
            };
        }

        case actionTypes.NEW_GAME: {
            return createInitGameState();
        }

        case actionTypes.SETUP_GAME: {
            const { colour, opponent } = action.payload;
            return {
                ...state,
                userColor: colour === 'rand'
                    ? (Math.random() < 0.5 ? 'white' : 'black')
                    : colour,
                opponentType: opponent,
                isGameSetup: true,
                turn: 'w',
            };
        }

        case actionTypes.ENTER_CUSTOM_MODE: {
            return {
                ...state,
                gameMode: GameMode.custom,
                isCustomEditor: true,
                position: [createEmptyPosition()],
                userColor: action.payload.colour,
                turn: "w",
            };
        }

        case actionTypes.START_FROM_CUSTOM: {
            const finalBoard = action.payload.position[0];

            const castleDirection = getCastleRights(finalBoard);
            const status = isInsufficientMaterial(finalBoard)
                ? Status.insufficient
                : Status.ongoing;

            return {
                ...state,
                isCustomEditor: false,
                isGameSetup: true,
                userColor: state.userColor,
                opponentType: action.payload.opponentType,
                turn: "w",
                position: [finalBoard],
                movesList: [],
                lastMove: null,
                lastMoveStack: [],
                scoreLog: [],
                candidateMoves: [],
                castleDirection,
                status,
            };
        }

        case actionTypes.TAKE_BACK: {
            // Against a human, always undo one ply. Against an engine, undo
            // one ply if it hasn't answered yet — state.turn already flipped
            // to the engine's colour the moment the human moved, so this is
            // true for as long as its reply is still in flight — which just
            // un-plays the pending human move and leaves it human again;
            // any in-flight engine request self-discards in useEngineAgent
            // (its captured position no longer matches state.position).
            // Once the engine HAS answered, undo the pair (its reply plus
            // the move it answered) so the human lands back at their own
            // turn to retry, rather than facing a position the engine
            // already moved from.
            let wantSteps;
            if (state.opponentType === "human") {
                wantSteps = 1;
            } else {
                const aiColor = state.userColor === "white" ? "b" : "w";
                wantSteps = state.turn === aiColor ? 1 : 2;
            }
            const steps = Math.min(wantSteps, state.movesList.length);

            if (steps === 0) return state;

            const position = state.position.slice(0, -steps);
            const movesList = state.movesList.slice(0, -steps);
            const lastMoveStack = state.lastMoveStack.slice(0, -steps);
            // Pushed 1:1 with movesList in NEW_MOVE, so undoing a capturing
            // or promoting move undoes the points it earned too.
            const scoreLog = state.scoreLog.slice(0, -steps);

            const turn =
                steps % 2 === 0
                    ? state.turn
                    : state.turn === "w" ? "b" : "w";

            return {
                ...state,
                position,
                movesList,
                turn,
                lastMoveStack,
                lastMove: lastMoveStack.at(-1) ?? null,
                scoreLog,
                candidateMoves: [],
                promotionSquare: null,
                status: Status.ongoing,
            };
        }

        case actionTypes.APPLY_HINT:
            return { ...state, candidateMoves: action.payload };

        case actionTypes.SET_ENGINE_DEPTH:
            return { ...state, engineDepth: action.payload };

        case actionTypes.SET_HINT_DEPTH:
            return { ...state, hintDepth: action.payload };

        case actionTypes.RESET_ALL:
            return createInitGameState();

        case actionTypes.SET_LAST_MOVE: {
            const lastMoveStack = [...state.lastMoveStack, action.payload];
            return { ...state, lastMove: action.payload, lastMoveStack };
        }

        default:
            return state;
    }
};
