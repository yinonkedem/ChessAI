import {copyPosition} from "../helpers";

// Move a piece
export const movePiece = ({position, piece, rank, file, x, y}) => {
    const newPosition = copyPosition(position)
    newPosition[rank][file] = ''
    newPosition[x][y] = piece
    return newPosition
}

// Move a pawn
export const movePawn = ({position, piece, rank, file, x, y}) => {
    const newPosition = copyPosition(position)
    if (!newPosition[x][y] && x !== rank && y !== file) {
        newPosition[rank][y] = ''
    }
    newPosition[rank][file] = ''
    newPosition[x][y] = piece

    return newPosition
}