import {GameMode, initGameState, Status} from "../constants";
import actionTypes from "./actionTypes";
import {createEmptyPosition} from "../helper";
import * as helper from "../helper";

export const reducer = (state, action) => {

    switch (action.type) {
        case actionTypes.NEW_MOVE : {
            let {position, movesList, turn} = state
            position = [
                ...position,
                action.payload.newPosition
            ]
            movesList = [
                ...movesList,
                action.payload.newMove
            ]
            turn = turn === 'w' ? 'b' : 'w'

            return {
                ...state,
                position,
                movesList,
                turn,
            }
        }

        case actionTypes.GENERATE_CANDIDATE_MOVES : {
            const {candidateMoves} = action.payload
            return {
                ...state,
                candidateMoves
            }
        }

        case actionTypes.CLEAR_CANDIDATE_MOVES : {
            return {
                ...state,
                candidateMoves: []
            }
        }

        case actionTypes.PROMOTION_OPEN : {
            return {
                ...state,
                status: Status.promoting,
                promotionSquare: {...action.payload},
            }
        }

        case actionTypes.PROMOTION_CLOSE : {
            return {
                ...state,
                status: Status.ongoing,
                promotionSquare: null,
            }
        }

        case actionTypes.CAN_CASTLE : {
            let {turn, castleDirection} = state

            castleDirection[turn] = action.payload

            return {
                ...state,
                castleDirection,
            }
        }

        case actionTypes.STALEMATE : {
            return {
                ...state,
                status: Status.stalemate
            }
        }

        case actionTypes.INSUFFICIENT_MATERIAL : {
            return {
                ...state,
                status: Status.insufficient
            }
        }

        case actionTypes.WIN : {
            return {
                ...state,
                status: action.payload === 'w' ? Status.white : Status.black
            }
        }

        case actionTypes.NEW_GAME : {
            return {
                ...action.payload,
            }
        }

        case actionTypes.SETUP_GAME : {
            const {colour, opponent} = action.payload;
            return {
                ...state,
                userColor: colour === 'rand'
                    ? (Math.random() < 0.5 ? 'white' : 'black')
                    : colour,
                opponentType: opponent, // "ai" | "human" | "rand"
                isGameSetup: true,
                turn: 'w'                      // ensure white always moves first
            };
        }

        case actionTypes.ENTER_CUSTOM_MODE: {
            return {
                ...state,
                gameMode: GameMode.custom,
                isCustomEditor: true,
                position: [createEmptyPosition()], // blank board
                colour        : action.payload.colour,
                userColor: action.payload.colour,
                turn: "w",
                opponent: null,                     // not chosen yet
            };
        }

        case actionTypes.START_FROM_CUSTOM: {
            const finalBoard = action.payload.position[0];   // sent by CustomEditor

            const castleDirection = helper.getCastleRights(finalBoard);
            const status = helper.isInsufficientMaterial(finalBoard)
                ? Status.insufficient
                : Status.ongoing;

            return {
                ...state,

                /* leave the editor */
                isCustomEditor : false,
                isGameSetup    : true,

                /* orientation & opponent info */
                userColor      : state.colour,                    // side you chose
                opponentType   : action.payload.opponentType,     // "ai" | "human"
                opponent       : action.payload.opponentType,     // legacy field
                turn           : "w",

                /* brand-new history & metadata */
                position       : [finalBoard],
                movesList      : [],
                candidateMoves : [],
                castleDirection,
                status,
            };
        }


        case actionTypes.TAKE_BACK: {
            // How many half-moves to revert?
            const wantSteps = state.opponentType === "human" ? 1 : 2;
            const steps = Math.min(wantSteps, state.movesList.length);

            // Nothing to do?
            if (steps === 0) return state;

            const position = state.position.slice(0, -steps);
            const movesList = state.movesList.slice(0, -steps);

            // Turn flips every half-move → flip only when steps is odd
            const turn =
                steps % 2 === 0 ? state.turn
                    : state.turn === "w" ? "b" : "w";

            return {
                ...state,
                position,
                movesList,
                turn,
                lastMove: movesList.at(-1) ?? null,
                candidateMoves: [],
                promotionSquare: null,
                status: "Ongoing",
            };
        }


        case actionTypes.APPLY_HINT :
            return {...state, candidateMoves: action.payload};


        case actionTypes.SET_ENGINE_DEPTH:
            return {...state, engineDepth: action.payload};

        case actionTypes.RESET_ALL:
            return { ...initGameState };

        case actionTypes.SET_LAST_MOVE:
            return {
                ...state,
                lastMove: action.payload
            };

        default :
            return state
    }
};
