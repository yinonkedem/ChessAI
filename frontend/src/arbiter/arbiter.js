import {
    getBishopMoves, getKingMoves,
    getKnightMoves, getPawnCaptures, getPawnMoves,
    getQueenMoves,
    getRookMoves
} from "./getMoves";
import {movePawn, movePiece} from "./move";

const arbiter = {
    getRegularMoves: function ({position, previousPosition, piece, rank, file}) {
        if (piece.endsWith('r')) {
            return getRookMoves({position, piece, rank, file})
        }

        if (piece.endsWith('n')) {
            return getKnightMoves({position, rank, file})
        }

        if (piece.endsWith('b')) {
            return getBishopMoves({position, piece, rank, file})
        }

        if (piece.endsWith('q')) {
            return getQueenMoves({position, piece, rank, file})
        }

        if (piece.endsWith('k')) {
            return getKingMoves({position, piece, rank, file})
        }

        if (piece.endsWith('p')) {
            return getPawnMoves({position, piece, rank, file})
        }

    },

    getValidMoves : function ({position, previousPosition, piece, rank, file}) {
        let moves = this.getRegularMoves({position, piece, rank, file})
        if (piece.endsWith('p')) {
            moves = [
                ...moves,
                ...getPawnCaptures({position, previousPosition, piece, rank, file})
            ]
        }
        return moves
    },

    performMove: function ({position, piece, rank, file, x, y}) {
        if (piece.endsWith('p')) {
            return movePawn({position, piece, rank, file, x, y})
        }
        else{
            return movePiece({position, piece, rank, file, x, y})
        }
    }


}

export default arbiter;