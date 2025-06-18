import { createPosition } from './helper'

export const Status = {
    'ongoing' : 'Ongoing',
    'promoting' : 'Promoting',
    'white' : 'White wins',
    'black' : 'Black wins',
    'stalemate' : 'Game draws due to stalemate',
    'insufficient' : 'Game draws due to insufficient material',
}

export const GameMode = { standard: "standard", custom: "custom" };

export const initGameState = {
    position : [createPosition()],
    gameMode       : GameMode.standard,
    isCustomEditor : false, // ↙ true while the user is still laying pieces
    turn : 'w',
    candidateMoves : [],
    movesList : [],
    userColor : null,      // 'w' or 'b'
    isGameSetup : false,     // becomes true after SETUP_GAME
    engineDepth : 10,
    opponentType : null,
    promotionSquare : null,
    status : Status.ongoing,
    castleDirection : {
        w : 'both',
        b : 'both'
    }, 
}