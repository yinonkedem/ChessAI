import './Pieces.css';
import Piece from './Piece';

const Pieces =  () => {
    const position = new Array(8).fill('').map(x => new Array(8).fill(''));
    position[0][0] = 'wr'
    position[7][7] = 'br'
    // position[0][2] = 'b'
    // position[0][3] = 'q'
    // position[0][4] = 'k'
    // position[0][5] = 'b'
    // position[0][6] = 'n'
    console.log(position)

    return <div className="pieces">
        {position.map((r,rank ) =>
            r.map((f,file) => 
                position[rank][file] ? <Piece
                    key={rank+'-'+file}
                    rank={rank}
                    file={file}
                    piece={position[rank][file]}
                /> : null
            ))} 
        
        
        </div> 
}

export default Pieces;
