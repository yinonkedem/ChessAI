import { uciToCoords } from "../utils/uciToCoords";
import { repliesAt } from "./book";

/** [rank,file] pairs -> "e2e4", the shape the book is keyed on. */
export function coordsToUci([fromRank, fromFile], [toRank, toFile]) {
    const file = (f) => String.fromCharCode(97 + f);
    return `${file(fromFile)}${fromRank + 1}${file(toFile)}${toRank + 1}`;
}

/**
 * Was this a book move?
 *
 * A position can have several book replies — the Najdorf allows both 6...e5
 * and 6...e6 — so this checks membership, not equality against one move.
 * That is the whole point of the tree.
 *
 * Compares COORDINATES, never SAN: getNewMoveNotation (helper.js:53-87) emits
 * no `+` or `#` while the book's SAN comes from python-chess and does, so a
 * SAN comparison would call every checking move wrong.
 */
export function judgeMove(repertoire, path, attempt) {
    const replies = repliesAt(repertoire, path);
    if (replies.length === 0) return { verdict: "off-line", played: null, replies };

    const uci = coordsToUci(attempt.from, attempt.to);
    const played = replies.find((r) => r.uci === uci) ?? null;

    return {
        verdict: played ? "correct" : "wrong",
        played,
        replies,
    };
}

/** The squares of every book move here — used by the hint and by "show me". */
export function bookSquares(repertoire, path) {
    return repliesAt(repertoire, path).map((r) => {
        const [from, to] = uciToCoords(r.uci);
        return { ...r, from, to };
    });
}
