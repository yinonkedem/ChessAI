import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ProgressRing from "../components/ui/ProgressRing";
import { loadIndex } from "../trainer/openingsRepo";
import { catalogProgress } from "../trainer/progress";
import { clearAll, load } from "../trainer/localStore";
import { BOX_DAYS, MASTERED_BOX } from "../trainer/scheduler";
import "./ProgressPage.css";

const DAY = 24 * 60 * 60 * 1000;

/** Reviews falling due over the next week, so the workload is visible. */
function upcoming(cards, now) {
    const buckets = Array.from({ length: 8 }, () => 0);
    Object.values(cards).forEach((c) => {
        const days = Math.ceil((c.due - now) / DAY);
        if (days <= 0) buckets[0] += 1;
        else if (days <= 7) buckets[days] += 1;
    });
    return buckets;
}

/** How many cards sit in each Leitner box — the shape of what you know. */
function boxSpread(cards) {
    const spread = BOX_DAYS.map(() => 0);
    Object.values(cards).forEach((c) => {
        spread[Math.min(c.box, spread.length - 1)] += 1;
    });
    return spread;
}

export default function ProgressPage() {
    const [index, setIndex] = useState(null);
    const [state, setState] = useState(() => load());
    const now = Date.now();

    useEffect(() => {
        let cancelled = false;
        loadIndex().then((d) => !cancelled && setIndex(d)).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const { stats, cards } = state;
    const perRep = catalogProgress(now, state);
    const total = Object.keys(cards).length;
    const mastered = Object.values(cards).filter((c) => c.box >= MASTERED_BOX).length;
    const dueNow = Object.values(cards).filter((c) => c.due <= now).length;
    const week = upcoming(cards, now);
    const spread = boxSpread(cards);
    const peak = Math.max(1, ...week);

    function reset() {
        if (!window.confirm("Forget all opening-trainer progress on this device? This can't be undone.")) return;
        clearAll();
        setState(load());
    }

    if (!total) {
        return (
            <main className="page page--progress">
                <div className="progress card">
                    <h1 className="card__title">No progress yet</h1>
                    <p className="card__subtitle">
                        Drill an opening and your reviews will show up here.
                    </p>
                    <Link className="btn btn--primary" to="/learn">Start learning</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="page page--progress">
            <div className="progress">
                <header className="progress__header">
                    <h1>Your progress</h1>
                </header>

                {/* A <dl> because these are term/value pairs — dt and dd are invalid
                    outside one, which axe flags as `dlitem`. */}
                <dl className="progress__tiles" aria-label="Summary">
                    <div className="card progress__tile">
                        <dt>Day streak</dt>
                        <dd>
                            {stats.dayStreak}
                            <span className="subtle">best {stats.longestStreak}</span>
                        </dd>
                    </div>
                    <div className="card progress__tile">
                        <dt>Positions known</dt>
                        <dd>
                            {total}
                            <span className="subtle">{mastered} mastered</span>
                        </dd>
                    </div>
                    <div className="card progress__tile">
                        <dt>Due now</dt>
                        <dd>
                            {dueNow}
                            <span className="subtle">{week[1]} tomorrow</span>
                        </dd>
                    </div>
                    <div className="card progress__tile">
                        <dt>First-time accuracy</dt>
                        <dd>
                            {stats.reviews ? Math.round((stats.correct / stats.reviews) * 100) : 0}%
                            <span className="subtle">{stats.reviews} reviews</span>
                        </dd>
                    </div>
                </dl>

                <section className="card progress__panel" aria-labelledby="upcoming-h">
                    <h2 id="upcoming-h" className="card__title">Coming up</h2>
                    <p className="card__subtitle">Reviews falling due over the next week.</p>
                    <ol className="progress__week">
                        {week.map((n, i) => (
                            <li key={i}>
                                <span
                                    className={`progress__bar${i === 0 && n ? " is-due" : ""}`}
                                    style={{ height: `${(n / peak) * 100}%` }}
                                />
                                <span className="progress__bar-n">{n || ""}</span>
                                <span className="progress__bar-d">{i === 0 ? "now" : `+${i}`}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="card progress__panel" aria-labelledby="boxes-h">
                    <h2 id="boxes-h" className="card__title">How well you know them</h2>
                    <p className="card__subtitle">
                        Each correct answer moves a position up a box; a miss drops it two.
                    </p>
                    <ul className="progress__boxes">
                        {spread.map((n, i) => (
                            <li key={i} className={i >= MASTERED_BOX ? "is-mastered" : undefined}>
                                <b>{n}</b>
                                <span>
                                    box {i}
                                    <i>{BOX_DAYS[i] === 0 ? "new" : `${BOX_DAYS[i]}d`}</i>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                {index && (
                    <section className="progress__reps" aria-label="By repertoire">
                        {index.repertoires
                            .filter((r) => perRep[r.id]?.seen)
                            .sort((a, bb) => (perRep[bb.id].due - perRep[a.id].due))
                            .map((r) => {
                                const p = perRep[r.id];
                                return (
                                    <article key={r.id} className="card progress__rep">
                                        <ProgressRing
                                            percent={Math.round((p.seen / r.cardCount) * 100)}
                                            label={`${p.seen} of ${r.cardCount} positions seen`}
                                        />
                                        <div className="progress__rep-body">
                                            <h3 className="card__title">{r.title}</h3>
                                            <p className="card__subtitle">
                                                {p.seen}/{r.cardCount} seen · {p.mastered} mastered
                                            </p>
                                        </div>
                                        {p.due > 0 ? (
                                            <Link
                                                className="btn btn--primary btn--sm"
                                                to={`/learn/${r.id}/review`}
                                            >
                                                Review {p.due}
                                            </Link>
                                        ) : (
                                            <Link className="btn btn--sm" to={`/learn/${r.id}`}>
                                                Learn
                                            </Link>
                                        )}
                                    </article>
                                );
                            })}
                    </section>
                )}

                <section className="card progress__panel progress__danger" aria-labelledby="reset-h">
                    <h2 id="reset-h" className="card__title">Reset progress</h2>
                    <p className="card__subtitle">
                        Clears every review on this device. If you&apos;re signed in, progress
                        stored on the server is untouched and will come back next time you sign in.
                    </p>
                    <button type="button" className="btn btn--danger btn--sm" onClick={reset}>
                        Forget local progress
                    </button>
                </section>
            </div>
        </main>
    );
}
