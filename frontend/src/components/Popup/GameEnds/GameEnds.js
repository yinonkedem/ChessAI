import {GameMode, Status} from '../../../constants';
import { useAppContext }from '../../../contexts/Context'
import { setupNewGame } from '../../../reducer/actions/game';
import './GameEnds.css'
import { useNavigate }                from "react-router-dom";

const GameEnds = ({onClosePopup}) => {

    const { appState:{ status , mode } , dispatch } = useAppContext();
    const navigate = useNavigate();
    
    if (status === Status.ongoing || status === Status.promoting)
        return null

    const newGame = () => {
        dispatch(setupNewGame())
        onClosePopup?.();
        navigate(mode === GameMode.custom ? "/custom" : "/");
    }

    const isWin = status.endsWith('wins')

    return <div className="popup--inner popup--inner__center">
        <h1>{isWin ? status : 'Draw'}</h1>
        <p>{!isWin && status}</p>
        <div className={`${status}`}/>
        <button onClick={newGame}>New Game</button>
    </div>
   
}

export default GameEnds