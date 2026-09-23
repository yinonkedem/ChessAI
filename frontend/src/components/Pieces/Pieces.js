import './Pieces.css'
import Piece from './Piece'
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { useMoveGate } from '../../trainer/TrainerContext'

const Pieces = () => {
    const { appState, dispatch } = useAppContext();
    const { status, turn, castleDirection, position: history } = appState;
    // null unless an opening drill is running
    const gate = useMoveGate();
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

    // Pointer-driven drag. The native HTML5 drag hid the real piece and relied
    // on the browser's drag "ghost" — a snapshot of a transformed (and, for
    // Black, 180°-rotated) element, which browsers often render blank. So the
    // piece vanished mid-drag. Here the piece stays on its square, dimmed, and
    // a full-opacity copy follows the pointer. Pointer events also make drag
    // work on touch screens, which native drag never did.
    const drag = useRef(null);          // { piece, rank, file, sx, sy, active }
    const [ghost, setGhost] = useState(null);
    const suppressClick = useRef(false);
    const DRAG_THRESHOLD = 4;           // px — anything less is a tap

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

    const move = ({ piece, rank, file, x, y }) => {

        if (!appState.candidateMoves.find((m) => m[0] === x && m[1] === y)) {
            dispatch(clearCandidates());
            return;
        }

        // During an opening drill the trainer owns the board: report the
        // attempt and stop. It judges the move and recomputes the whole
        // position from the line prefix, so a wrong move never half-applies.
        // Sitting above the promotion branch below also guarantees the
        // promotion popup can never open mid-drill.
        //
        // INVARIANT: this runs from pointer/click handlers, never during render.
        // That is what makes the side effect safe and StrictMode-proof.
        if (gate) {
            gate.onAttempt({
                piece,
                from: [Number(rank), Number(file)],
                to: [x, y],
            });
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

    const endDrag = () => {
        drag.current = null;
        setGhost(null);
    };

    const onPointerDown = (e) => {
        if (e.button !== 0 || appState.isCustomEditor || status === Status.promoting) return;
        const { x, y } = calculateCoords(e);
        const piece = currentPosition[x]?.[y];
        if (!piece || piece[0] !== turn) return;
        // Stops text selection starting; the click that follows still fires.
        e.preventDefault();
        drag.current = { piece, rank: x, file: y, sx: e.clientX, sy: e.clientY, active: false };
        ref.current.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.active) {
            if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
            d.active = true;
            setSelected(null);
            setLegal([]);
            dispatch(generateCandidates({
                candidateMoves: arbiter.getValidMoves({
                    position: currentPosition,
                    prevPosition: history.length > 1 ? history[history.length - 2] : null,
                    castleDirection: castleDirection[turn],
                    piece: d.piece,
                    file: d.file,
                    rank: d.rank,
                }),
            }));
        }
        const size = ref.current.getBoundingClientRect().width / 8;
        setGhost({ piece: d.piece, rank: d.rank, file: d.file, x: e.clientX, y: e.clientY, size });
    };

    const onPointerUp = (e) => {
        const d = drag.current;
        endDrag();
        if (!d?.active) return;         // a tap: let onBoardClick handle it
        suppressClick.current = true;   // ...but not the click this release fires

        const { top, left, width } = ref.current.getBoundingClientRect();
        const inside = e.clientX >= left && e.clientX < left + width
            && e.clientY >= top && e.clientY < top + width;
        if (!inside) {
            dispatch(clearCandidates());
            return;
        }
        const { x, y } = calculateCoords(e);
        move({ piece: d.piece, rank: d.rank, file: d.file, x, y });
    };

    const onPointerCancel = () => {
        if (drag.current?.active) dispatch(clearCandidates());
        endDrag();
    };

    const onBoardClick = (e) => {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
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
            move({ piece: selected.piece, rank: selected.rank, file: selected.file, x, y });
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
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
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
                            dragging={ghost?.rank === rank && ghost?.file === file}
                        />
                        : null
                )
            )}
            {/* Portalled to <body>: .board--black is transformed, and a
                position:fixed element inside a transformed ancestor is fixed
                to that ancestor, not the viewport. Outside it, the copy is
                also upright for both colours without counter-rotation. */}
            {ghost && createPortal(
                <div
                    className={`piece piece--ghost ${ghost.piece}`}
                    style={{
                        width: ghost.size,
                        height: ghost.size,
                        left: ghost.x - ghost.size / 2,
                        top: ghost.y - ghost.size / 2,
                    }}
                    aria-hidden="true"
                />,
                document.body
            )}
        </div>
    );
};

export default Pieces;
