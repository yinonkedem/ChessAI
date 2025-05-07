import {useAppContext} from "../../contexts/Context";
import arbiter from "../../arbiter/arbiter";
import {generateCandidateMoves} from "../../reducer/actions/move";

const Piece = ({
    rank,
    file,
    piece,
}) => {

    const {appState, dispatch} = useAppContext() // get the app state from the context
    const {turn, castleDirection, position} = appState // get the turn and position from the state

    const currentPosition = position[position.length-1] // get the current position from the state
    const previousPosition = position[position.length-2] // get the previous position from the state

    const onDragStart = e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${piece},${rank},${file}`);
        setTimeout(() => {
            e.target.style.display = 'none';
        }, 0);
        if (turn === piece[0]) {
            const candidateMoves = arbiter.getValidMoves({
                position: currentPosition,
                previousPosition: previousPosition,
                castleDirection: castleDirection[turn],
                piece,
                rank,
                file
            })
            dispatch(generateCandidateMoves({candidateMoves}))
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
