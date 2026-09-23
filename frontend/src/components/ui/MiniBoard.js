import BoardOverlay from "../Board/BoardOverlay";
import "./MiniBoard.css";

import wk from "../../assets/wk.png";
import wq from "../../assets/wq.png";
import wr from "../../assets/wr.png";
import wb from "../../assets/wb.png";
import wn from "../../assets/wn.png";
import wp from "../../assets/wp.png";
import bk from "../../assets/bk.png";
import bq from "../../assets/bq.png";
import br from "../../assets/br.png";
import bb from "../../assets/bb.png";
import bn from "../../assets/bn.png";
import bp from "../../assets/bp.png";

const IMG = { K: wk, Q: wq, R: wr, B: wb, N: wn, P: wp, k: bk, q: bq, r: br, b: bb, n: bn, p: bp };

/** FEN piece placement -> 8 rows of 8 cells, top row = rank 8. */
function parsePlacement(placement) {
    return placement.split("/").map((row) =>
        row.split("").flatMap((ch) => (/\d/.test(ch) ? Array(Number(ch)).fill(null) : [ch]))
    );
}

/**
 * A static, non-interactive board for illustrations.
 *
 * Deliberately independent of AppContext: the real <Board/> renders the live
 * game state, and a picture on the home page must never touch that. Sized by
 * its container rather than --tile-size, so it can sit anywhere.
 */
export default function MiniBoard({ placement, annotations = [], label }) {
    const rows = parsePlacement(placement);

    return (
        <div className="mini-board" role="img" aria-label={label}>
            {rows.map((row, r) =>
                row.map((piece, f) => (
                    <div
                        key={`${r}-${f}`}
                        className={`mini-board__sq ${(r + f) % 2 ? "is-dark" : "is-light"}`}
                    >
                        {piece && <img src={IMG[piece]} alt="" draggable="false" />}
                    </div>
                ))
            )}
            <BoardOverlay annotations={annotations} />
        </div>
    );
}
