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

        /*  vertical – above the pawn for White, below for Black */
        if (color === 'w')
            style.top = '-12.5%';
        else
            style.bottom = '-12.5%';

        if (promotionSquare.y <= 1) {        // a- or b-file (near left edge)
            style.left = '0%';
        } else if (promotionSquare.y >= 5) { // g- or h-file (near right edge)
            style.right = '0%';
        } else {                        // c-, d-, e- or f-file
            style.left = `${12.5 * promotionSquare.y - 20}%`;
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
            style={{
                position: 'absolute',
                alignSelf: 'flex-start', ...getPromotionBoxPosition()
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
