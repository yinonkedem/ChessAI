import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Board from "../components/Board/Board";
import { loadRepertoire } from "../trainer/openingsRepo";
import { useTrainer } from "../trainer/TrainerContext";
import useBookAgent from "../trainer/useBookAgent";
import { Phase } from "../trainer/trainerReducer";
import "./DrillPage.css";

function MoveDots({ line, results, ply }) {
    return (
        <div className="drill-dots" aria-hidden="true">
            {line.answerPlies.map((p) => {
                const r = results[p];
                const state = r
                    ? r.firstTry
                        ? "is-good"
                        : "is-missed"
                    : p === ply
                        ? "is-current"
                        : "is-todo";
                return <i key={p} className={state} />;
            })}
        </div>
    );
}

function Feedback({ feedback, phase }) {
    if (phase === Phase.lineComplete) return null;
    if (!feedback) {
        return (
            <div className="card drill-feedback drill-feedback--neutral">
                <p className="drill-feedback__title">Your move</p>
                <p className="drill-feedback__body muted">
                    Play the move the book recommends.
                </p>
            </div>
        );
    }

    const { verdict, expectedSan, idea } = feedback;
    const kind =
        verdict === "correct" ? "good" : verdict === "skipped" ? "neutral" : "bad";
    const title =
        verdict === "correct"
            ? `Correct — ${expectedSan}`
            : verdict === "skipped"
                ? `The book plays ${expectedSan}`
                : "Not the book move";

    return (
        <div className={`card drill-feedback drill-feedback--${kind}`} role="status">
            <p className="drill-feedback__title">
                <span aria-hidden="true">
                    {verdict === "correct" ? "✓" : verdict === "skipped" ? "→" : "✗"}
                </span>{" "}
                {title}
            </p>
            {verdict === "wrong" && (
                <p className="drill-feedback__body">Try again, or take a hint.</p>
            )}
            {idea && <p className="drill-feedback__body">{idea}</p>}
        </div>
    );
}

export default function DrillPage() {
    const { repertoireId } = useParams();
    const { session, startLine, hint, skip, nextLine, progress } = useTrainer();
    const [error, setError] = useState(null);

    useBookAgent();

    useEffect(() => {
        let cancelled = false;
        loadRepertoire(repertoireId)
            .then((rep) => !cancelled && startLine(rep, 0))
            .catch((err) => !cancelled && setError(err.message));
        return () => {
            cancelled = true;
        };
    }, [repertoireId, startLine]);

    if (error) {
        return (
            <main className="page page--drill">
                <div className="drill__error card">
                    <p>Couldn&apos;t load that repertoire: {error}</p>
                    <Link className="btn" to="/learn">Back to openings</Link>
                </div>
            </main>
        );
    }

    const { line, repertoire, phase, feedback, results, ply, streak } = session;
    if (!line) {
        return (
            <main className="page page--drill">
                <p className="muted">Loading…</p>
            </main>
        );
    }

    const complete = phase === Phase.lineComplete;
    const perfect = complete && line.answerPlies.every((p) => results[p]?.firstTry);

    return (
        <main className="page page--drill">
            <Board />

            <aside className="drill-rail">
                <header className="card drill-head">
                    <div className="drill-head__top">
                        <span className="chip">{line.eco}</span>
                        <span className={`chip chip--${line.side === "w" ? "accent" : "primary"}`}>
                            {line.side === "w" ? "You play White" : "You play Black"}
                        </span>
                    </div>
                    <h1 className="card__title">{repertoire.title}</h1>
                    <p className="drill-head__line">{line.label}</p>
                    <p className="card__subtitle">{line.name}</p>

                    <MoveDots line={line} results={results} ply={ply} />
                    <p className="drill-head__count">
                        {progress.done} / {progress.total} moves
                        {streak > 1 && <span className="drill-head__streak"> · {streak} in a row</span>}
                    </p>
                </header>

                {complete ? (
                    <div className="card drill-feedback drill-feedback--good">
                        <p className="drill-feedback__title">
                            <span aria-hidden="true">{perfect ? "★" : "✓"}</span>{" "}
                            {perfect ? "Perfect line!" : "Line complete"}
                        </p>
                        <p className="drill-feedback__body">
                            {perfect
                                ? "Every move first time."
                                : `${progress.done} of ${progress.total} first time.`}
                        </p>
                    </div>
                ) : (
                    <Feedback feedback={feedback} phase={phase} />
                )}

                <div className="drill-actions">
                    {complete ? (
                        <>
                            <Link className="btn btn--ghost" to="/learn">Back</Link>
                            <button type="button" className="btn btn--primary" onClick={nextLine}>
                                Next line →
                            </button>
                        </>
                    ) : (
                        <>
                            <Link className="btn btn--ghost btn--sm" to="/learn">Back</Link>
                            <button
                                type="button"
                                className="btn btn--sm"
                                onClick={skip}
                                disabled={phase !== Phase.answering}
                            >
                                Show me
                            </button>
                            <button
                                type="button"
                                className="btn btn--accent btn--sm"
                                onClick={hint}
                                disabled={phase !== Phase.answering}
                            >
                                Hint
                            </button>
                        </>
                    )}
                </div>

                <ol className="drill-moves">
                    {line.moves.slice(0, ply).map((m, i) => (
                        <li key={i} className={line.answerPlies.includes(i) ? "is-yours" : undefined}>
                            {i % 2 === 0 && <b>{i / 2 + 1}.</b>} {m.san}
                        </li>
                    ))}
                </ol>
            </aside>
        </main>
    );
}
