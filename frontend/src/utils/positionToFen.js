// utils/positionToFen.js
const PIECE_MAP = {
    wp: "P", wn: "N", wb: "B", wr: "R", wq: "Q", wk: "K",
    bp: "p", bn: "n", bb: "b", br: "r", bq: "q", bk: "k",
};

export function positionToFen({ position, turn, castleDirection }) {
    // ---- board part -------------------------------------------------
    const ranks = position.map(rankArr => {
        let fenRank = "";
        let empty = 0;

        rankArr.forEach(square => {
            if (!square) {
                empty += 1;
            } else {
                if (empty) { fenRank += empty; empty = 0; }
                fenRank += PIECE_MAP[square];
            }
        });

        if (empty) fenRank += empty;
        return fenRank;
    });

    const boardPart = ranks.reverse().join("/"); // matrix rank 0 = White back rank

    // ---- active color ----------------------------------------------
    const activeColor = turn;

    // ---- castling rights -------------------------------------------
    let castling = "";
    if (castleDirection.w === "both" || castleDirection.w === "right") castling += "K";
    if (castleDirection.w === "both" || castleDirection.w === "left") castling += "Q";
    if (castleDirection.b === "both" || castleDirection.b === "right") castling += "k";
    if (castleDirection.b === "both" || castleDirection.b === "left") castling += "q";
    if (!castling) castling = "-";

    // ---- en-passant, half-move, full-move ---------------------------
    const enPassant = "-";
    const halfMoveClock = "0";
    const fullMoveNumber = "1";

    return `${boardPart} ${activeColor} ${castling} ${enPassant} ${halfMoveClock} ${fullMoveNumber}`;
}
