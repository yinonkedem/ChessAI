import './Pieces.css';
import Piece from './Piece';
import {useRef} from 'react';
import { copyPosition } from '../../../helpers';
import { useAppContext } from '../../../contexts/Context';
import { makeNewMove } from '../../../reducer/actions/move';

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

    const onDrop = e => {
        const newPosition = copyPosition(currentPosition) // copy the position
        const {x, y} = calculateCoords(e) // get the coords of the drop
        const [piece, rank, file] = e.dataTransfer.getData('text').split(','); // get the data from the drag
        newPosition[rank][file] = '' // remove the piece from the old position
        newPosition[x][y] = piece // add the piece to the new position
        dispatch(makeNewMove({newPosition})) // dispatch the new position to the reducer
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
