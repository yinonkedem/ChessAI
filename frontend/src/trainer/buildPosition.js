import arbiter from "../arbiter/arbiter";
import { getCastlingDirections } from "../arbiter/getMoves";
import { createPosition } from "../helper";
import { uciToCoords } from "../utils/uciToCoords";

import { pathMoves, pathSteps } from "./book";

/**
 * Replays a UCI path and returns everything the game reducer needs to render
 * that position.
 *
 * Pure — same path, same board. That is what makes rewind, replay and
 * jump-to-position a single operation in the trainer.
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
 *    Inference restores the right when a rook leaves h1 and comes back.
 *    This mirrors what Pieces.js:84-86 does during a live game.
 */
export function buildPosition(repertoire, path) {
    const positions = [createPosition()];
    const movesList = [];
    let castleDirection = { w: "both", b: "both" };
    let lastMove = null;

    const steps = pathSteps(path);
    const named = pathMoves(repertoire, path);

    steps.forEach((uci, i) => {
        const board = positions[positions.length - 1];
        const [[fromRank, fromFile], [toRank, toFile]] = uciToCoords(uci);
        const piece = board[fromRank][fromFile];

        if (!piece) {
            throw new Error(
                `buildPosition: ${repertoire.id} step ${i} (${uci}) has no piece on the from-square`
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
        movesList.push(named[i]?.san ?? uci);
        lastMove = { from: [fromRank, fromFile], to: [toRank, toFile] };
    });

    return {
        positions,
        movesList,
        castleDirection,
        lastMove,
        turn: steps.length % 2 === 0 ? "w" : "b",
    };
}

/** Legal destination squares for a piece at this position. */
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
        // The per-side STRING, not the {w,b} object. getCastlingMoves throws
        // on the object now, but this is the shape to remember.
        castleDirection: prefix.castleDirection[piece[0]],
        prevPosition: prevBoard,
        piece,
        rank,
        file,
    });
}
