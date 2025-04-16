import { createPosition } from "./helpers";

export const Status = {
    'ongoing' : 'Ongoing',
    'promoting' : 'Promoting',
    'whites' : 'White wins',
    'blacks' : 'Black wins',
}

export const initGameState = {
    position : [createPosition()],
    turn : 'w',
    candidateMoves : [],
    status : Status.ongoing,
    promotionSquare : null
}