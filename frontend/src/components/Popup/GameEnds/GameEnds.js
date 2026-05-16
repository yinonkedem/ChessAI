import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GameMode, Status } from '../../../constants';
import { useAppContext } from '../../../contexts/Context';
import { useAuth } from '../../../auth/AuthContext';
import { setupNewGame } from '../../../reducer/actions/game';
import { saveGame } from '../../../api/games';
import { positionToFen } from '../../../utils/positionToFen';
import './GameEnds.css';

function deriveResult(status, userColor) {
    if (status === Status.stalemate || status === Status.insufficient) return "draw";
    if (status === Status.white) return userColor === "white" ? "win" : "loss";
    if (status === Status.black) return userColor === "black" ? "win" : "loss";
    return null;
}

function deriveReason(status) {
    if (status === Status.stalemate) return "stalemate";
    if (status === Status.insufficient) return "insufficient_material";
    if (status === Status.white || status === Status.black) return "checkmate";
    return "unknown";
}

const GameEnds = ({ onClosePopup }) => {
    const { appState, dispatch } = useAppContext();
    const { user } = useAuth();
    const navigate = useNavigate();
    const savedRef = useRef(false);

    const { status, gameMode, userColor, opponentType, position, turn, castleDirection, movesList } = appState;

    useEffect(() => {
        if (savedRef.current) return;
        if (status === Status.ongoing || status === Status.promoting) return;
        if (gameMode === GameMode.custom) return;
        if (!user || !opponentType || opponentType === "human") return;

        const result = deriveResult(status, userColor);
        if (!result) return;

        savedRef.current = true;
        const finalBoard = position.at(-1);
        const final_fen = positionToFen({ position: finalBoard, turn, castleDirection });

        saveGame({
            user_color: userColor === "white" ? "w" : "b",
            opponent_type: opponentType,
            result,
            reason: deriveReason(status),
            moves: movesList,
            final_fen,
        }).catch((err) => console.error("saveGame failed:", err));
    }, [status, gameMode, user, opponentType, userColor, position, turn, castleDirection, movesList]);

    if (status === Status.ongoing || status === Status.promoting) return null;

    const newGame = () => {
        const target = gameMode === GameMode.custom ? "/custom" : "/";
        dispatch(setupNewGame());
        onClosePopup?.();
        navigate(target);
    };

    const isWin = status.endsWith('wins');

    return (
        <div className="popup--inner popup--inner__center">
            <h1>{isWin ? status : 'Draw'}</h1>
            <p>{!isWin && status}</p>
            <div className={`${status}`} />
            <button onClick={newGame}>New Game</button>
        </div>
    );
};

export default GameEnds;
