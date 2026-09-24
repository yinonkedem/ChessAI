import { useMemo } from "react";
import { useAppContext } from "../../../contexts/Context";
import { getScores } from "../../../helper";
import "./ScoreBoard.css";

/**
 * Live material balance: capturing a piece raises the mover's score and
 * lowers the other side's by the same amount, so losing a piece visibly
 * brings a side's own score down, not just the capturer's up. Promoting
 * only ever gains (see helper.js scoreForMove). Labelled by colour rather
 * than "You"/"Opponent" so it reads correctly in human-vs-human too.
 * Always rendered, even at 0-0, so it doesn't pop into existence — and
 * shift the layout — on the first capture.
 */
const ScoreBoard = () => {
    const { appState: { scoreLog } } = useAppContext();
    const { w, b } = useMemo(() => getScores(scoreLog), [scoreLog]);

    return (
        <div className="score-board" role="status" aria-label="Material balance this game">
            <span className="score-board__side score-board__side--white">
                <span className="score-board__swatch" aria-hidden="true" />
                White <strong className={w < 0 ? "is-down" : undefined}>{w}</strong>
            </span>
            <span className="score-board__side score-board__side--black">
                <span className="score-board__swatch" aria-hidden="true" />
                Black <strong className={b < 0 ? "is-down" : undefined}>{b}</strong>
            </span>
        </div>
    );
};

export default ScoreBoard;
