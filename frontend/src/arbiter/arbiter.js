import {
    getBishopMoves, getKingMoves,
    getKnightMoves, getPawnCaptures, getPawnMoves,
    getQueenMoves,
    getRookMoves,
    getCastingMoves
} from "./getMoves";
import {movePawn, movePiece} from "./move";

const arbiter = {
    getRegularMoves: function ({position, piece, rank, file}) {
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

    getValidMoves : function ({position, castleDirection, previousPosition, piece, rank, file}) {
        let moves = this.getRegularMoves({position, piece, rank, file})
        const notInCheckMoves = []


        if (piece.endsWith('p')) {
            moves = [
                ...moves,
                ...getPawnCaptures({position, previousPosition, piece, rank, file})
            ]
        }
        if (piece.endsWith('k')) {
            moves = [
                ...moves,
                ...getCastingMoves({position, castleDirection, piece, rank, file})
            ]
        }
        moves.forEach(({x, y}) => {
            const positionAfterMove = this.performMove({position, piece, rank, file, x, y})

            if (!this.isPlayerInCheck({positionAfterMove, position, player: piece[0]})) {
                notInCheckMoves.push([x, y])
            }
        })
        return moves
    },

    performMove: function ({position, piece, rank, file, x, y}) {
        if (piece.endsWith('p')) {
            return movePawn({position, piece, rank, file, x, y})
        }
        else{
            return movePiece({position, piece, rank, file, x, y})
        }
    },

    isPlayerInCheck: function ({position, piece, rank, file, x, y}) {
        
    }
}

export default arbiter;