import { GameMode, Status, createInitGameState } from "../constants";
import actionTypes from "./actionTypes";
import { createEmptyPosition, getCastleRights, isInsufficientMaterial } from "../helper";

export const reducer = (state, action) => {

    switch (action.type) {
        case actionTypes.NEW_MOVE: {
            return {
                ...state,
                position: [...state.position, action.payload.newPosition],
                movesList: [...state.movesList, action.payload.newMove],
                turn: state.turn === 'w' ? 'b' : 'w',
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
                candidateMoves: [],
                castleDirection,
                status,
            };
        }

        case actionTypes.TAKE_BACK: {
            const wantSteps = state.opponentType === "human" ? 1 : 2;
            const steps = Math.min(wantSteps, state.movesList.length);

            if (steps === 0) return state;

            const position = state.position.slice(0, -steps);
            const movesList = state.movesList.slice(0, -steps);
            const lastMoveStack = state.lastMoveStack.slice(0, -steps);

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
                candidateMoves: [],
                promotionSquare: null,
                status: Status.ongoing,
            };
        }

        case actionTypes.APPLY_HINT:
            return { ...state, candidateMoves: action.payload };

        case actionTypes.SET_ENGINE_THINK_MS:
            return { ...state, engineThinkMs: action.payload };

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
