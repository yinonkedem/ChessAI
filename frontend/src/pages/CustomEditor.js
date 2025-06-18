import { useRef, useState }  from "react";
import { useAppContext }     from "../contexts/Context";
import { copyPosition }      from "../helper";
import { makeNewMove }       from "../reducer/actions/move";
import  actionTypes          from "../reducer/actionTypes";

import Board                 from "../components/Board/Board";
import "./CustomEditor.css";

/**
 * A lightweight FEN‑builder that lets the player set up any legal start‑position
 * and then jump straight into a regular game (human vs human **or** Stockfish).
 */

/* 🏷   Validation – ensure **exactly one** king per side before enabling Start */
const validatePosition = board => {
    let wk = 0, bk = 0;
    board.forEach(r => r.forEach(p => {
        if (p === "wk") wk++;
        if (p === "bk") bk++;
    }));
    return { ok: wk === 1 && bk === 1, reason: "Both sides need exactly one king" };
};

/* 16 tray pieces: two columns × six rows */
const SEED_PIECES = [
    "wk","wq","wr","wb","wn","wp",
    "bk","bq","br","bb","bn","bp"
];

export default function CustomEditor() {
    const { appState, dispatch } = useAppContext();
    const latest  = appState.position[appState.position.length - 1];
    const { ok: legalSetup, reason: errorMsg } = validatePosition(latest);

    /* local UI state */
    const [selected,  setSelected ] = useState(null);   // piece code armed for placement
    const [opponent,  setOpponent ] = useState(null);   // "human" | "ai"
    const boardRef = useRef(null);

    /* helpers ------------------------------------------------------------ */
    const writeSquare = (rank,file,code) => {
        const next = copyPosition(latest);
        next[rank][file] = code;
        dispatch(makeNewMove({ newPosition: next, newMove: "" }));
    };

    const handleBoardClick = e => {
        if (!boardRef.current) return;
        const rect = boardRef.current.getBoundingClientRect();
        const tile = rect.width / 8;
        const col  = Math.floor((e.clientX - rect.left) / tile);
        const row  = Math.floor((e.clientY - rect.top ) / tile);
        if (col < 0 || row < 0 || col > 7 || row > 7) return;

        const rank = 7 - row; // board coords (0 = 8th rank on screen)
        const file = col;

        if (selected)      writeSquare(rank,file,selected);
        else if (latest[rank][file]) writeSquare(rank,file,""); // erase
    };

    const startGame = () => {
        dispatch({
            type   : actionTypes.START_FROM_CUSTOM,
            payload: {
                position       : [latest],     // collapse history to single start node
                movesList      : [],
                opponentType   : opponent,     // key used by AIAgent / Hint
                opponent       : opponent,     // legacy field
                isCustomEditor : false
            }
        });
    };

    /* render ------------------------------------------------------------- */
    return (
        <section className="custom-editor">
            {/* tray */}
            <aside className="tray">
                {SEED_PIECES.map(code => (
                    <div key={code}
                         className={`piece ${code} ${selected===code?"selected":""}`}
                         title={code}
                         onClick={()=> setSelected(code)}
                    />
                ))}
            </aside>

            {/* board wrapper */}
            <div className="board-wrapper"
                 ref={boardRef}
                 onClick={handleBoardClick}>
                <Board orientation={appState.userColor}/>
            </div>

            {/* sidebar */}
            <div className="sidebar">
                <h3>Choose opponent</h3>
                <button className={opponent==="human"?"active":""}
                        onClick={()=>setOpponent("human")}>Human</button>
                <button className={opponent==="ai"?"active":""}
                        onClick={()=>setOpponent("ai")}>Stockfish AI</button>

                <button className="start-btn"
                        disabled={!opponent || !legalSetup}
                        title={legalSetup?"":errorMsg}
                        onClick={startGame}>Start game</button>
                {!legalSetup && <small className="warning">{errorMsg}</small>}
            </div>
        </section>
    );
}
