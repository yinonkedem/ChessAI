import arbiter from "../arbiter/arbiter";
import { getCastlingDirections } from "../arbiter/getMoves";
import { createPosition } from "../helper";
import { uciToCoords } from "../utils/uciToCoords";

/**
 * Replays the first `ply` moves of a line and returns everything the game
 * reducer needs to render that exact point in the line.
 *
 * Pure — no React, no dispatch. Given the same line and ply it always returns
 * the same board, which is what makes rewind, replay and jump-to-ply a single
 * operation in the trainer.
 *
 * Two things here are easy to get wrong:
 *
 * 1. It returns the FULL position history, not just the final board.
 *    getPawnCaptures detects en passant by diffing `position` against
 *    `prevPosition`, so a single seeded board would make en passant
 *    unavailable — and the French and Sicilian have book lines that use it.
 *
 * 2. Castling rights are tracked INCREMENTALLY with getCastlingDirections,
 *    not inferred from the final board with helper.js getCastleRights.
 *    Inference restores the right when a rook leaves h1 and comes back, which
 *    is wrong. This mirrors what Pieces.js:84-86 does during a live game.
 *
 * @returns {{positions, movesList, castleDirection, lastMove, turn}}
 */
export function buildLinePrefix(line, ply) {
    const count = Math.max(0, Math.min(ply, line.moves.length));

    const positions = [createPosition()];
    const movesList = [];
    let castleDirection = { w: "both", b: "both" };
    let lastMove = null;

    for (let i = 0; i < count; i++) {
        const board = positions[positions.length - 1];
        const [[fromRank, fromFile], [toRank, toFile]] = uciToCoords(line.moves[i].uci);
        const piece = board[fromRank][fromFile];

        if (!piece) {
            // Can't happen for validated book data (openings.test.js replays
            // every line through this same arbiter), but failing loudly beats
            // rendering a silently wrong board to someone trying to learn.
            throw new Error(
                `buildLinePrefix: ${line.id} ply ${i} (${line.moves[i].san}) ` +
                `has no piece on the from-square`
            );
        }

        if (piece.endsWith("k") || piece.endsWith("r")) {
            const dir = getCastlingDirections({
                castleDirection,
                piece,
                file: fromFile,
                rank: fromRank,
            });
            if (dir) castleDirection = { ...castleDirection, [piece[0]]: dir };
        }

        positions.push(
            arbiter.performMove({
                position: board,
                piece,
                rank: fromRank,
                file: fromFile,
                x: toRank,
                y: toFile,
            })
        );
        // SAN comes from the book, which is canonical (with + and #).
        // getNewMoveNotation emits neither, so never regenerate it here.
        movesList.push(line.moves[i].san);
        lastMove = { from: [fromRank, fromFile], to: [toRank, toFile] };
    }

    return {
        positions,
        movesList,
        castleDirection,
        lastMove,
        turn: count % 2 === 0 ? "w" : "b",
    };
}

/** Legal destination squares for a piece at this point in the line. */
export function legalMovesAt(prefix, rank, file) {
    const board = prefix.positions[prefix.positions.length - 1];
    const prevBoard =
        prefix.positions.length > 1
            ? prefix.positions[prefix.positions.length - 2]
            : board;
    const piece = board[rank][file];
    if (!piece) return [];

    return arbiter.getValidMoves({
        position: board,
        // The per-side STRING, not the {w,b} object — getCastlingMoves throws
        // on the object now, but this is the shape to remember.
        castleDirection: prefix.castleDirection[piece[0]],
        prevPosition: prevBoard,
        piece,
        rank,
        file,
    });
}
