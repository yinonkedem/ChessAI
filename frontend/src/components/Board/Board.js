import { getCharacter } from '../../helpers';
import './Board.css';
import Ranks from './bits/Ranks';
import Files from './bits/Files';
import Pieces from '../Pieces/Pieces';
import {useAppContext} from "../../contexts/Context";
import Popup from "../Popup/Popup";

const Board = () => {

    const ranks = Array(8).fill().map((x, i) => 8-i)
    const files = Array(8).fill().map((x, i) => i+1)

    const {appState} = useAppContext() // get the app state from the context
    const position = appState.position[appState.position.length-1] // get the current position from the state

    const getClassName = (i,j) => {
        let c = 'tile'
        c += (i+j) % 2 === 0 ? ' tile--dark' : ' tile--light'

        if (appState.candidateMoves?.find(m => m[0] === i && m[1] === j)) {
            if (position[i][j]) {
                c += ' attacking'
            }
            else {
                c += ' highlight'
            }
        }

        return c
    }
    
    return <div className="board">

        <Ranks ranks={ranks}/>

        <div className="tiles">
            {ranks.map((rank,i) => 
                files.map((file,j) => 
                    <div 
                        key={file+'-'+rank} 
                        className={getClassName(7-i,j)}>
                    </div>
                ))}
        </div>

        <Pieces />

        <Popup />

        <Files files={files} />

    </div>

}

export default Board;