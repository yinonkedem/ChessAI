import { createPosition } from './helper'

export const Status = {
    'ongoing' : 'Ongoing',
    'promoting' : 'Promoting',
    'white' : 'White wins',
    'black' : 'Black wins',
    'stalemate' : 'Game draws due to stalemate',
    'insufficient' : 'Game draws due to insufficient material',
}

export const initGameState = {
    position : [createPosition()],
    turn : 'w',
    candidateMoves : [],
    movesList : [],
    userColor       : null,      // 'w' or 'b'
    isGameSetup     : false,     // becomes true after SETUP_GAME
    promotionSquare : null,
    status : Status.ongoing,
    castleDirection : {
        w : 'both',
        b : 'both'
    }, 
}