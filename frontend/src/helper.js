export const getCharacter = (file) => String.fromCharCode(file + 96);
export const createPosition = () => {
    const position = new Array(8).fill("").map((x) => new Array(8).fill(""));

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

export const copyPosition = (position) => {
    const newPosition = new Array(8).fill("").map((x) => new Array(8).fill(""));

    for (let rank = 0; rank < position.length; rank++) {
        for (let file = 0; file < position[0].length; file++) {
            newPosition[rank][file] = position[rank][file];
        }
    }

    return newPosition;
};

export const areSameColorTiles = (coords1, coords2) =>
    (coords1.x + coords1.y) % 2 === coords2.x + coords2.y;

export const findPieceCoords = (position, type) => {
    let results = [];
    position.forEach((rank, i) => {
        rank.forEach((pos, j) => {
            if (pos === type) results.push({x: i, y: j});
        });
    });
    return results;
};

export const getNewMoveNotation = ({
                                       piece,
                                       rank,
                                       file,
                                       x,
                                       y,
                                       position,
                                       promotesTo,
                                   }) => {
    let note = "";

    rank = Number(rank);
    file = Number(file);
    if (piece[1] === "k" && Math.abs(file - y) === 2) {
        if (file < y) return "O-O";
        else return "O-O-O";
    }

    if (piece[1] !== "p") {
        note += piece[1].toUpperCase();
        if (position[x][y]) {
            note += "x";
        }
    } else if (rank !== x && file !== y) {
        note += getCharacter(file + 1) + "x";
    }

    note += getCharacter(y + 1) + (x + 1);

    if (promotesTo) note += "=" + promotesTo.toUpperCase();

    return note;
};

export const createEmptyPosition = () =>
    Array.from({ length: 8 }, () => Array(8).fill(""));

/* ────────────────────────────────────────────────────────── */
/*  Simple utilities used only when we leave Custom-Editor    */
/* ────────────────────────────────────────────────────────── */

/**
 * Return castling rights in the same shape used by initGameState:
 * { w : "both"|"k"|"q"|"-",  b : "both"|"k"|"q"|"-" }
 *
 * We only check whether the king / rooks are still on their home squares.
 * No “has the king moved already” bookkeeping is done here because the
 * editor always starts a *brand-new* game.
 */
export const getCastleRights = board => {
    const rights = { w: "-", b: "-" };

    // White pieces on rank 1
    if (board[0][4] === "wk") {
        if (board[0][0] === "wr") rights.w = rights.w === "-" ? "q"   : "both";
        if (board[0][7] === "wr") rights.w = rights.w === "-" ? "k"   : "both";
    }

    // Black pieces on rank 8
    if (board[7][4] === "bk") {
        if (board[7][0] === "br") rights.b = rights.b === "-" ? "q"   : "both";
        if (board[7][7] === "br") rights.b = rights.b === "-" ? "k"   : "both";
    }
    return rights;
};

/**
 * Extremely lightweight “insufficient material” test:
 * returns true iff **both** sides have
 *   – just a king, or
 *   – king + single bishop, or
 *   – king + single knight
 *
 * Good enough for detecting K-vs-K positions created in the editor.
 */
export const isInsufficientMaterial = board => {
    const pieces = { w: [], b: [] };

    board.forEach(r =>
        r.forEach(p => {
            if (p) pieces[p[0]].push(p[1]);      // 'wk' → push('k')
        })
    );

    const okSide = arr =>
        arr.length === 1 ||                       // just king
        (arr.length === 2 && ["b", "n"].includes(arr[1])); // king + minor

    return okSide(pieces.w) && okSide(pieces.b);
};
