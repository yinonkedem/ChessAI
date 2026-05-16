import { useEffect, useRef } from 'react';
import arbiter from '../../arbiter/arbiter';
import { useAppContext } from '../../contexts/Context';
import { generateCandidates } from '../../reducer/actions/move';

const Piece = ({ rank, file, piece }) => {
    const { appState, dispatch } = useAppContext();
    const { turn, castleDirection, position: history } = appState;
    const currentPosition = history[history.length - 1];
    const prevPosition = history.length > 1 ? history[history.length - 2] : null;

    const elRef = useRef(null);

    useEffect(() => () => {
        if (elRef.current) elRef.current.style.display = 'block';
    }, []);

    const onDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${piece},${rank},${file}`);

        const target = e.currentTarget;
        elRef.current = target;
        setTimeout(() => {
            if (target) target.style.display = 'none';
        }, 0);

        if (!appState.isCustomEditor && turn === piece[0]) {
            const candidateMoves = arbiter.getValidMoves({
                position: currentPosition,
                prevPosition,
                castleDirection: castleDirection[turn],
                piece,
                file,
                rank,
            });
            dispatch(generateCandidates({ candidateMoves }));
        }
    };

    const onDragEnd = (e) => {
        e.currentTarget.style.display = 'block';
    };

    return (
        <div
            className={`piece ${piece} p-${file}${rank}`}
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        />
    );
};

export default Piece;
