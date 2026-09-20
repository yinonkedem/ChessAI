/**
 * Local persistence for spaced repetition.
 *
 * Deliberately local-first, and deliberately independent of whether the user
 * has an account: Render's free tier sleeps, so a cold start is ~10 seconds,
 * and a learner should never wait on a server to answer "what's due?".
 * Phase 6 syncs this to the backend; nothing here needs to change when it does.
 *
 * Every access is wrapped — private windows and blocked site data make
 * localStorage throw, and a trainer that crashes rather than forgetting your
 * streak is the worse outcome.
 */

import { bumpStreak, isDue, newCard, review as applyReview } from "./scheduler";

const KEY = "chess-trainer-v1";

const EMPTY = {
    version: 1,
    cards: {},   // "<repertoireId>|<path>" -> card
    stats: { dayStreak: 0, longestStreak: 0, lastActiveDay: null, reviews: 0, correct: 0 },
};

export const cardKey = (repertoireId, path) => `${repertoireId}|${path}`;

function read() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...EMPTY, cards: {}, stats: { ...EMPTY.stats } };
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1) return { ...EMPTY, cards: {}, stats: { ...EMPTY.stats } };
        return {
            version: 1,
            cards: parsed.cards ?? {},
            stats: { ...EMPTY.stats, ...(parsed.stats ?? {}) },
        };
    } catch {
        return { ...EMPTY, cards: {}, stats: { ...EMPTY.stats } };
    }
}

function write(state) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        /* quota or private mode — progress is lost, the drill still works */
    }
    return state;
}

export const load = read;

/**
 * Record one review and roll the day streak. Returns the new state.
 *
 * Answering something that is NOT yet due does not promote it — otherwise
 * replaying a line five times in an afternoon would push every position to the
 * top box without a single day passing, and the schedule would be a lie.
 *
 * A MISS is always recorded, though. Forgetting something you were supposed to
 * know is real information, whenever it happens.
 */
export function recordReview(repertoireId, path, correct, now = Date.now()) {
    const state = read();
    const key = cardKey(repertoireId, path);
    const existing = state.cards[key];

    if (correct && existing && !isDue(existing, now)) {
        return state;   // ahead of schedule: nothing to learn from a hit
    }

    const next = applyReview(existing ?? newCard(now), correct, now);

    return write({
        ...state,
        cards: { ...state.cards, [key]: next },
        stats: {
            ...bumpStreak(state.stats, now),
            reviews: state.stats.reviews + 1,
            correct: state.stats.correct + (correct ? 1 : 0),
        },
    });
}

/** Cards for one repertoire, keyed by path. */
export function cardsFor(repertoireId, state = read()) {
    const prefix = `${repertoireId}|`;
    const out = {};
    for (const [k, v] of Object.entries(state.cards)) {
        if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    }
    return out;
}

export function clearAll() {
    try {
        localStorage.removeItem(KEY);
    } catch {
        /* non-fatal */
    }
}
