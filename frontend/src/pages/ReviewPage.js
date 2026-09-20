import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Board from "../components/Board/Board";
import ProgressRing from "../components/ui/ProgressRing";
import { loadRepertoire } from "../trainer/openingsRepo";
import { useTrainer } from "../trainer/TrainerContext";
import useReviewAgent from "../trainer/useReviewAgent";
import { Phase } from "../trainer/trainerReducer";
import { cardsFor } from "../trainer/localStore";
import { dueLabel } from "../trainer/scheduler";
import "./DrillPage.css";
import "./ReviewPage.css";

export default function ReviewPage() {
    const { repertoireId } = useParams();
    const { session, startReview, review, moves, opening } = useTrainer();
    const [error, setError] = useState(null);

    useReviewAgent();

    useEffect(() => {
        let cancelled = false;
        loadRepertoire(repertoireId)
            .then((rep) => !cancelled && startReview(rep))
            .catch((err) => !cancelled && setError(err.message));
        return () => {
            cancelled = true;
        };
    }, [repertoireId, startReview]);

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

    const { repertoire, phase, feedback, lastCorrect } = session;
    if (!repertoire) {
        return (
            <main className="page page--drill">
                <p className="muted">Loading…</p>
            </main>
        );
    }

    // Nothing due: say so plainly rather than showing an empty board.
    if (phase === Phase.sessionComplete && !review?.positions) {
        return (
            <main className="page page--drill">
                <div className="review-done card">
                    <h1 className="card__title">Nothing due right now</h1>
                    <p className="card__subtitle">
                        You&apos;re up to date on {repertoire.title}. Learn some new lines, or come
                        back when these come round again.
                    </p>
                    <div className="drill-actions">
                        <Link className="btn btn--ghost" to="/learn">Back</Link>
                        <Link className="btn btn--primary" to={`/learn/${repertoire.id}`}>
                            Learn new lines
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (phase === Phase.sessionComplete) {
        const cards = cardsFor(repertoire.id);
        const touched = Object.keys(session.results).map((p) => cards[p]).filter(Boolean);
        const soonest = touched.length
            ? touched.reduce((a, b) => (a.due <= b.due ? a : b))
            : null;

        return (
            <main className="page page--drill">
                <div className="review-done card">
                    <ProgressRing percent={review.accuracy} size={72} label={`${review.accuracy}% first time`} />
                    <h1 className="card__title">Reviews cleared</h1>
                    <p className="card__subtitle">
                        {review.firstTry} of {review.positions} right first time
                        {session.bestStreak > 2 && ` · best run ${session.bestStreak}`}
                    </p>
                    {soonest && (
                        <p className="muted review-done__next">Next review {dueLabel(soonest)}.</p>
                    )}
                    <div className="drill-actions">
                        <Link className="btn btn--ghost" to="/learn">Back to openings</Link>
                        <Link className="btn btn--primary" to={`/learn/${repertoire.id}`}>
                            Learn new lines
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const revealing = phase === Phase.reveal;
    const total = (review?.positions ?? 0) + (review?.left ?? 0);

    return (
        <main className="page page--drill">
            <Board />

            <aside className="drill-rail">
                <header className="card drill-head">
                    <div className="drill-head__top">
                        {opening.eco && <span className="chip">{opening.eco}</span>}
                        <span className={`chip chip--${repertoire.side === "w" ? "accent" : "primary"}`}>
                            {repertoire.side === "w" ? "White to play" : "Black to play"}
                        </span>
                    </div>
                    <h1 className="card__title">Review · {repertoire.title}</h1>
                    <p className="drill-head__line">{opening.name || repertoire.family}</p>

                    {/* A review is a queue you empty, so show what's left. */}
                    <div className="review-bar" aria-hidden="true">
                        <span style={{ width: `${total ? (review.positions / total) * 100 : 0}%` }} />
                    </div>
                    <p className="drill-head__count">
                        {review.left} to go · {review.firstTry}/{review.positions || 0} first time
                    </p>
                </header>

                <div
                    className={`card drill-feedback${
                        revealing ? (lastCorrect ? " drill-feedback--good" : " drill-feedback--bad") : ""
                    }`}
                    role="status"
                >
                    {!revealing ? (
                        <>
                            <p className="drill-feedback__title">What does the book play?</p>
                            <p className="drill-feedback__body muted">
                                One attempt. Miss it and you&apos;ll see it again before the end.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="drill-feedback__title">
                                <span aria-hidden="true">{lastCorrect ? "✓" : "✗"}</span>{" "}
                                {lastCorrect
                                    ? `Correct — ${feedback.played}`
                                    : `The book plays ${feedback.played}`}
                            </p>
                            {feedback?.idea && (
                                <p className="drill-feedback__body">{feedback.idea}</p>
                            )}
                            {!lastCorrect && (
                                <p className="drill-feedback__body muted">
                                    You&apos;ll see this one again shortly.
                                </p>
                            )}
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

                <div className="drill-actions">
                    <Link className="btn btn--ghost btn--sm" to="/learn">End session</Link>
                </div>
            </aside>
        </main>
    );
}
