import { useEffect, useState } from "react";
import { useAppContext } from "../contexts/Context";
import { GameMode } from "../constants";
import actionTypes from "../reducer/actionTypes";
import { setEngineDepth } from "../reducer/actions/game";
import "./StartScreen.css";

export default function StartScreen({ onStart }) {
    const [colour, setColour] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [mode, setMode] = useState(GameMode.standard);

    const ready = mode === GameMode.custom ? colour : colour && opponent;

    const { appState, dispatch } = useAppContext();
    useEffect(() => { dispatch({ type: actionTypes.RESET_ALL }); }, [dispatch]);
    const depth = appState.engineDepth;

    const cls = (base, active) => (active ? `${base} active` : base);

    return (
        <section className="start-screen">
            <h1 className="start-screen__title">Yinon&nbsp;Chess</h1>
            <p className="start-screen__subtitle">Set up your match</p>

            <div className="setup-grid panel--neo">
                <div className="setup-block">
                    <h2 className="setup-heading">Game mode</h2>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={cls("btn btn--choice", mode === GameMode.standard)}
                            onClick={() => setMode(GameMode.standard)}
                        >Standard</button>
                        <button
                            type="button"
                            className={cls("btn btn--choice", mode === GameMode.custom)}
                            onClick={() => setMode(GameMode.custom)}
                        >Custom</button>
                    </div>
                </div>

                <div className="setup-block">
                    <h2 className="setup-heading">Your colour</h2>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={cls("btn btn--white", colour === "white")}
                            onClick={() => setColour("white")}
                        >White</button>
                        <button
                            type="button"
                            className={cls("btn btn--black", colour === "black")}
                            onClick={() => setColour("black")}
                        >Black</button>
                        <button
                            type="button"
                            className={cls("btn btn--choice", colour === "rand")}
                            onClick={() => setColour("rand")}
                        >Random</button>
                    </div>
                </div>

                <div className="setup-block">
                    <h2 className="setup-heading">Opponent</h2>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={cls("btn btn--choice", opponent === "human")}
                            onClick={() => setOpponent("human")}
                            disabled={mode === GameMode.custom}
                        >Human</button>
                        <button
                            type="button"
                            className={cls("btn btn--choice", opponent === "ai")}
                            onClick={() => setOpponent("ai")}
                            disabled={mode === GameMode.custom}
                        >Computer</button>
                        <button
                            type="button"
                            className={cls("btn btn--choice", opponent === "rand")}
                            onClick={() => setOpponent("rand")}
                            disabled={mode === GameMode.custom}
                        >Random</button>
                    </div>
                </div>
            </div>

            {opponent === "ai" && (
                <div className="setup-block">
                    <h2 className="setup-heading">
                        Engine depth:&nbsp;<strong>{depth}</strong>
                    </h2>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={depth}
                        onChange={(e) => dispatch(setEngineDepth(+e.target.value))}
                    />
                </div>
            )}

            <footer className="footer">
                <button
                    type="button"
                    className="btn btn--primary play-btn"
                    disabled={!ready}
                    onClick={() => ready && onStart({ colour, opponent, mode })}
                >
                    {mode === GameMode.custom ? "Next →" : "Play"}
                </button>
            </footer>
        </section>
    );
}
