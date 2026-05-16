import { useAppContext } from "../../../contexts/Context";
import { positionToFen } from "../../../utils/positionToFen";
import { getBestMove } from "../../../api/chessBackend";
import { uciToCoords } from "../../../utils/uciToCoords";
import { Status } from "../../../constants";
import actionTypes from "../../../reducer/actionTypes";

export default function HintButton() {
    const { appState, dispatch } = useAppContext();
    const { position, turn, castleDirection, status } = appState;

    const handleHint = async () => {
        try {
            const fen = positionToFen({
                position: position[position.length - 1],
                turn,
                castleDirection,
            });
            const { best_move } = await getBestMove({ fen, depth: 10 });
            const moves = uciToCoords(best_move);
            dispatch({ type: actionTypes.APPLY_HINT, payload: moves });
        } catch (err) {
            console.error(err);
            alert("Backend error: " + err.message);
        }
    };

    return (
        <div className="hint-button">
            <button onClick={handleHint} disabled={status === Status.promoting}>
                Get Hint
            </button>
        </div>
    );
}
