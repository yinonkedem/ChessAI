import './Pieces.css';
import Piece from './Piece';
import {useRef} from 'react';
import { useAppContext } from '../../contexts/Context';
import {clearCandidates, makeNewMove} from '../../reducer/actions/move';
import arbiter from "../../arbiter/arbiter";
import {openPromotion} from "../../reducer/actions/popup";
import {updateCastling} from "../../reducer/actions/game";
import {getCastleDirection} from "../../arbiter/getMoves";

const Pieces =  () => {

    const ref = useRef();

    const {appState,dispatch} = useAppContext() // get the app state from the context

    const currentPosition = appState.position[appState.position.length-1] // get the current position from the state

    const calculateCoords = e => {
        const {width, left, top} = ref.current.getBoundingClientRect()
            const size = width / 8; // 8 files and 8 ranks
            const x = 7 - Math.floor((e.clientY - top) / size); // get file
            const y = Math.floor((e.clientX - left) / size); // get rank
            return {x, y}
    }

    const openPromotionBox = ({rank, file, x, y}) =>
        dispatch(openPromotion({
            rank : Number(rank),
            file : Number(file),
            x, y
        }))

    const updateCastlingState = ({piece, rank, file}) => {
        const direction = getCastleDirection({
            castleDirection: appState.castleDirection,
            piece, rank, file
        })
        if (direction) {
            dispatch(updateCastling(direction))
        }
    }

    const move = e => {
        const {x, y} = calculateCoords(e) // get the coords of the drop
        const [piece, rank, file] = e.dataTransfer.getData('text').split(','); // get the data from the drag

        if (appState.candidateMoves?.find(m => m[0] === x && m[1] === y)) {
            const opponent = piece.startsWith('b') ? 'w' : 'b' // get the opponent
            const castleDirection = appState.castleDirection[`${piece.startsWith('b') ? 'w' : 'b'}`] // get the castle direction
            if ((piece === 'wp' && x === 7 ) || (piece === 'bp' && x === 0)){
                openPromotionBox({rank, file, x, y})
                return
            }
            if (piece.endsWith('r') || piece.endsWith('k')) {
                updateCastlingState({piece, rank, file})
            }
            const newPosition = arbiter.performMove({
                position: currentPosition,
                piece,
                rank,
                file,
                x,
                y
            })
            dispatch(makeNewMove({newPosition})) // dispatch the new position to the reducer

            if (arbiter.inStalemate(newPosition, opponent, castleDirection))
                dispatch(detectStalemate())
        }
        dispatch(clearCandidates()) // clear the candidates
    }

    const onDrop = e => {
        e.preventDefault();
        move (e) // move the piece
    }

    const onDragOver = e => e.preventDefault();

    return <div
        ref={ref}
        onDrop = {onDrop}
        onDragOver = {onDragOver}
        className="pieces">
        {currentPosition.map((r,rank ) =>
            r.map((f,file) =>
                currentPosition[rank][file] ? <Piece
                    key={rank+'-'+file}
                    rank={rank}
                    file={file}
                    piece={currentPosition[rank][file]}
                /> : null
            ))}


        </div>
}

export default Pieces;
