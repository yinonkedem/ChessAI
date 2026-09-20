import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Board from "../components/Board/Board";
import { loadRepertoire } from "../trainer/openingsRepo";
import { useTrainer } from "../trainer/TrainerContext";
import useBookAgent from "../trainer/useBookAgent";
import { Phase } from "../trainer/trainerReducer";
import { cardsFor } from "../trainer/localStore";
import { dueLabel } from "../trainer/scheduler";
import "./DrillPage.css";

/** One dot per move played on this run: green first-try, amber if it took help. */
function RunDots({ moves, results }) {
    let path = "";
    const dots = [];
    moves.forEach((m, i) => {
        if (m.mine) {
            const r = results[path];
            dots.push(
                <i key={i} className={r?.firstTry ? "is-good" : "is-missed"} />
            );
        }
        path += m.uci;
    });
    dots.push(<i key="now" className="is-current" />);
    return <div className="drill-dots" aria-hidden="true">{dots}</div>;
}

function Feedback({ feedback, phase }) {
    if (phase === Phase.lineComplete) return null;

    if (!feedback) {
        return (
            <div className="card drill-feedback">
                <p className="drill-feedback__title">Your move</p>
                <p className="drill-feedback__body muted">
                    Play the move the book recommends.
                </p>
            </div>
        );
    }

    const { verdict, played, idea, expected, alternatives } = feedback;
    const kind = verdict === "correct" ? "good" : verdict === "skipped" ? "neutral" : "bad";

    return (
        <div className={`card drill-feedback drill-feedback--${kind}`} role="status">
            <p className="drill-feedback__title">
                <span aria-hidden="true">
                    {verdict === "correct" ? "\u2713" : verdict === "skipped" ? "\u2192" : "\u2717"}
                </span>{" "}
                {verdict === "correct" && `Correct — ${played}`}
                {verdict === "skipped" && `The book plays ${played}`}
                {verdict === "wrong" && "Not a book move"}
            </p>

            {verdict === "wrong" && (
                <p className="drill-feedback__body">
                    {expected.length === 1
                        ? "Try again, or take a hint."
                        : `There are ${expected.length} book moves here. Try again, or take a hint.`}
                </p>
            )}

            {idea && <p className="drill-feedback__body">{idea}</p>}

            {verdict === "correct" && alternatives > 0 && (
                <p className="drill-feedback__body muted">
                    {alternatives === 1
                        ? "One other move is also theory here."
                        : `${alternatives} other moves are also theory here.`}
                </p>
            )}
        </div>
    );
}

export default function DrillPage() {
    const { repertoireId } = useParams();
    const { session, start, hint, skip, restart, moves, opening, progress } = useTrainer();
    const [error, setError] = useState(null);

    useBookAgent();

    useEffect(() => {
        let cancelled = false;
        loadRepertoire(repertoireId)
            .then((rep) => !cancelled && start(rep))
            .catch((err) => !cancelled && setError(err.message));
        return () => {
            cancelled = true;
        };
    }, [repertoireId, start]);

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

    const { repertoire, phase, feedback, results, streak, path, hintLevel } = session;
    if (!repertoire) {
        return (
            <main className="page page--drill">
                <p className="muted">Loading…</p>
            </main>
        );
    }

    const complete = phase === Phase.lineComplete;
    const perfect = complete && progress.answered > 0 && progress.firstTry === progress.answered;
    const choices = repertoire.nodes[path]?.replies.length ?? 0;

    // What the scheduler did with the positions just answered.
    let nextUp = null;
    if (complete && progress.answered > 0) {
        const cards = cardsFor(repertoire.id);
        const answered = Object.keys(results)
            .map((p) => cards[p])
            .filter(Boolean);
        if (answered.length) {
            const soonest = answered.reduce((a, b) => (a.due <= b.due ? a : b));
            nextUp = `${answered.length} position${answered.length === 1 ? "" : "s"}, `
                + `next ${dueLabel(soonest)}`;
        }
    }

    return (
        <main className="page page--drill">
            <Board />

            <aside className="drill-rail">
                <header className="card drill-head">
                    <div className="drill-head__top">
                        {opening.eco && <span className="chip">{opening.eco}</span>}
                        <span className={`chip chip--${repertoire.side === "w" ? "accent" : "primary"}`}>
                            {repertoire.side === "w" ? "You play White" : "You play Black"}
                        </span>
                    </div>
                    <h1 className="card__title">{repertoire.title}</h1>
                    {/* Updates live as the line deepens — this is how the
                        learner sees which variation they have steered into. */}
                    <p className="drill-head__line">{opening.name || repertoire.family}</p>

                    <RunDots moves={moves} results={results} />
                    {phase === Phase.answering && choices > 1 && (
                        <p className="drill-head__choices">
                            {choices} book moves here — any of them counts
                        </p>
                    )}
                    <p className="drill-head__count">
                        {opening.depth} moves deep · {progress.firstTry}/{progress.answered || 0} first time
                        {streak > 1 && <span className="drill-head__streak"> · {streak} in a row</span>}
                    </p>
                </header>

                {complete ? (
                    <div className="card drill-feedback drill-feedback--good">
                        <p className="drill-feedback__title">
                            <span aria-hidden="true">{perfect ? "\u2605" : "\u2713"}</span>{" "}
                            {perfect ? "Perfect line!" : "End of the line"}
                        </p>
                        <p className="drill-feedback__body">
                            {opening.name && `You reached the ${opening.name}. `}
                            {progress.firstTry} of {progress.answered} first time.
                        </p>
                        {/* Show when this material comes back. Spaced repetition
                            is invisible unless you say what it scheduled. */}
                        {nextUp && (
                            <p className="drill-feedback__body muted">
                                Scheduled: {nextUp}
                            </p>
                        )}
                    </div>
                ) : (
                    <Feedback feedback={feedback} phase={phase} />
                )}

                <div className="drill-actions">
                    {complete ? (
                        <>
                            <Link className="btn btn--ghost" to="/learn">Back</Link>
                            <button type="button" className="btn btn--primary" onClick={restart}>
                                Go again →
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
                                disabled={phase !== Phase.answering || hintLevel >= 2}
                            >
                                {/* Two stages: which piece, then where it goes.
                                    Being nudged teaches more than being told. */}
                                {hintLevel === 0 ? "Hint" : hintLevel === 1 ? "More" : "Shown"}
                            </button>
                        </>
                    )}
                </div>

                {moves.length > 0 && (
                <ol className="drill-moves">
                    {moves.map((m, i) => (
                        <li key={i} className={m.mine ? "is-yours" : undefined}>
                            {i % 2 === 0 && <b>{i / 2 + 1}.</b>} {m.san}
                        </li>
                    ))}
                </ol>
                )}
            </aside>
        </main>
    );
}
