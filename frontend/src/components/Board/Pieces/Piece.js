import {useAppContext} from "../../../contexts/Context";

const Piece = ({
    rank,
    file,
    piece,
}) => {

    const {appState, dispatch} = useAppContext() // get the app state from the context
    const {turn, position} = appState // get the turn and position from the state
    const currentPosition = position[position.length-1] // get the current position from the state

    const getMoves = () => {
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
                if (currentPosition?.[x]?.[y] === undefined) {
                    break
                }
                if (currentPosition[x][y].startsWith(enemy)) {
                    moves.push([x, y])
                    break
                }
                if (currentPosition[x][y].startsWith(us)) {
                    break
                }
                moves.push([x,y])
            }

        })

        return moves
    }

    const onDragStart = e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${piece},${rank},${file}`);
        setTimeout(() => {
            e.target.style.display = 'none';
        }, 0);
        if (turn === piece[0]) {
            const candidateMoves = arbiter.getRegularMoves({position: currentPosition, piece, rank, file})
            console.log('candidateMoves', candidateMoves)
        }
    }

    const onDragEnd = e => {
        e.target.style.display = 'block';
    }

    return (
        <div
            className={`piece ${piece} p-${file}${rank}`}
            draggable={true}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
        />
    )
}

export default Piece;
