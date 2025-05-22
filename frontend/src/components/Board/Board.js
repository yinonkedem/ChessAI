import './Board.css'
import { useAppContext }from '../../contexts/Context'

import Ranks from './bits/Ranks'
import Files from './bits/Files'
import Pieces from '../Pieces/Pieces'
import PromotionBox from '../Popup/PromotionBox/PromotionBox'
import Popup from '../Popup/Popup'
import GameEnds from '../Popup/GameEnds/GameEnds'

import arbiter from '../../arbiter/arbiter'
import { getKingPosition } from '../../arbiter/getMoves'

const Board = () => {
    // const ranks = Array(8).fill().map((x,i) => 8-i)
    // const files = Array(8).fill().map((x,i) => i+1)
    const base  = [1,2,3,4,5,6,7,8];
    const { appState } = useAppContext();
    const orientation = appState.userColor || 'white';

    const ranks = orientation === 'white' ? [...base].reverse() : base;   // 8→1  or 1→8
    const files = orientation === 'white' ? base : [...base].reverse();   // a→h or h→a
    const position = appState.position[appState.position.length - 1]

    const checkTile = (() => {
        const isInCheck =  (arbiter.isPlayerInCheck({
            positionAfterMove : position,
            player : appState.turn
        }))

        if (isInCheck)
            return getKingPosition (position, appState.turn)

        return null
    })()

    const getClassName = (i,j) => {
        let c = 'tile'
        c+= (i+j)%2 === 0 ? ' tile--dark ' : ' tile--light '
        if (appState.candidateMoves?.find(m => m[0] === i && m[1] === j)){
            if (position[i][j])
                c+= ' attacking'
            else 
                c+= ' highlight'
        }

        if (checkTile && checkTile[0] === i && checkTile[1] === j) {
            c+= ' checked'
        }

        return c
    }

    return <div className='board'>

        <Ranks ranks={ranks} orientation={orientation}/>

        <div className='tiles'>
            {ranks.map((rank,i) => 
                files.map((file,j) =>
                    <div key={file+''+rank}
                         className={getClassName(rank-1, file-1)}>
                    </div>
                ))}
        </div>

        <Pieces orientation={appState.userColor} />

        <Popup orientation={appState.userColor} >
            <PromotionBox orientation={appState.userColor} />
            <GameEnds />
        </Popup>

        <Files files={files} orientation={orientation}/>

    </div>
    
}

export default Board