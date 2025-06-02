import { useState } from "react";
import "./StartScreen.css";

export default function StartScreen({ onStart }) {
    const [colour, setColour] = useState(null);     // "w" | "b" | "rand"
    const [opponent, setOpponent] = useState(null); // "human" | "ai" | "rand"

    const ready = colour && opponent;               // both picks made

    /* helper – adds the css class "active" when selected */
    const cls = (base, active) => (active ? `${base} active` : base);

    return (
        <section className="start-screen">
            <h1 className="start-screen__title">Yinon&nbsp;Chess</h1>
            <p className="start-screen__subtitle">Set up your match</p>

            <div className="setup-grid">
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

            {/* play --------------------------------------------------------------- */}
            <button
                className="btn btn--primary play-btn"
                disabled={!ready}
                onClick={() => ready && onStart({ colour, opponent })}
            >
                Play
            </button>
        </section>
    );
}
