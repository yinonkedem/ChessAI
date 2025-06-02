import './Pieces.css'
import Piece from './Piece'
import {useEffect, useRef, useState} from 'react';
import {useAppContext} from '../../contexts/Context'
import {openPromotion} from '../../reducer/actions/popup'
import {getCastlingDirections} from '../../arbiter/getMoves'
import {
    updateCastling,
    detectStalemate,
    detectInsufficientMaterial,
    detectCheckmate
} from '../../reducer/actions/game'

import {
    makeNewMove,
    clearCandidates,
    generateCandidates
} from '../../reducer/actions/move'
import arbiter from '../../arbiter/arbiter'
import {getNewMoveNotation} from '../../helper'
import {Status} from "../../constants";

const Pieces = () => {

    const {appState, dispatch} = useAppContext();
    const {status, turn, castleDirection} = appState
    const currentPosition = appState.position[appState.position.length - 1]
    /*  🔄  Whenever the board position changes (move *or* undo),
    clear the local click-to-move state and the green dots   */
    useEffect(() => {
        setSelected(null);
        setLegal([]);
        dispatch(clearCandidates());           // wipes the store & CSS highlights
        }, [currentPosition, dispatch]);                      // runs after every move / take-back
    const isBlack = appState.userColor === 'black';

    const ref = useRef()

    /* 🆕  tap-to-move state */
    const [selected, setSelected] = useState(null);    // {piece,rank,file}
    const [legal, setLegal] = useState([]);      // [[x,y], …]

    const updateCastlingState = ({piece, file, rank}) => {
        const direction = getCastlingDirections({
            castleDirection: appState.castleDirection,
            piece,
            file,
            rank
        })
        if (direction) {
            dispatch(updateCastling(direction))
        }
    }

    const openPromotionBox = ({rank, file, x, y}) => {
        dispatch(openPromotion({
            rank: Number(rank),
            file: Number(file),
            x,
            y
        }))
    }

    const calculateCoords = e => {
        const {top, left, width} = ref.current.getBoundingClientRect()
        const size = width / 8
        const colScreen = Math.floor((e.clientX - left) / size);   // 0 .. 7 L→R on screen
        const rowScreen = Math.floor((e.clientY - top) / size);    // 0 .. 7 T→B

        const x = isBlack ? rowScreen : 7 - rowScreen;    // rank in position[][]
        const y = isBlack ? 7 - colScreen : colScreen;        // file in position[][]

        return {x, y};
    }

    const move = e => {
        const {x, y} = calculateCoords(e)
        const [piece, rank, file] = e.dataTransfer.getData("text").split(',')

        if (status === Status.PROMOTION) {
            return;
        }

        if (appState.candidateMoves.find(m => m[0] === x && m[1] === y)) {
            const opponent = piece.startsWith('b') ? 'w' : 'b'
            const castleDirection = appState.castleDirection[`${piece.startsWith('b') ? 'white' : 'black'}`]

            if ((piece === 'wp' && x === 7) || (piece === 'bp' && x === 0)) {
                openPromotionBox({rank, file, x, y})
                return
            }
            if (piece.endsWith('r') || piece.endsWith('k')) {
                updateCastlingState({piece, file, rank})
            }
            const newPosition = arbiter.performMove({
                position: currentPosition,
                piece, rank, file,
                x, y
            })
            const newMove = getNewMoveNotation({
                piece,
                rank,
                file,
                x,
                y,
                position: currentPosition,
            })
            dispatch(makeNewMove({newPosition, newMove}))

            if (arbiter.insufficientMaterial(newPosition))
                dispatch(detectInsufficientMaterial())
            else if (arbiter.isStalemate(newPosition, opponent, castleDirection)) {
                dispatch(detectStalemate())
            } else if (arbiter.isCheckMate(newPosition, opponent, castleDirection)) {
                dispatch(detectCheckmate(piece[0]))
            }
        }
        dispatch(clearCandidates())
    }

    const onDrop = e => {
        e.preventDefault()

        if (status !== Status.promoting)
            move(e)
    }

    const onDragOver = e => {
        e.preventDefault()
    }

    /* 🆕  handle every board click (also touch on mobile) */
    const onBoardClick = e => {
        if (status === Status.promoting) return;             // modal up → ignore

        // previous board = one move before the current one (needed for en-passant, castling, etc.)
        const prevPosition =
            appState.position.length > 1
                ? appState.position[appState.position.length - 2]   // last board in history
                : currentPosition;                                   // opening position

        const {x, y} = calculateCoords(e);                 // coords of click
        const squarePiece = currentPosition[x][y];           // '' if empty

        /* 1️⃣  nothing selected yet → try selecting your own piece */
        if (!selected) {
            if (squarePiece && squarePiece[0] === turn) {
                const candidateMoves = arbiter.getValidMoves({
                    position: currentPosition,
                    prevPosition,                           // ✅ real previous board
                    castleDirection: castleDirection[turn],
                    piece: squarePiece,
                    file: y,
                    rank: x
                });
                setSelected({piece: squarePiece, rank: x, file: y});
                setLegal(candidateMoves);
                dispatch(generateCandidates({candidateMoves})); // green dots
            }
            return;
        }

        /* 2️⃣  we HAVE a piece selected → is this click a legal target? */
        const isLegal = legal.find(m => m[0] === x && m[1] === y);
        if (isLegal) {
            /* reuse the SAME logic the drag path uses */
            move({
                dataTransfer: {
                    getData: () => `${selected.piece},${selected.rank},${selected.file}`
                },               // fake a dataTransfer for move()
                clientX: e.clientX,
                clientY: e.clientY
            });
            setSelected(null);
            setLegal([]);
            return;
        }

        /* 3️⃣  click elsewhere → clear selection & green dots */
        setSelected(null);
        setLegal([]);
        dispatch(clearCandidates());
    };


    return <div
        className='pieces'
        ref={ref}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={onBoardClick}>
        {currentPosition.map((r, rank) =>
            r.map((f, file) =>
                currentPosition[rank][file]
                    ? <Piece
                        key={rank + '-' + file}
                        rank={rank}
                        file={file}
                        piece={currentPosition[rank][file]}
                    />
                    : null
            )
        )}
    </div>
}

export default Pieces