import arbiter from '../../arbiter/arbiter';
import { getPieces } from '../../arbiter/getMoves';
import { getCharacter } from '../../helper';

export const buildDisambiguation = ({
    position,
    prevPosition,
    castleDirection,
    piece,
    fromRank,
    fromFile,
    toRank,
    toFile,
}) => {
    if (piece[1] === 'p' || piece[1] === 'k') return '';

    const us = piece[0];
    const peers = getPieces(position, us).filter(
        (p) => p.piece === piece && !(p.rank === fromRank && p.file === fromFile)
    );

    const otherMovers = peers.filter((p) => {
        const moves = arbiter.getValidMoves({
            position,
            prevPosition,
            castleDirection: castleDirection[us],
            piece: p.piece,
            rank: p.rank,
            file: p.file,
        });
        return moves.some(([x, y]) => x === toRank && y === toFile);
    });

    if (otherMovers.length === 0) return '';

    const sameFile = otherMovers.some((p) => p.file === fromFile);
    const sameRank = otherMovers.some((p) => p.rank === fromRank);

    if (!sameFile) return getCharacter(fromFile + 1);
    if (!sameRank) return String(fromRank + 1);
    return getCharacter(fromFile + 1) + String(fromRank + 1);
};
