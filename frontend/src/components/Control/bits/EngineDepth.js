import { useAppContext } from "../../../contexts/Context";
import { setEngineDepth } from "../../../reducer/actions/game";
import { Status } from "../../../constants";

export default function EngineDepth() {
    const { appState, dispatch } = useAppContext();
    const { engineDepth, opponentType, status, isGameSetup } = appState;

    if (!isGameSetup || opponentType !== "ai") return null;

    return (
        <div className="engine-depth-control">
            <label htmlFor="engine-depth">
                Engine depth:&nbsp;<strong>{engineDepth}</strong>
            </label>
            <input
                id="engine-depth"
                type="range"
                min="1"
                max="20"
                value={engineDepth}
                onChange={(e) => dispatch(setEngineDepth(+e.target.value))}
                disabled={status === Status.promoting}
            />
        </div>
    );
}
