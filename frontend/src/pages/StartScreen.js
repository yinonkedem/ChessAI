import { useEffect, useState } from "react";
import { useGlitch } from "react-powerglitch";
import { useAppContext } from "../contexts/Context";
import { GameMode } from "../constants";
import actionTypes from "../reducer/actionTypes";
import { setEngineThinkMs } from "../reducer/actions/game";
import "./StartScreen.css";

export default function StartScreen({ onStart }) {
    const [colour, setColour] = useState(null);
    const [opponent, setOpponent] = useState(null);
    const [mode, setMode] = useState(GameMode.standard);

    const ready = mode === GameMode.custom ? colour : colour && opponent;

    const { appState, dispatch } = useAppContext();
    useEffect(() => { dispatch({ type: actionTypes.RESET_ALL }); }, [dispatch]);
    const thinkMs = appState.engineThinkMs;
    const thinkSeconds = (thinkMs / 1000).toFixed(1);

    const cls = (base, active) => (active ? `${base} active` : base);

    const glitch = useGlitch({
        playMode: "always",
        slice: { count: 4, velocity: 10 },
        shake: { velocity: 5 },
    });

    return (
        <section className="start-screen">
            <h1 ref={glitch.ref} className="start-screen__title glitch">
                Yinon&nbsp;Chess
            </h1>
            <p className="start-screen__subtitle">Set up your match</p>

            <div className="setup-grid panel--neo">
                <div className="setup-block">
                    <h2 className="setup-heading">Game mode</h2>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={cls("btn btn--glass", mode === GameMode.standard)}
                            onClick={() => setMode(GameMode.standard)}
                        >Standard</button>
                        <button
                            type="button"
                            className={cls("btn btn--glass", mode === GameMode.custom)}
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
                            className={cls("btn btn--glass", colour === "rand")}
                            onClick={() => setColour("rand")}
                        >Random</button>
                    </div>
                </div>

                <div className="setup-block">
                    <h2 className="setup-heading">Opponent</h2>
                    <div className="btn-group">
                        <button
                            type="button"
                            className={cls("btn btn--glass", opponent === "human")}
                            onClick={() => setOpponent("human")}
                            disabled={mode === GameMode.custom}
                        >Human</button>
                        <button
                            type="button"
                            className={cls("btn btn--glass", opponent === "ai")}
                            onClick={() => setOpponent("ai")}
                            disabled={mode === GameMode.custom}
                        >Computer</button>
                        <button
                            type="button"
                            className={cls("btn btn--glass", opponent === "rand")}
                            onClick={() => setOpponent("rand")}
                            disabled={mode === GameMode.custom}
                        >Random</button>
                    </div>
                </div>
            </div>

            {opponent === "ai" && (
                <div className="setup-block">
                    <h2 className="setup-heading">
                        Thinking time:&nbsp;<strong>{thinkSeconds}s</strong>
                    </h2>
                    <input
                        type="range"
                        min="200"
                        max="3000"
                        step="100"
                        value={thinkMs}
                        onChange={(e) => dispatch(setEngineThinkMs(+e.target.value))}
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
