import { createPosition } from './helper'

export const Status = {
    ongoing: 'Ongoing',
    promoting: 'Promoting',
    white: 'White wins',
    black: 'Black wins',
    stalemate: 'Game draws due to stalemate',
    insufficient: 'Game draws due to insufficient material',
}

export const GameMode = { standard: "standard", custom: "custom" };

export const createInitGameState = () => ({
    position: [createPosition()],
    gameMode: GameMode.standard,
    isCustomEditor: false,
    turn: 'w',
    candidateMoves: [],
    movesList: [],
    lastMove: null,
    lastMoveStack: [],
    userColor: "white",
    isGameSetup: false,
    engineDepth: 10,
    opponentType: "human",
    promotionSquare: null,
    status: Status.ongoing,
    castleDirection: { w: 'both', b: 'both' },
});
