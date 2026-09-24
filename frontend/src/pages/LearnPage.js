import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loadIndex } from "../trainer/openingsRepo";
import { catalogProgress } from "../trainer/progress";
import { load } from "../trainer/localStore";
import ProgressRing from "../components/ui/ProgressRing";
import "./LearnPage.css";

const FILTERS = [
    { key: "all", label: "Everything", test: () => true },
    { key: "w", label: "As White", test: (r) => r.side === "w" },
    { key: "b", label: "As Black", test: (r) => r.side === "b" },
    // Attacks and their matching defences, ordered so each pair is adjacent.
    { key: "traps", label: "Attacks & traps", test: (r) => !!r.category },
];

const CATEGORY = {
    attack: { chip: "Attack", link: "Learn to defend it" },
    defence: { chip: "Defence", link: "Learn the attack" },
};

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
    const [filter, setFilter] = useState("all");
    const navigate = useNavigate();

    // Read once per mount: progress only changes while drilling, and this
    // screen is where you come back to afterwards.
    const [progress] = useState(() => catalogProgress());
    const [stats] = useState(() => load().stats);

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

    const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    const titles = Object.fromEntries(index.repertoires.map((r) => [r.id, r.title]));
    let shown = index.repertoires.filter(active.test);
    if (filter === "traps") {
        // Each attack immediately followed by the defence against it.
        const byId = Object.fromEntries(shown.map((r) => [r.id, r]));
        shown = shown
            .filter((r) => r.category === "attack")
            .flatMap((r) => [r, byId[r.counterpart]].filter(Boolean));
    }

    return (
        <main className="page page--learn">
            <div className="learn">
                <header className="learn__header">
                    <h1>Learn openings</h1>
                    <p className="muted">
                        Play the book move, one position at a time. Pick a repertoire to start.
                    </p>
                    {stats.reviews > 0 && (
                        <p className="learn__stats">
                            <span className="chip chip--accent">🔥 {stats.dayStreak} day streak</span>
                            <span className="chip">{stats.reviews} moves reviewed</span>
                            <span className="chip">
                                {Math.round((stats.correct / stats.reviews) * 100)}% first time
                            </span>
                        </p>
                    )}
                </header>

                <div className="learn__filters" role="group" aria-label="Filter openings">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={`btn btn--sm${filter === f.key ? " is-active" : ""}`}
                            onClick={() => setFilter(f.key)}
                            aria-pressed={filter === f.key}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <ul className="learn__grid">
                    {shown.map((r) => (
                        <li key={r.id} className="learn__cell">
                            <button
                                type="button"
                                className="card card--interactive learn-card"
                                onClick={() => navigate(`/learn/${r.id}`)}
                            >
                                <div className="learn-card__top">
                                    <span className="learn-card__chips">
                                        <span className={`chip chip--${r.side === "w" ? "accent" : "primary"}`}>
                                            {r.side === "w" ? "White" : "Black"}
                                        </span>
                                        {r.category && (
                                            <span className={`chip learn-card__cat learn-card__cat--${r.category}`}>
                                                {CATEGORY[r.category].chip}
                                            </span>
                                        )}
                                    </span>
                                    <Difficulty level={r.difficulty} />
                                </div>

                                <div className="learn-card__head">
                                    <div>
                                        <h2 className="card__title">{r.title}</h2>
                                        <p className="learn-card__family">{r.family}</p>
                                    </div>
                                    {(progress[r.id]?.seen ?? 0) > 0 && (
                                        /* Coverage, not mastery: mastery needs
                                           box 4, so a fresh drill would show 0%
                                           and look broken. Coverage moves every
                                           session. Mastery is shown as text. */
                                        <ProgressRing
                                            percent={Math.round(
                                                ((progress[r.id]?.seen ?? 0) / r.cardCount) * 100
                                            )}
                                            label={`${progress[r.id]?.seen ?? 0} of ${r.cardCount} positions seen`}
                                        />
                                    )}
                                </div>

                                <p className="card__subtitle">{r.blurb}</p>

                                <p className="learn-card__meta">
                                    {r.lineCount} lines · {r.cardCount} positions
                                    {(progress[r.id]?.mastered ?? 0) > 0 &&
                                        ` · ${progress[r.id].mastered} mastered`}
                                    {(progress[r.id]?.due ?? 0) > 0 && (
                                        <span className="chip chip--error learn-card__due">
                                            {progress[r.id].due} due
                                        </span>
                                    )}
                                </p>
                            </button>

                            {/* Clearing due reviews is the returning-user path,
                                so it gets its own button rather than hiding
                                behind "open the repertoire". */}
                            {(progress[r.id]?.due ?? 0) > 0 && (
                                <button
                                    type="button"
                                    className="btn btn--primary btn--sm learn-card__review"
                                    onClick={() => navigate(`/learn/${r.id}/review`)}
                                >
                                    Review {progress[r.id].due} due →
                                </button>
                            )}

                            {/* Every attack pairs with the repertoire that
                                defends against it, and vice versa. */}
                            {r.counterpart && titles[r.counterpart] && (
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm learn-card__pair"
                                    onClick={() => navigate(`/learn/${r.counterpart}`)}
                                >
                                    {CATEGORY[r.category].link}: {titles[r.counterpart]} →
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    );
}
