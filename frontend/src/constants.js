import { createPosition } from './helper'

export const Status = {
    ongoing: 'Ongoing',
    promoting: 'Promoting',
    white: 'White wins',
    black: 'Black wins',
    stalemate: 'Game draws due to stalemate',
    insufficient: 'Game draws due to insufficient material',
}

export const GameMode = { standard: "standard", custom: "custom", trainer: "trainer" };

export const createInitGameState = () => ({
    position: [createPosition()],
    gameMode: GameMode.standard,
    isCustomEditor: false,
    turn: 'w',
    candidateMoves: [],
    movesList: [],
    lastMove: null,
    lastMoveStack: [],
    // One entry per ply in movesList: { mover: 'w'|'b', points }. Kept as a
    // log rather than a running total so TAKE_BACK can slice it in lockstep
    // and undo a capture's or promotion's points along with the move.
    scoreLog: [],
    userColor: "white",
    isGameSetup: false,
    engineDepth: 15,
    hintDepth: 10,
    opponentType: "human",
    promotionSquare: null,
    status: Status.ongoing,
    castleDirection: { w: 'both', b: 'both' },
});
