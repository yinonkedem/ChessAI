import './Board.css';
import { useAppContext } from '../../contexts/Context';

import Ranks from './bits/Ranks';
import Files from './bits/Files';
import Pieces from '../Pieces/Pieces';
import PromotionBox from '../Popup/PromotionBox/PromotionBox';
import Popup from '../Popup/Popup';
import GameEnds from '../Popup/GameEnds/GameEnds';

import arbiter from '../../arbiter/arbiter';
import { getKingPosition } from '../../arbiter/getMoves';

const Board = () => {
    const { appState } = useAppContext();
    const position = appState.position[appState.position.length - 1];
    const isBlack = appState.userColor === 'black';

    const ranks = isBlack
        ? Array.from({ length: 8 }, (_, i) => i + 1)
        : Array.from({ length: 8 }, (_, i) => 8 - i);

    const files = isBlack
        ? Array.from({ length: 8 }, (_, i) => 8 - i)
        : Array.from({ length: 8 }, (_, i) => i + 1);

    const checkTile = (() => {
        if (appState.isCustomEditor) return null;
        const inCheck = arbiter.isPlayerInCheck({
            positionAfterMove: position,
            player: appState.turn,
        });
        return inCheck ? getKingPosition(position, appState.turn) : null;
    })();

    const getClassName = (i, j) => {
        let c = 'tile';
        c += (i + j) % 2 === 0 ? ' tile--dark ' : ' tile--light ';
        if (appState.candidateMoves?.find((m) => m[0] === i && m[1] === j)) {
            c += position[i][j] ? ' attacking' : ' highlight';
        }
        if (appState.lastMove) {
            const { from, to } = appState.lastMove;
            if (Array.isArray(from) && from[0] === i && from[1] === j) c += " last-from";
            if (Array.isArray(to) && to[0] === i && to[1] === j) c += " last-to";
        }
        if (checkTile && checkTile[0] === i && checkTile[1] === j) c += ' checked';
        return c;
    };

    return (
        <div className={`board${isBlack ? ' board--black' : ''}`}>
            <Ranks ranks={ranks} />

            <div className="tiles">
                {ranks.map((_, i) =>
                    files.map((_, j) => {
                        const rank = 7 - i;
                        const file = j;
                        return (
                            <div
                                key={`${rank}-${file}`}
                                data-rank={rank}
                                data-file={file}
                                className={getClassName(rank, file)}
                            />
                        );
                    })
                )}
            </div>

            <Pieces />

            <Popup>
                <PromotionBox />
                <GameEnds />
            </Popup>

            <Files files={files} />
        </div>
    );
};

export default Board;
