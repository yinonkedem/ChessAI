export const getRookMoves = ({position, piece, rank, file}) => {
    const moves = []
    const us = piece[0]
    const enemy = us === 'w' ? 'b' : 'w'

    const direction = [
        [-1,0],
        [1,0],
        [0,-1],
        [0,1],
    ]
    direction.forEach(direction => {
        for (let i = 1; i < 8; i++) {
            const x = rank + (direction[0] * i)
            const y = file + (direction[1] * i)
            if (position?.[x]?.[y] === undefined) {
                break
            }
            if (position[x][y].startsWith(enemy)) {
                moves.push([x, y])
                break
            }
            if (position[x][y].startsWith(us)) {
                break
            }
            moves.push([x,y])
        }

    })

    return moves
}

export const getKnightMoves = ({position, rank, file}) => {
    const moves = []
    const enemy = position[rank][file].startsWith('w') ? 'b' : 'w'

    const direction = [
        [-2, -1],
        [-2, 1],
        [2, -1],
        [2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
    ]
    direction.forEach(c => {
        const cell = position?.[rank+c[0]]?.[file+c[1]]
        if (cell !== undefined && (cell.startsWith(enemy) || cell === '')) {
            moves.push([rank+c[0], file+c[1]])
        }
        return moves
    })

    return moves
}

export const getBishopMoves = ({position, piece, rank, file}) => {
    const moves = []
    const us = piece[0]
    const enemy = us === 'w' ? 'b' : 'w'

    const direction = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
    ]
    direction.forEach(direction => {
        for (let i = 1; i < 8; i++) {
            const x = rank + (direction[0] * i)
            const y = file + (direction[1] * i)
            if (position?.[x]?.[y] === undefined) {
                break
            }
            if (position[x][y].startsWith(enemy)) {
                moves.push([x, y])
                break
            }
            if (position[x][y].startsWith(us)) {
                break
            }
            moves.push([x,y])
        }

    })

    return moves
}

export const getQueenMoves = ({position, piece, rank, file}) => {
    const moves = [
        ...getRookMoves({position, piece, rank, file}),
        ...getBishopMoves({position, piece, rank, file}),
    ]
    return moves
}

export const getKingMoves = ({position, piece, rank, file}) => {
    const moves = []
    const us = piece[0]
    const enemy = us === 'w' ? 'b' : 'w'

    const direction = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ]
    direction.forEach(c => {
        const cell = position?.[rank+c[0]]?.[file+c[1]]
        if (cell !== undefined && (cell.startsWith(enemy) || cell === '')) {
            moves.push([rank+c[0], file+c[1]])
        }
    })

    return moves
}

export const getPawnMoves = ({position, piece, rank, file}) => {
    const moves = []
    const dir = piece === 'wp' ? 1 : -1

    if (!position?.[rank+dir]?.[file]) {
        moves.push([rank+dir, file])
    }

    if (rank % 5 === 1){
        if (position?.[rank+dir]?.[file] === '' && position?.[rank+dir+dir]?.[file] === '') {
            moves.push([rank+dir+dir, file])
        }
    }

    return moves
}

export const getPawnCaptures = ({position, previousPosition, piece, rank, file}) => {
    const moves = []
    const dir = piece === 'wp' ? 1 : -1
    const enemy = piece[0] === 'w' ? 'b' : 'w'

    // capture enemy left
    if (position?.[rank+dir]?.[file-1] && position[rank+dir][file-1].startsWith(enemy)) {
        moves.push([rank+dir, file-1])
    }

    // capture enemy right
    if (position?.[rank+dir]?.[file+1] && position[rank+dir][file+1].startsWith(enemy)) {
        moves.push([rank+dir, file+1])
    }

    // en-passant
    const enemyPawn = dir === 1 ? 'bp' : 'wp'
    const adjacentFile = [file-1, file+1]
    if (previousPosition) {
        if ((dir === 1 && rank === 4) || (dir === -1 && rank === 3)) {
            adjacentFile.forEach(file => {
                if (position?.[rank]?.[file] === enemyPawn &&
                    position?.[rank+dir+dir]?.[file] === '' &&
                    previousPosition?.[rank]?.[file] === '' &&
                    previousPosition?.[rank+dir+dir]?.[file] === enemyPawn) {
                    moves.push([rank+dir, file])
                }
            })
        }
    }



    return moves
}