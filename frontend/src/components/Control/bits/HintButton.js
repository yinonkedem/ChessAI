// components/HintButton.js
import { useAppContext } from "../../../contexts/Context";
import { positionToFen } from "../../../utils/positionToFen";
import { getBestMove } from "../../../api/chessBackend";
import {uciToCoords} from "../../../utils/uciToCoords";

export default function HintButton() {
    const { appState, dispatch } = useAppContext();
    const { position, turn, castleDirection } = appState;

    const handleHint = async () => {
        try {
            const fen = positionToFen({ position: position[position.length - 1], turn, castleDirection });
            const { best_move } = await getBestMove({ fen, depth: 10 });

            // send to reducer – you already highlight candidateMoves
            const moves = uciToCoords(best_move);
            dispatch({ type: "APPLY_HINT", payload: moves });
        } catch (err) {
            console.error(err);
            alert("Backend error: " + err.message);
        }
    };

    return <div className="hint-button">
            <button onClick={handleHint} disabled={appState.status === "promoting"}>
                Get Hint
            </button>
        </div>
}
