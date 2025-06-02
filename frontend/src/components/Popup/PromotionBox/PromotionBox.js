import {useAppContext} from "../../../contexts/Context";
import {copyPosition, getNewMoveNotation} from "../../../helper";
import {makeNewMove, clearCandidates} from "../../../reducer/actions/move";
import "./PromotionBox.css";

const PromotionBox = ({onClosePopup, orientation}) => {
    const {appState, dispatch} = useAppContext();
    const {promotionSquare} = appState;

    if (!promotionSquare) return null;

    const color = promotionSquare.x === 7 ? "w" : "b";
    const options = ["q", "r", "b", "n"];

    const getPromotionBoxPosition = () => {
        const style = {};
        const flipped = (orientation === 'black');      /* board is rotated 180° */

        /*  vertical – above the pawn for White, below for Black */
        if (promotionSquare.x === 7 ^ flipped)   // XOR keeps the logic symmetric
            style.top = '-12.5%';
        else
            style.bottom = '-12.5%';

        /*  horizontal – stay inside the 8×8 grid */
        const place = () => `${12.5 * promotionSquare.y - 20}%`;
        if (promotionSquare.y <= 1) {
            flipped ? (style.right = '0%') : (style.left = '0%');
        } else if (promotionSquare.y >= 5) {
            flipped ? (style.left = '0%') : (style.right = '0%');
        } else {
            flipped ? (style.right = place()) : (style.left = place());
        }
        return style;
    };

    const onClick = (option) => {
        onClosePopup();
        const newPosition = copyPosition(
            appState.position[appState.position.length - 1]
        );

        newPosition[promotionSquare.rank][promotionSquare.file] = "";
        newPosition[promotionSquare.x][promotionSquare.y] = color + option;

        const newMove = getNewMoveNotation({
            ...promotionSquare,
            position: appState.position[appState.position.length - 1],
            promotesTo: option,
            piece: promotionSquare.x === 7 ? "wp" : "bp",
        });
        dispatch(clearCandidates());

        dispatch(makeNewMove({newPosition, newMove}));
    };

    return (
        <div
            className="popup--inner promotion-choices"
            style={getPromotionBoxPosition()}
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
