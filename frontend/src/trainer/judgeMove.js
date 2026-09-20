import { uciToCoords } from "../utils/uciToCoords";

/**
 * Was this the book move?
 *
 * Compares COORDINATES, never SAN. getNewMoveNotation (helper.js:53-87) does
 * not emit `+` or `#`, but the book's SAN comes from python-chess and does —
 * so a SAN comparison would call every checking move wrong.
 */
export function judgeMove(line, ply, attempt) {
    const move = line.moves[ply];
    if (!move) return { verdict: "off-line", expected: null };

    const [[eFromRank, eFromFile], [eToRank, eToFile]] = uciToCoords(move.uci);
    const [fromRank, fromFile] = attempt.from;
    const [toRank, toFile] = attempt.to;

    const correct =
        fromRank === eFromRank &&
        fromFile === eFromFile &&
        toRank === eToRank &&
        toFile === eToFile;

    return { verdict: correct ? "correct" : "wrong", expected: move };
}

/** The square the learner should have moved FROM — used by the first hint. */
export function hintFrom(line, ply) {
    const move = line.moves[ply];
    if (!move) return null;
    return uciToCoords(move.uci)[0];
}

/** The full from/to for the book move — used by the second hint. */
export function hintSquares(line, ply) {
    const move = line.moves[ply];
    if (!move) return null;
    const [from, to] = uciToCoords(move.uci);
    return { from, to };
}
