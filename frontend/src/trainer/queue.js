/**
 * The in-session learning-step queue.
 *
 * This is the part neither Leitner nor SM-2 gives you, and the part that makes
 * a session feel like learning rather than a quiz. Both algorithms schedule in
 * DAYS — but if you miss a move at 14:02, the useful moment to ask again is
 * 14:03, not tomorrow.
 *
 * So: a missed position is reinserted a few cards later and must be answered
 * correctly TWICE IN A ROW before it leaves the session. What gets reported to
 * the scheduler is the FIRST attempt, once per position — otherwise drilling
 * something until it sticks would inflate its interval as if you had known it.
 */

export const LEARNING_GAP = 3;      // how far ahead a missed card comes back
export const GRADUATE_AT = 2;       // consecutive correct needed to leave

export function createQueue(paths) {
    return {
        pending: [...paths],
        index: 0,
        streaks: {},     // path -> consecutive correct this session
        firstTry: {},    // path -> was the FIRST attempt correct
        done: [],
    };
}

export const currentCard = (q) => q.pending[q.index] ?? null;

export const remaining = (q) => Math.max(0, q.pending.length - q.index);

export const isFinished = (q) => q.index >= q.pending.length;

/**
 * Record an answer for the current card and advance.
 *
 * Returns the new queue. `graded` is the path that should be reported to the
 * spaced-repetition scheduler this call, or null when it has already been
 * reported (a re-ask within the same session).
 */
export function answer(q, correct) {
    const path = currentCard(q);
    if (path == null) return { queue: q, graded: null };

    const firstEncounter = !(path in q.firstTry);
    const firstTry = { ...q.firstTry };
    if (firstEncounter) firstTry[path] = correct;

    const streaks = { ...q.streaks, [path]: correct ? (q.streaks[path] ?? 0) + 1 : 0 };
    const pending = [...q.pending];
    const done = [...q.done];

    if (correct && streaks[path] >= GRADUATE_AT) {
        done.push(path);
    } else if (correct && firstEncounter) {
        // Right first time: that is enough, don't make them prove it twice.
        done.push(path);
    } else {
        // Missed it, or still rebuilding the streak — ask again shortly.
        const reinsertAt = Math.min(q.index + 1 + LEARNING_GAP, pending.length);
        pending.splice(reinsertAt, 0, path);
    }

    return {
        queue: { ...q, pending, index: q.index + 1, streaks, firstTry, done },
        // Only the first attempt reaches the scheduler.
        graded: firstEncounter ? { path, correct } : null,
    };
}

/** End-of-session numbers for the summary card. */
export function summarise(q) {
    const paths = Object.keys(q.firstTry);
    const right = paths.filter((p) => q.firstTry[p]).length;
    return {
        positions: paths.length,
        firstTry: right,
        accuracy: paths.length ? Math.round((right / paths.length) * 100) : 0,
    };
}
