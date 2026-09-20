import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loadIndex } from "../trainer/openingsRepo";
import "./LearnPage.css";

const SIDES = [
    { key: "all", label: "Everything" },
    { key: "w", label: "As White" },
    { key: "b", label: "As Black" },
];

function Difficulty({ level }) {
    return (
        <span
            className="learn-card__difficulty"
            title={`Difficulty ${level} of 4`}
            aria-label={`Difficulty ${level} of 4`}
        >
            {[1, 2, 3, 4].map((n) => (
                <i key={n} className={n <= level ? "is-on" : undefined} />
            ))}
        </span>
    );
}

export default function LearnPage() {
    const [index, setIndex] = useState(null);
    const [error, setError] = useState(null);
    const [side, setSide] = useState("all");
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        loadIndex()
            .then((data) => !cancelled && setIndex(data))
            .catch((err) => !cancelled && setError(err.message));
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        return (
            <main className="page page--learn">
                <div className="learn">
                    <p className="learn__error">Couldn&apos;t load the openings: {error}</p>
                </div>
            </main>
        );
    }

    if (!index) {
        return (
            <main className="page page--learn">
                <div className="learn">
                    <p className="muted">Loading openings…</p>
                </div>
            </main>
        );
    }

    const shown =
        side === "all"
            ? index.repertoires
            : index.repertoires.filter((r) => r.side === side);

    return (
        <main className="page page--learn">
            <div className="learn">
                <header className="learn__header">
                    <h1>Learn openings</h1>
                    <p className="muted">
                        Play the book move, one position at a time. Pick a repertoire to start.
                    </p>
                </header>

                <div className="learn__filters" role="group" aria-label="Filter by colour">
                    {SIDES.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            className={`btn btn--sm${side === s.key ? " is-active" : ""}`}
                            onClick={() => setSide(s.key)}
                            aria-pressed={side === s.key}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                <ul className="learn__grid">
                    {shown.map((r) => (
                        <li key={r.id}>
                            <button
                                type="button"
                                className="card card--interactive learn-card"
                                onClick={() => navigate(`/learn/${r.id}`)}
                            >
                                <div className="learn-card__top">
                                    <span className={`chip chip--${r.side === "w" ? "accent" : "primary"}`}>
                                        {r.side === "w" ? "White" : "Black"}
                                    </span>
                                    <Difficulty level={r.difficulty} />
                                </div>

                                <h2 className="card__title">{r.title}</h2>
                                <p className="learn-card__family">{r.family}</p>
                                <p className="card__subtitle">{r.blurb}</p>

                                <p className="learn-card__meta">
                                    {r.lineCount} lines · {r.cardCount} positions
                                </p>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    );
}
