import { createEmptyPosition, scoreForMove, getScores, PIECE_VALUES } from "./helper";

/**
 * scoreForMove is a live material balance, not two independent up-only
 * tallies: capturing a piece earns the mover its value AND costs the other
 * side the same amount, so losing a piece visibly brings that side's own
 * score down. Promoting only ever gains — you haven't lost anything by
 * turning your own pawn into a queen.
 *
 * It diffs only the position right before and right after ONE move — never
 * against the game's starting position — which is what lets it stay correct
 * without special-casing en passant (the captured pawn is just gone from
 * the board, wherever it was) or a capturing promotion (both a capture and
 * a promotion diff land in the same call).
 */

function board(placements) {
    const b = createEmptyPosition();
    for (const [rank, file, code] of placements) b[rank][file] = code;
    return b;
}

describe("scoreForMove", () => {
    test("a quiet move changes nothing for either side", () => {
        const prevPosition = board([[0, 1, "wn"]]);
        const newPosition = board([[2, 2, "wn"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" })).toEqual({ w: 0, b: 0 });
    });

    test("castling changes nothing (king and rook count is unchanged)", () => {
        const prevPosition = board([[0, 4, "wk"], [0, 7, "wr"]]);
        const newPosition = board([[0, 6, "wk"], [0, 5, "wr"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" })).toEqual({ w: 0, b: 0 });
    });

    test("capturing a piece earns the mover its value and costs the other side the same", () => {
        const prevPosition = board([[0, 0, "wp"], [0, 1, "bn"]]);
        const newPosition = board([[0, 1, "wp"]]); // pawn takes the knight
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" }))
            .toEqual({ w: PIECE_VALUES.n, b: -PIECE_VALUES.n });
    });

    test("capturing a pawn is worth exactly 1, either way", () => {
        const prevPosition = board([[3, 3, "bp"], [3, 4, "wp"]]);
        const newPosition = board([[2, 3, "wp"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" })).toEqual({ w: 1, b: -1 });
    });

    test("en passant scores like any other pawn capture, despite the captured pawn not being on the destination square", () => {
        // Black just double-stepped to d5 (rank 4); White's pawn on e5
        // takes it en passant, landing on d6 (rank 5) — the captured pawn
        // was never on the landing square.
        const prevPosition = board([[4, 4, "wp"], [4, 3, "bp"]]);
        const newPosition = board([[5, 3, "wp"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" })).toEqual({ w: 1, b: -1 });
    });

    test("promoting (no capture) only earns the mover the new piece's value — no loss to either side", () => {
        const prevPosition = board([[6, 0, "wp"]]);
        const newPosition = board([[7, 0, "wq"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" }))
            .toEqual({ w: PIECE_VALUES.q, b: 0 });
    });

    test("promoting underneath, e.g. to a knight, still scores correctly", () => {
        const prevPosition = board([[6, 0, "wp"]]);
        const newPosition = board([[7, 0, "wn"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" }))
            .toEqual({ w: PIECE_VALUES.n, b: 0 });
    });

    test("a capturing promotion scores the capture (both sides) and the promotion (mover only)", () => {
        const prevPosition = board([[6, 0, "wp"], [7, 1, "br"]]);
        const newPosition = board([[7, 1, "wq"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "w" }))
            .toEqual({ w: PIECE_VALUES.q + PIECE_VALUES.r, b: -PIECE_VALUES.r });
    });

    test("scoring is symmetric regardless of which side is asked to move", () => {
        // Black captures White's bishop.
        const prevPosition = board([[3, 3, "wb"], [4, 4, "bn"]]);
        const newPosition = board([[3, 3, "bn"]]);
        expect(scoreForMove({ prevPosition, newPosition, mover: "b" }))
            .toEqual({ b: PIECE_VALUES.b, w: -PIECE_VALUES.b });
    });
});

describe("getScores", () => {
    test("sums each colour's deltas into a running balance", () => {
        const scoreLog = [
            { w: 3, b: 0 },   // White captures a minor piece
            { w: -1, b: 1 },  // Black captures a pawn
            { w: 9, b: 0 },   // White promotes to a queen
        ];
        expect(getScores(scoreLog)).toEqual({ w: 11, b: 1 });
    });

    test("a side can go negative once it's lost more than it's captured", () => {
        const scoreLog = [{ w: -9, b: 9 }]; // White's queen is captured
        expect(getScores(scoreLog)).toEqual({ w: -9, b: 9 });
    });

    test("an empty log is 0-0", () => {
        expect(getScores([])).toEqual({ w: 0, b: 0 });
    });
});
