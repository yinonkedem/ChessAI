import { useRef, useState } from "react";
import { useAppContext } from "../contexts/Context";
import { copyPosition }  from "../helper";
import { makeNewMove }   from "../reducer/actions/move";
import actionTypes      from "../reducer/actionTypes";

import Board             from "../components/Board/Board";
import "./CustomEditor.css";

/* ──────────────────────────────────────────────────────────
   Helper utilities
   ────────────────────────────────────────────────────────── */

// Exactly one king per colour validator
const validateKings = board => {
    let wk = 0, bk = 0;
    board.forEach(r => r.forEach(p => {
        if (p === "wk") wk++; if (p === "bk") bk++; }));
    return { ok: wk===1 && bk===1, reason: "Both sides need exactly one king" };
};

// Classical starting counts (anything above comes from promoted pawns)
const BASE = { k:1, q:1, r:2, b:2, n:2, p:8 };

// ---------------- per-side dynamic cap --------------------
const withinLimit = (board, code) => {
    const colour = code[0];          // "w" | "b"
    const type   = code[1];          // k,q,r,b,n,p

    /* 1. count that colour’s pieces */
    const c = { k:0,q:0,r:0,b:0,n:0,p:0 };
    board.forEach(row =>
        row.forEach(p => { if (p && p[0] === colour) c[p[1]]++; })
    );

    /* 2. king is hard-capped at 1 */
    if (type === "k") return c.k < 1;

    /* 3. how many “promotion credits” remain?
          credits = 8 − currentPawns − extraMajorsAlreadyPlaced          */
    const extraMajors =
        Math.max(0, c.q - BASE.q) +
        Math.max(0, c.r - BASE.r) +
        Math.max(0, c.b - BASE.b) +
        Math.max(0, c.n - BASE.n);

    const creditsLeft = 8 - c.p - extraMajors;   // 0‥8

    /* 4a. pawns need a free credit to be re-added */
    if (type === "p") return c.p < 8 && creditsLeft > 0;

    /* 4b. other pieces                                  */
    const baseCap = BASE[type];                    // 1Q / 2R / 2B / 2N
    if (c[type] < baseCap) return true;            // haven’t hit base yet
    return creditsLeft > 0;                        // above base uses 1 credit
};

/* Piece palette – two columns × six rows */
const TRAY = [
    "wk","wq","wr","wb","wn","wp",
    "bk","bq","br","bb","bn","bp",
];

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */
export default function CustomEditor(){
    const { appState, dispatch } = useAppContext();
    const latest  = appState.position[appState.position.length-1];
    const { ok:kingOK, reason:errorMsg } = validateKings(latest);

    // local UI state
    const [armed , setArmed ] = useState(null);   // piece currently selected from tray
    const [erase , setErase ] = useState(false);  // erase‑mode toggle
    const [opp   , setOpp   ] = useState(null);   // "human" | "ai"
    const boardRef           = useRef(null);

    /* — helper to mutate a single square — */
    const writeSquare = (r,f,code) => {
        const next = copyPosition(latest);
        next[r][f] = code;
        dispatch(makeNewMove({ newPosition:next, newMove:"" }));
    };

    /* — board click — */
    const handleBoardClick = e => {
        if(!boardRef.current) return;
        const rect = boardRef.current.getBoundingClientRect();
        const size = rect.width / 8;
        const col  = Math.floor((e.clientX - rect.left)/size);
        const row  = Math.floor((e.clientY - rect.top )/size);
        if(col<0||row<0||col>7||row>7) return;
        /* convert screen-coords → board-coords, respecting orientation */
        const black = appState.userColor === "black";
        const r = black ? row      : 7 - row;   // rank 0 = top of *board*
        const f = black ? 7 - col  : col;       // file 0 = 'a' from *board* view
        const target = latest[r][f];

        if(erase){          // erase‑mode: delete if a piece exists
            if(target) writeSquare(r,f,"");
            return;
        }

        if(armed){         // placement mode
            // allow replacement even if cap reached (promotions overwrite)
            if(!target && !withinLimit(latest, armed)) return; // cap hit and empty square
            writeSquare(r,f,armed);
        }
    };

    /* — finalise setup — */
    const startGame = () => dispatch({
        type: actionTypes.START_FROM_CUSTOM,
        payload:{
            position       : [latest],
            movesList      : [],
            opponentType   : opp,
            opponent       : opp,
            isCustomEditor : false,
        }
    });

    /* ────────────────────────────────────────────────────────── */
    return (
        <section className="custom-editor">

            {/* tray */}
            <aside className="tray">
                {TRAY.map(code=>{
                    const disabled = !withinLimit(latest, code);
                    return (
                        <div key={code}
                             className={`piece ${code} ${armed===code?"selected":""} ${disabled?"disabled":""}`}
                             onClick={()=> !disabled && (setArmed(code), setErase(false))}
                             title={disabled ? "Limit reached; erase a pawn or piece" : code}
                        />);
                })}
            </aside>

            {/* board wrapper */}
            <div className="board-wrapper" ref={boardRef} onClick={handleBoardClick}>
                <Board orientation={appState.userColor}/>
                {/* stop drag events from underlying Piece components */}
                <style>{`.custom-editor .board-wrapper .piece{pointer-events:none;}`}</style>
            </div>

            {/* sidebar */}
            <div className="sidebar">
                <h3>Tools</h3>
                <button className={erase?"active":""}
                        onClick={()=>{ setErase(!erase); setArmed(null); }}>
                    {erase ? "❌ Cancel erase" : "🗑️ Erase pieces"}
                </button>

                <h3>Opponent</h3>
                <button className={opp==="human"?"active":""}
                        onClick={()=>setOpp("human")}>Human</button>
                <button className={opp==="ai"?"active":""}
                        onClick={()=>setOpp("ai")}>Stockfish AI</button>

                <button className="start-btn"
                        disabled={!opp || !kingOK}
                        title={kingOK?"":errorMsg}
                        onClick={startGame}>Start game</button>
                {!kingOK && <small className="warning">{errorMsg}</small>}
            </div>
        </section>
    );
}
