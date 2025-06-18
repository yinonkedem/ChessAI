import { useRef, useState } from "react";
import { useAppContext } from "../contexts/Context";
import { copyPosition }  from "../helper";
import { makeNewMove }   from "../reducer/actions/move";
import actionTypes     from "../reducer/actionTypes";

import Board             from "../components/Board/Board";
import "./CustomEditor.css";

/* ──────────────────────────────────────────────────────────
   Utility helpers
   ────────────────────────────────────────────────────────── */

// king‑presence validator
const validateKings = board => {
    let wk=0, bk=0;
    board.forEach(r=>r.forEach(p=>{ if(p==="wk") wk++; if(p==="bk") bk++; }));
    return { ok: wk===1 && bk===1, reason: "Both sides need exactly one king" };
};

// piece count limits (per side)
const LIMIT = { k:1, q:1, r:2, b:2, n:2, p:8 };

const withinLimit = (board, code) => {
    const colour = code[0];           // "w" or "b"
    const type   = code[1];
    const count  = board.flat().filter(p=>p===code).length;
    return count < LIMIT[type];
};

/* tray inventory */
const TRAY = [
    "wk","wq","wr","wb","wn","wp",
    "bk","bq","br","bb","bn","bp",
];

/* ──────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────── */
export default function CustomEditor(){
    const { appState, dispatch } = useAppContext();
    const latest = appState.position[appState.position.length-1];
    const { ok:kingOK, reason:errorMsg } = validateKings(latest);

    // local UI state
    const [armed,  setArmed ] = useState(null);      // piece to place
    const [erase,  setErase ] = useState(false);     // erase‑mode toggle
    const [opp,    setOpp   ] = useState(null);      // "ai" | "human"
    const boardRef = useRef(null);

    /* ------------------------------------------------------ */
    const write = (r,f,code) => {
        const next = copyPosition(latest);
        next[r][f] = code;
        dispatch(makeNewMove({ newPosition:next, newMove:"" }));
    };

    const handleClick = e => {
        if(!boardRef.current) return;
        const rect = boardRef.current.getBoundingClientRect();
        const s    = rect.width/8;
        const c    = Math.floor((e.clientX-rect.left)/s);
        const row  = Math.floor((e.clientY-rect.top )/s);
        if(c<0||row<0||c>7||row>7) return;
        const r = 7-row, f = c;           // board coords
        const target = latest[r][f];

        if(erase){
            if(target) write(r,f,"");
            return;                         // skip add logic
        }

        if(armed){
            if(!withinLimit(latest, armed) && !target) return; // cannot add more
            write(r,f,armed);
        }
    };

    const startGame = () => dispatch({
        type: actionTypes.START_FROM_CUSTOM,
        payload:{
            position       : [latest],
            movesList      : [],
            opponentType   : opp,
            opponent       : opp,
            isCustomEditor : false
        }
    });

    /* ------------------------------------------------------ */
    return (
        <section className="custom-editor">
            {/* tray */}
            <aside className="tray">
                {TRAY.map(code=>{
                    const disabled = !withinLimit(latest,code);
                    return (
                        <div key={code}
                             className={`piece ${code} ${armed===code?"selected":""} ${disabled?"disabled":""}`}
                             onClick={()=> !disabled && (setArmed(code), setErase(false))}
                             title={disabled?`Limit reached (${LIMIT[code[1]]})`:code}
                        />);
                })}
            </aside>

            {/* board */}
            <div className="board-wrapper" ref={boardRef} onClick={handleClick}>
                <Board orientation={appState.userColor}/>
                {/* disable drag events from Piece components */}
                <style>{`.custom-editor .board-wrapper .piece{pointer-events:none;}`}</style>
            </div>

            {/* sidebar */}
            <div className="sidebar">
                <h3>Tools</h3>
                <button className={erase?"active":""}
                        onClick={()=>{ setErase(!erase); setArmed(null); }}>
                    {erase?"❌  Cancel erase":"🗑️  Erase pieces"}
                </button>

                <h3>Opponent</h3>
                <button className={opp==="human"?"active":""}
                        onClick={()=>setOpp("human")}>Human</button>
                <button className={opp==="ai"?"active":""}
                        onClick={()=>setOpp("ai")}>Stockfish AI</button>

                <button className="start-btn"
                        disabled={!opp||!kingOK}
                        title={kingOK?"":errorMsg}
                        onClick={startGame}>Start game</button>
                {!kingOK && <small className="warning">{errorMsg}</small>}
            </div>
        </section>
    );
}
