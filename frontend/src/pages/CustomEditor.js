import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/Context";
import { copyPosition } from "../helper";
import { makeNewMove } from "../reducer/actions/move";
import actionTypes from "../reducer/actionTypes";
import Board from "../components/Board/Board";
import "./CustomEditor.css";

const validateKings = (board) => {
    let wk = 0, bk = 0;
    board.forEach((r) => r.forEach((p) => {
        if (p === "wk") wk++;
        if (p === "bk") bk++;
    }));
    return {
        ok: wk === 1 && bk === 1,
        reason: "Place exactly one king for each side to begin.",
    };
};

const BASE = { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };

const withinLimit = (board, code) => {
    const colour = code[0];
    const type = code[1];

    const c = { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 };
    board.forEach((row) =>
        row.forEach((p) => { if (p && p[0] === colour) c[p[1]]++; })
    );

    if (type === "k") return c.k < 1;

    const extraMajors =
        Math.max(0, c.q - BASE.q) +
        Math.max(0, c.r - BASE.r) +
        Math.max(0, c.b - BASE.b) +
        Math.max(0, c.n - BASE.n);

    const creditsLeft = 8 - c.p - extraMajors;

    if (type === "p") return c.p < 8 && creditsLeft > 0;

    const baseCap = BASE[type];
    if (c[type] < baseCap) return true;
    return creditsLeft > 0;
};

const TRAY = ["wk", "wq", "wr", "wb", "wn", "wp", "bk", "bq", "br", "bb", "bn", "bp"];

export default function CustomEditor() {
    const { appState, dispatch } = useAppContext();
    const navigate = useNavigate();
    const latest = appState.position[appState.position.length - 1];
    const { ok: kingOK, reason: errorMsg } = validateKings(latest);

    const [armed, setArmed] = useState(null);
    const [erase, setErase] = useState(false);
    const [opp, setOpp] = useState(null);
    const boardRef = useRef(null);

    const writeSquare = (r, f, code) => {
        const next = copyPosition(latest);
        next[r][f] = code;
        dispatch(makeNewMove({ newPosition: next, newMove: "" }));
    };

    const handleBoardClick = (e) => {
        if (!boardRef.current) return;
        const rect = boardRef.current.getBoundingClientRect();
        const size = rect.width / 8;
        const col = Math.floor((e.clientX - rect.left) / size);
        const row = Math.floor((e.clientY - rect.top) / size);
        if (col < 0 || row < 0 || col > 7 || row > 7) return;

        const black = appState.userColor === "black";
        const r = black ? row : 7 - row;
        const f = black ? 7 - col : col;
        const target = latest[r][f];

        if (erase) {
            if (target) writeSquare(r, f, "");
            return;
        }

        if (armed) {
            if (!target && !withinLimit(latest, armed)) return;
            writeSquare(r, f, armed);
        }
    };

    const startGame = () => {
        dispatch({
            type: actionTypes.START_FROM_CUSTOM,
            payload: {
                position: [latest],
                opponentType: opp,
            },
        });
        navigate("/game");
    };

    return (
        <section className="custom-editor">
            <aside className="tray">
                {TRAY.map((code) => {
                    const disabled = !withinLimit(latest, code);
                    return (
                        <div
                            key={code}
                            className={`piece ${code} ${armed === code ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                            onClick={() => !disabled && (setArmed(code), setErase(false))}
                            title={disabled ? "Limit reached; erase a pawn or piece" : code}
                        />
                    );
                })}
            </aside>

            <div className="board-wrapper" ref={boardRef} onClick={handleBoardClick}>
                <Board />
            </div>

            <div className="sidebar">
                <h3><span className="shiny-text">Tools</span></h3>
                <button
                    className={erase ? "active" : ""}
                    onClick={() => { setErase(!erase); setArmed(null); }}
                >
                    {erase ? "Cancel erase" : "Erase pieces"}
                </button>

                <h3><span className="shiny-text">Opponent</span></h3>
                <button
                    className={opp === "human" ? "active" : ""}
                    onClick={() => setOpp("human")}
                >Human</button>
                <button
                    className={opp === "ai" ? "active" : ""}
                    onClick={() => setOpp("ai")}
                >Stockfish AI</button>

                <button
                    className="start-btn"
                    disabled={!opp || !kingOK}
                    title={kingOK ? "" : errorMsg}
                    onClick={startGame}
                >Start game</button>
                {!kingOK && <small className="warning">{errorMsg}</small>}
            </div>
        </section>
    );
}
