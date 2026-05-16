import { useAppContext } from "../../../contexts/Context";
import { copyPosition, getNewMoveNotation } from "../../../helper";
import {
    makeNewMove,
    clearCandidates,
    setLastMove,
} from "../../../reducer/actions/move";
import { closePopup } from "../../../reducer/actions/popup";
import "./PromotionBox.css";

const PromotionBox = ({ onClosePopup }) => {
    const { appState, dispatch } = useAppContext();
    const { promotionSquare } = appState;

    if (!promotionSquare) return null;

    const color = promotionSquare.x === 7 ? "w" : "b";
    const options = ["q", "r", "b", "n"];

    const getPromotionBoxPosition = () => {
        const style = {};

        // Place the choices ON the promotion rank (inside the board) rather
        // than above/below it, so the sticky toolbar never covers them.
        if (color === 'w') style.top = '0%';
        else style.bottom = '0%';

        if (promotionSquare.y <= 1) {
            style.left = '0%';
        } else if (promotionSquare.y >= 5) {
            style.right = '0%';
        } else {
            style.left = `${12.5 * promotionSquare.y - 20}%`;
        }
        return style;
    };

    const onClick = (option) => {
        const board = appState.position[appState.position.length - 1];
        const newPosition = copyPosition(board);

        newPosition[promotionSquare.rank][promotionSquare.file] = "";
        newPosition[promotionSquare.x][promotionSquare.y] = color + option;

        const newMove = getNewMoveNotation({
            ...promotionSquare,
            position: board,
            promotesTo: option,
            piece: promotionSquare.x === 7 ? "wp" : "bp",
        });

        dispatch(closePopup());
        dispatch(clearCandidates());
        dispatch(makeNewMove({ newPosition, newMove }));
        dispatch(setLastMove({
            from: [promotionSquare.rank, promotionSquare.file],
            to: [promotionSquare.x, promotionSquare.y],
        }));
        onClosePopup?.();
    };

    return (
        <div
            className="popup--inner promotion-choices"
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'absolute',
                alignSelf: 'flex-start',
                ...getPromotionBoxPosition(),
            }}
        >
            {options.map((option) => (
                <div
                    key={option}
                    onClick={() => onClick(option)}
                    className={`piece ${color}${option}`}
                />
            ))}
        </div>
    );
};

export default PromotionBox;
