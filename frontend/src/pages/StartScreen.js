import {useState} from "react";
import "./StartScreen.css";
import {setEngineDepth} from "../reducer/actions/game";
import {useAppContext} from "../contexts/Context";
import {GameMode} from "../constants";
import {useGlitch}  from "react-powerglitch";

export default function StartScreen({onStart}) {
    const [colour, setColour] = useState(null);     // "w" | "b" | "rand"
    const [opponent, setOpponent] = useState(null); // "human" | "ai" | "rand"
    const [mode,     setMode]     = useState(GameMode.standard);

    const ready = mode === GameMode.custom ? colour : colour && opponent;

    const {appState, dispatch} = useAppContext();
    const depth = appState.engineDepth;

    /* helper – adds the css class "active" when selected */
    const cls = (base, active) => (active ? `${base} active` : base);

    const glitch = useGlitch({
        playMode: "always",              // continuous
        slice:    { count:4, velocity:10 },
        shake:    { velocity:5 },
    });

    return (
        <section className="start-screen">
            {/* glitch-animated title */}
            <h1 ref={glitch.ref} className="start-screen__title glitch">
                Yinon&nbsp;Chess
            </h1>
            <p className="start-screen__subtitle">Set up your match</p>

            <div className="setup-grid card">
                {/* game mode block ------------------------------------------------- */}
                <div className="setup-block">
                    <h2 className="setup-heading">Game mode</h2>
                    <div className="btn-group">
                        <button
                            className={cls("btn btn--glass", mode === GameMode.standard)}
                            onClick={() => setMode(GameMode.standard)}>
                            Standard
                        </button>
                        <button
                            className={cls("btn btn--glass", mode === GameMode.custom)}
                            onClick={() => setMode(GameMode.custom)}>
                            Custom
                        </button>
                    </div>
                </div>

                {/* piece colour block ------------------------------------------------ */}
                <div className="setup-block">
                    <h2 className="setup-heading">Your colour</h2>
                    <div className="btn-group">
                        <button
                            className={cls("btn btn--white", colour === "white")}
                            onClick={() => setColour("white")}
                        >
                            White
                        </button>
                        <button
                            className={cls("btn btn--black", colour === "black")}
                            onClick={() => setColour("black")}
                        >
                            Black
                        </button>
                        <button
                            className={cls("btn btn--glass", colour === "rand")}
                            onClick={() => setColour("rand")}
                        >
                            Random
                        </button>
                    </div>
                </div>

                {/* opponent block ---------------------------------------------------- */}
                <div className="setup-block">
                    <h2 className="setup-heading">Opponent</h2>
                    <div className="btn-group">
                        <button
                            className={cls("btn btn--glass", opponent === "human")}
                            onClick={() => setOpponent("human")}
                        >
                            Human
                        </button>
                        <button
                            className={cls("btn btn--glass", opponent === "ai")}
                            onClick={() => setOpponent("ai")}
                        >
                            Computer
                        </button>
                        <button
                            className={cls("btn btn--glass", opponent === "rand")}
                            onClick={() => setOpponent("rand")}
                        >
                            Random
                        </button>
                    </div>
                </div>
            </div>

            {/* depth slider – only show when playing vs AI -------------------------- */}
            {opponent === "ai" && (
                <div className="setup-block">
                    <h2 className="setup-heading">
                        Computer strength: depth&nbsp;
                        <strong>{depth}</strong>
                    </h2>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={depth}
                        onChange={e =>
                            dispatch(setEngineDepth(+e.target.value))
                        }
                    />
                </div>
            )}

            {/* play --------------------------------------------------------------- */}
            <footer className="footer">
                <button
                    type="button"
                    className="btn btn--primary play-btn"
                    disabled={!ready}
                    onClick={() => ready && onStart({
                        colour,
                        opponent,
                        mode,
                        depth
                    })}
                >
                    {mode === GameMode.custom ? "Next →" : "Play"}
                </button>
            </footer>
        </section>
    );
}
