import './Board.css'
import {useAppContext} from '../../contexts/Context'

import Ranks from './bits/Ranks'
import Files from './bits/Files'
import Pieces from '../Pieces/Pieces'
import PromotionBox from '../Popup/PromotionBox/PromotionBox'
import Popup from '../Popup/Popup'
import GameEnds from '../Popup/GameEnds/GameEnds'

import arbiter from '../../arbiter/arbiter'
import {getKingPosition} from '../../arbiter/getMoves'

const Board = () => {
    // const ranks = Array(8).fill().map((x, i) => 8 - i)
    // const files = Array(8).fill().map((x, i) => i + 1)

    const {appState} = useAppContext();
    const position = appState.position[appState.position.length - 1]
    const isBlack = appState.userColor === 'black';

    // numbers on the left edge (top-to-bottom)
    const ranks = isBlack
        ? Array.from({length: 8}, (_, i) => i + 1)    // 1-8
        : Array.from({length: 8}, (_, i) => 8 - i);    // 8-1

    // letters under the board (left-to-right on the screen)
    const files = isBlack
        ? Array.from({length: 8}, (_, i) => 8 - i)     // 8,7,…,1  →  h,g,…,a
        : Array.from({length: 8}, (_, i) => i + 1);    // 1,2,…,8  →  a,b,…,h

    const checkTile = (() => {
        if (appState.isCustomEditor) return null;
        const isInCheck = (arbiter.isPlayerInCheck({
            positionAfterMove: position,
            player: appState.turn
        }))

        if (isInCheck)
            return getKingPosition(position, appState.turn)

        return null
    })()

    const getClassName = (i, j) => {
        let c = 'tile'
        c += (i + j) % 2 === 0 ? ' tile--dark ' : ' tile--light '
        if (appState.candidateMoves?.find(m => m[0] === i && m[1] === j)) {
            if (position[i][j])
                c += ' attacking'
            else
                c += ' highlight'
        }

        if (checkTile && checkTile[0] === i && checkTile[1] === j) {
            c += ' checked'
        }

        return c
    }

    return <div
        className={`board${appState.userColor === 'black' ? ' board--black' : ''}`}
    >

        <Ranks ranks={ranks}/>

        <div className='tiles'>
            {ranks.map((_, i) =>                       /* i = screen-row 0‥7 (top→bottom) */
                files.map((_, j) => {                    /* j = screen-col 0‥7 (left→right) */
                    /* 🔄  convert screen → engine exactly once */
                    const rank = 7 - i;  // 0 = White back rank
                    const file = j;  // 0 = file ‘a’

                    return (
                        <div
                            key={`${rank}-${file}`}            /* stable across flips            */
                            data-rank={rank}                   /* nice to inspect in DevTools    */
                            data-file={file}
                            className={getClassName(rank, file)}
                        />
                    );
                })
            )}
        </div>

            <Pieces/>

            <Popup orientation={appState.userColor}>
                <PromotionBox/>
                <GameEnds/>
            </Popup>

            <Files files={files}/>

        </div>

        }

        export default Board