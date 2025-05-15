import './GameEnds.css'
import {useAppContext} from "../../../contexts/Context";
import {clearCandidates, makeNewMove} from "../../../reducer/actions/move";
import {copyPosition} from "../../../helpers";
import {Status} from "../../../constant";
import {setupNewGame} from "../../../reducer/actions/game";

const GameEnds = ({onClosePopup}) => {
    const options = ['q', 'r', 'b', 'n']

    const { appState : {status}, dispatch } = useAppContext();

    if (status === Status.ongoing || status === Status.promoting) {
        return null
    }

    const newGame = () => {
        dispatch(setupNewGame())
    }
    console.log("GameEnds - status:", status);
    const isWin = status.endsWith('wins')

    return <div className='popup-inner popup-inner__center'>
        <h1>{isWin ? status : 'Draw'}</h1>
        <p>{!isWin && status}</p>
        <div className={status}></div>
        <button onClick={newGame}>New Game</button>
    </div>
}

export default GameEnds