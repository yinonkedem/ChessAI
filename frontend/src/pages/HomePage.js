import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { loadIndex } from "../trainer/openingsRepo";
import { catalogProgress } from "../trainer/progress";
import { load } from "../trainer/localStore";
import MiniBoard from "../components/ui/MiniBoard";
import "./HomePage.css";

// 1.e4 e5 2.Nf3 Nc6, White to play 3.Bc4 — the first real idea in the book,
// and the explanation is the book's own text for that move.
const HERO = {
    placement: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R",
    annotations: [
        { type: "arrow", from: [0, 5], to: [3, 2], tone: "good" },
        { type: "square", square: [6, 5], tone: "hint" },
    ],
    label: "Board after 1.e4 e5 2.Nf3 Nc6, with an arrow showing the bishop move to c4 aimed at f7",
    move: "3. Bc4",
    idea: "The Italian bishop. It stares at f7, the square only the king defends.",
};

const FIRST_DRILL = "/learn/italian-white";

const STEPS = [
    {
        icon: "♞",
        title: "Play the book move",
        body: "You get a real position from the opening. Make the move a master would. The opponent answers from theory.",
    },
    {
        icon: "💡",
        title: "Miss it, see why",
        body: "Ask for a hint, or get the answer with an arrow and a line on why the move is played. No guessing in the dark.",
    },
    {
        icon: "🗓",
        title: "Come back when it's due",
        body: "Spaced repetition brings each position back just before you'd forget it. A few minutes a day is enough.",
    },
];

/** The repertoire with the most due positions, and the total across all. */
function dueSummary(progress) {
    let total = 0;
    let top = null;
    for (const [id, p] of Object.entries(progress)) {
        total += p.due;
        if (p.due > 0 && (!top || p.due > top.due)) top = { id, due: p.due };
    }
    return { total, top };
}

function WelcomeBack({ stats, due, titles }) {
    return (
        <section className="card home-welcome" aria-labelledby="home-welcome-title">
            <div>
                <h2 id="home-welcome-title" className="card__title">Welcome back</h2>
                <p className="home-welcome__stats">
                    {stats.dayStreak > 0 && (
                        <span className="chip chip--accent">🔥 {stats.dayStreak} day streak</span>
                    )}
                    <span className="chip">{stats.reviews} moves reviewed</span>
                    {due.total > 0 && (
                        <span className="chip chip--error">{due.total} due now</span>
                    )}
                </p>
            </div>
            {due.top ? (
                <Link className="btn btn--primary" to={`/learn/${due.top.id}/review`}>
                    Review {titles[due.top.id] ?? "due positions"} →
                </Link>
            ) : (
                <Link className="btn btn--primary" to="/learn">
                    Nothing due — learn something new →
                </Link>
            )}
        </section>
    );
}

export default function HomePage() {
    const [index, setIndex] = useState(null);

    // Read once per mount, like the catalog: nothing changes while you're here.
    const [stats] = useState(() => load().stats);
    const [due] = useState(() => dueSummary(catalogProgress()));

    useEffect(() => {
        let cancelled = false;
        // The page is useful without the index — it only adds counts and the
        // opening list — so a failure just leaves those sections out.
        loadIndex()
            .then((data) => !cancelled && setIndex(data))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const repertoires = index?.repertoires ?? [];
    const totals = repertoires.reduce(
        (acc, r) => ({ lines: acc.lines + r.lineCount, cards: acc.cards + r.cardCount }),
        { lines: 0, cards: 0 }
    );
    const titles = Object.fromEntries(repertoires.map((r) => [r.id, r.title]));
    const returning = stats.reviews > 0;

    return (
        <main className="page page--home">
            <div className="home">
                {returning && <WelcomeBack stats={stats} due={due} titles={titles} />}

                <section className="home-hero">
                    <div className="home-hero__text">
                        <span className="chip chip--accent">Opening trainer</span>
                        <h1 className="home-hero__title">Know your openings by heart.</h1>
                        <p className="home-hero__lede">
                            Drill real opening theory one position at a time. Every move comes
                            with the reason it&apos;s played, and spaced repetition brings it back
                            before you forget.
                        </p>
                        <div className="home-hero__ctas">
                            <Link className="btn btn--primary btn--lg" to={FIRST_DRILL}>
                                Try a drill →
                            </Link>
                            <Link className="btn btn--lg" to="/learn">
                                Browse openings
                            </Link>
                        </div>
                        <p className="home-hero__note">No account needed. Sign up later to sync across devices.</p>
                    </div>

                    <figure className="home-hero__figure">
                        <MiniBoard
                            placement={HERO.placement}
                            annotations={HERO.annotations}
                            label={HERO.label}
                        />
                        <figcaption className="card home-hero__caption">
                            <span className="chip chip--primary">✓ Book move</span>
                            <p>
                                <strong>{HERO.move}</strong> — {HERO.idea}
                            </p>
                        </figcaption>
                    </figure>
                </section>

                {index && (
                    <dl className="home-numbers">
                        <div>
                            <dt>Openings</dt>
                            <dd>{repertoires.length}</dd>
                        </div>
                        <div>
                            <dt>Lines</dt>
                            <dd>{totals.lines}</dd>
                        </div>
                        <div>
                            <dt>Positions to learn</dt>
                            <dd>{totals.cards}</dd>
                        </div>
                        {/* Not computed: tools/build_openings.py fails the
                            build if any learner move lacks an idea. */}
                        <div>
                            <dt>Moves explained</dt>
                            <dd>100%</dd>
                        </div>
                    </dl>
                )}

                <section className="home-section" aria-labelledby="home-how">
                    <h2 id="home-how" className="home-section__title">How it works</h2>
                    <ol className="home-steps">
                        {STEPS.map((s) => (
                            <li key={s.title} className="card home-step">
                                <span className="home-step__icon" aria-hidden="true">{s.icon}</span>
                                <h3 className="card__title">{s.title}</h3>
                                <p className="card__subtitle">{s.body}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {index && (
                    <section className="home-section" aria-labelledby="home-openings">
                        <h2 id="home-openings" className="home-section__title">What you can learn</h2>
                        <div className="home-sides">
                            {[
                                { side: "w", label: "As White" },
                                { side: "b", label: "As Black" },
                            ].map(({ side, label }) => (
                                <div key={side} className="card home-side">
                                    <h3 className="card__title">{label}</h3>
                                    <ul className="home-side__list">
                                        {repertoires
                                            .filter((r) => r.side === side)
                                            .map((r) => (
                                                <li key={r.id}>
                                                    <Link to={`/learn/${r.id}`} className="home-side__link">
                                                        <span>{r.title}</span>
                                                        <span className="home-side__meta">
                                                            {r.lineCount} lines
                                                        </span>
                                                    </Link>
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="card home-play" aria-labelledby="home-play-title">
                    <div>
                        <h2 id="home-play-title" className="card__title">Just want a game?</h2>
                        <p className="card__subtitle">
                            Play Stockfish at any strength, or set up a position and play it out.
                        </p>
                    </div>
                    <Link className="btn" to="/play">
                        Play a game
                    </Link>
                </section>
            </div>
        </main>
    );
}
