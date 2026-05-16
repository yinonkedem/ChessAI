import { useAppContext } from "../../../contexts/Context";
import { positionToFen } from "../../../utils/positionToFen";
import { getBestMove } from "../../../api/chessBackend";
import { uciToCoords } from "../../../utils/uciToCoords";
import { Status } from "../../../constants";
import actionTypes from "../../../reducer/actionTypes";
import { setHintDepth } from "../../../reducer/actions/game";

export default function HintButton() {
    const { appState, dispatch } = useAppContext();
    const { position, turn, castleDirection, status, hintDepth } = appState;

    const handleHint = async () => {
        try {
            const fen = positionToFen({
                position: position[position.length - 1],
                turn,
                castleDirection,
            });
            const { best_move } = await getBestMove({ fen, depth: hintDepth });
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
            <div className="hint-depth-control">
                <label htmlFor="hint-depth">
                    Depth:&nbsp;<strong>{hintDepth}</strong>
                </label>
                <input
                    id="hint-depth"
                    type="range"
                    min="1"
                    max="20"
                    value={hintDepth}
                    onChange={(e) => dispatch(setHintDepth(+e.target.value))}
                    disabled={status === Status.promoting}
                />
            </div>
        </div>
    );
}
