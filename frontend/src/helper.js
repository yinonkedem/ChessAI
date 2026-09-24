export const getCharacter = (file) => String.fromCharCode(file + 96);

export const createPosition = () => {
    const position = Array.from({ length: 8 }, () => Array(8).fill(""));

    for (let i = 0; i < 8; i++) {
        position[6][i] = "bp";
        position[1][i] = "wp";
    }

    position[0][0] = "wr";
    position[0][1] = "wn";
    position[0][2] = "wb";
    position[0][3] = "wq";
    position[0][4] = "wk";
    position[0][5] = "wb";
    position[0][6] = "wn";
    position[0][7] = "wr";

    position[7][0] = "br";
    position[7][1] = "bn";
    position[7][2] = "bb";
    position[7][3] = "bq";
    position[7][4] = "bk";
    position[7][5] = "bb";
    position[7][6] = "bn";
    position[7][7] = "br";

    return position;
};

export const copyPosition = (position) =>
    position.map((row) => row.slice());

export const areSameColorTiles = (coords1, coords2) =>
    (coords1.x + coords1.y) % 2 === (coords2.x + coords2.y) % 2;

export const findPieceCoords = (position, type) => {
    const results = [];
    position.forEach((rank, i) => {
        rank.forEach((pos, j) => {
            if (pos === type) results.push({ x: i, y: j });
        });
    });
    return results;
};

export const createEmptyPosition = () =>
    Array.from({ length: 8 }, () => Array(8).fill(""));

const fileChar = (y) => String.fromCharCode("a".charCodeAt(0) + y);

export const getNewMoveNotation = ({
    piece,
    rank,
    file,
    x,
    y,
    position,
    promotesTo,
    disambiguation = "",
}) => {
    rank = Number(rank);
    file = Number(file);

    if (piece[1] === "k" && Math.abs(file - y) === 2) {
        return file < y ? "O-O" : "O-O-O";
    }

    let note = "";
    const isPawn = piece[1] === "p";
    const isCapture = !!position[x][y] || (isPawn && file !== y);

    if (!isPawn) {
        note += piece[1].toUpperCase();
        note += disambiguation;
        if (isCapture) note += "x";
    } else if (isCapture) {
        note += fileChar(file) + "x";
    }

    note += fileChar(y) + (x + 1);

    if (promotesTo) note += "=" + promotesTo.toUpperCase();

    return note;
};

export const getCastleRights = (board) => {
    const rights = { w: "-", b: "-" };

    if (board[0][4] === "wk") {
        if (board[0][0] === "wr") rights.w = rights.w === "-" ? "left" : "both";
        if (board[0][7] === "wr") rights.w = rights.w === "-" ? "right" : "both";
    }

    if (board[7][4] === "bk") {
        if (board[7][0] === "br") rights.b = rights.b === "-" ? "left" : "both";
        if (board[7][7] === "br") rights.b = rights.b === "-" ? "right" : "both";
    }

    if (rights.w === "-") rights.w = "none";
    if (rights.b === "-") rights.b = "none";
    return rights;
};

export const isInsufficientMaterial = (board) => {
    const pieces = { w: [], b: [] };

    board.forEach((r) =>
        r.forEach((p) => {
            if (p) pieces[p[0]].push(p[1]);
        })
    );

    const okSide = (arr) =>
        arr.length === 1 ||
        (arr.length === 2 && ["b", "n"].includes(arr.find((c) => c !== "k")));

    return okSide(pieces.w) && okSide(pieces.b);
};

// Standard material values. No entry for 'k' — it can be neither captured
// nor promoted to.
export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const countOf = (position, code) =>
    position.reduce((n, row) => n + row.filter((sq) => sq === code).length, 0);

/**
 * The score change a single move causes for EACH colour, as { w, b } deltas
 * (either can be nonzero on the same move). Capturing a piece earns the
 * mover its value and costs the other side the same, so losing a piece
 * visibly brings that side's own score down rather than only ever raising
 * the capturer's — the two numbers are a live material balance, not two
 * independent up-only tallies. Promoting only ever gains for the mover: you
 * haven't lost anything by turning your own pawn into a queen.
 *
 * Diffed only between the position right before and right after THIS move
 * (never against the game's starting position), which is what keeps it
 * correct without any special cases:
 *   - a normal capture is the enemy piece's code simply missing afterward;
 *   - en passant looks the same way in a count diff, even though the
 *     captured pawn isn't on the destination square (arbiter/move.js
 *     removes it from the board either way);
 *   - a promotion is the mover having one more of a piece type than a
 *     moment ago — including a capturing promotion, which scores both.
 * Diffing against the game's start instead would double as a running
 * material count, but a piece captured earlier and then replaced by a later
 * promotion of the same type would silently cancel out and under-count.
 */
export const scoreForMove = ({ prevPosition, newPosition, mover }) => {
    const enemy = mover === "w" ? "b" : "w";
    const delta = { w: 0, b: 0 };

    for (const type of Object.keys(PIECE_VALUES)) {
        const captured = countOf(prevPosition, enemy + type) - countOf(newPosition, enemy + type);
        if (captured > 0) {
            const value = PIECE_VALUES[type] * captured;
            delta[mover] += value; // capturing earns the piece's value
            delta[enemy] -= value; // losing it costs the other side the same
        }

        if (type === "p") continue; // nothing promotes into a pawn
        const promoted = countOf(newPosition, mover + type) - countOf(prevPosition, mover + type);
        if (promoted > 0) delta[mover] += PIECE_VALUES[type] * promoted;
    }

    return delta;
};

/** Running total per colour from the per-ply log TAKE_BACK slices in step
 *  with movesList, so undoing a move undoes its score too. */
export const getScores = (scoreLog) =>
    scoreLog.reduce(
        (totals, delta) => ({ w: totals.w + delta.w, b: totals.b + delta.b }),
        { w: 0, b: 0 }
    );
