import './Pieces.css'
import Piece from './Piece'
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../contexts/Context'
import { openPromotion } from '../../reducer/actions/popup'
import { getCastlingDirections } from '../../arbiter/getMoves'
import {
    updateCastling,
    detectStalemate,
    detectInsufficientMaterial,
    detectCheckmate,
} from '../../reducer/actions/game'

import {
    makeNewMove,
    clearCandidates,
    generateCandidates,
    setLastMove,
} from '../../reducer/actions/move'
import arbiter from '../../arbiter/arbiter'
import { getNewMoveNotation } from '../../helper'
import { Status } from '../../constants'
import { buildDisambiguation } from './disambiguation'

const Pieces = () => {
    const { appState, dispatch } = useAppContext();
    const { status, turn, castleDirection, position: history } = appState;
    const currentPosition = history[history.length - 1];

    const [selected, setSelected] = useState(null);
    const [legal, setLegal] = useState([]);

    useEffect(() => {
        setSelected(null);
        setLegal([]);
        dispatch(clearCandidates());
    }, [history.length, dispatch]);

    const isBlack = appState.userColor === 'black';
    const ref = useRef();

    const updateCastlingState = ({ piece, file, rank }) => {
        const direction = getCastlingDirections({ castleDirection, piece, file, rank });
        if (direction) dispatch(updateCastling(direction));
    };

    const openPromotionBox = ({ rank, file, x, y }) => {
        dispatch(openPromotion({
            rank: Number(rank),
            file: Number(file),
            x,
            y,
        }));
    };

    const calculateCoords = (e) => {
        const { top, left, width } = ref.current.getBoundingClientRect();
        const size = width / 8;
        const colScreen = Math.floor((e.clientX - left) / size);
        const rowScreen = Math.floor((e.clientY - top) / size);

        const x = isBlack ? rowScreen : 7 - rowScreen;
        const y = isBlack ? 7 - colScreen : colScreen;

        return { x, y };
    };

    const move = (e) => {
        const { x, y } = calculateCoords(e);
        const [piece, rank, file] = e.dataTransfer.getData("text").split(',');

        if (!appState.candidateMoves.find((m) => m[0] === x && m[1] === y)) {
            dispatch(clearCandidates());
            return;
        }

        const opponent = piece.startsWith('b') ? 'w' : 'b';
        const oppCastleDir = castleDirection[opponent];

        if ((piece === 'wp' && x === 7) || (piece === 'bp' && x === 0)) {
            openPromotionBox({ rank, file, x, y });
            return;
        }
        if (piece.endsWith('r') || piece.endsWith('k')) {
            updateCastlingState({ piece, file, rank });
        }

        const newPosition = arbiter.performMove({
            position: currentPosition,
            piece,
            rank,
            file,
            x,
            y,
        });

        const disambiguation = buildDisambiguation({
            position: currentPosition,
            prevPosition: history.length > 1 ? history[history.length - 2] : currentPosition,
            castleDirection,
            piece,
            fromRank: Number(rank),
            fromFile: Number(file),
            toRank: x,
            toFile: y,
        });

        const newMove = getNewMoveNotation({
            piece,
            rank,
            file,
            x,
            y,
            position: currentPosition,
            disambiguation,
        });

        dispatch(makeNewMove({ newPosition, newMove }));
        dispatch(setLastMove({ from: [Number(rank), Number(file)], to: [x, y] }));
        dispatch(clearCandidates());

        if (arbiter.insufficientMaterial(newPosition)) {
            dispatch(detectInsufficientMaterial());
        } else if (arbiter.isStalemate(newPosition, opponent, oppCastleDir)) {
            dispatch(detectStalemate());
        } else if (arbiter.isCheckMate(newPosition, opponent, oppCastleDir)) {
            dispatch(detectCheckmate(piece[0]));
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        if (status !== Status.promoting) move(e);
    };

    const onDragOver = (e) => {
        e.preventDefault();
    };

    const onBoardClick = (e) => {
        if (appState.isCustomEditor || status === Status.promoting) return;

        const prevPosition =
            history.length > 1 ? history[history.length - 2] : currentPosition;

        const { x, y } = calculateCoords(e);
        const squarePiece = currentPosition[x][y];

        if (!selected) {
            if (squarePiece && squarePiece[0] === turn) {
                const candidateMoves = arbiter.getValidMoves({
                    position: currentPosition,
                    prevPosition,
                    castleDirection: castleDirection[turn],
                    piece: squarePiece,
                    file: y,
                    rank: x,
                });
                setSelected({ piece: squarePiece, rank: x, file: y });
                setLegal(candidateMoves);
                dispatch(generateCandidates({ candidateMoves }));
            }
            return;
        }

        const isLegal = legal.find((m) => m[0] === x && m[1] === y);
        if (isLegal) {
            move({
                dataTransfer: {
                    getData: () => `${selected.piece},${selected.rank},${selected.file}`,
                },
                clientX: e.clientX,
                clientY: e.clientY,
            });
            setSelected(null);
            setLegal([]);
            return;
        }

        setSelected(null);
        setLegal([]);
        dispatch(clearCandidates());
    };

    return (
        <div
            className='pieces'
            ref={ref}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={onBoardClick}
        >
            {selected && (
                <div
                    className={`selected-square p-${selected.file}${selected.rank}`}
                    aria-hidden="true"
                />
            )}
            {currentPosition.map((r, rank) =>
                r.map((f, file) =>
                    currentPosition[rank][file]
                        ? <Piece
                            key={`${rank}-${file}`}
                            rank={rank}
                            file={file}
                            piece={currentPosition[rank][file]}
                        />
                        : null
                )
            )}
        </div>
    );
};

export default Pieces;
