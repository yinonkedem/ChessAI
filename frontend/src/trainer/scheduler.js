/**
 * Leitner-box spaced repetition.
 *
 * Leitner rather than SM-2 on purpose. SM-2's whole machinery is the 0–5
 * quality grade that drives an ease factor, and opening recall is *binary* —
 * you played the book move or you didn't. Feeding a binary signal into SM-2
 * degenerates into Leitner with extra steps and an ease value that drifts for
 * no reason. Fixed boxes also give honest, predictable UI: "due in 3 days" is
 * a fact, not an estimate.
 *
 * MIRRORED IN PYTHON when the backend lands (Phase 6): backend/app/training/
 * scheduler.py must keep BOX_DAYS and the transitions identical. Keeping each
 * to one table plus a few lines is what makes that drift-resistant.
 */

export const BOX_DAYS = [0, 1, 3, 7, 16, 35];
export const MAX_BOX = BOX_DAYS.length - 1;

/** A box this high counts as learned, for progress rings and "mastered" counts. */
export const MASTERED_BOX = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

export function newCard(now = Date.now()) {
    return { box: 0, due: now, reps: 0, lapses: 0, last: null };
}

/**
 * Apply one review.
 *
 * Correct promotes one box. Wrong drops TWO, not all the way to zero: losing
 * everything for a single slip makes long repertoires feel punishing, and
 * dropping two already resets the interval to a day or less.
 */
export function review(card, correct, now = Date.now()) {
    const c = card ?? newCard(now);
    const box = correct
        ? Math.min(c.box + 1, MAX_BOX)
        : Math.max(c.box - 2, 0);

    return {
        box,
        due: now + BOX_DAYS[box] * DAY_MS,
        reps: c.reps + 1,
        lapses: c.lapses + (correct ? 0 : 1),
        last: now,
    };
}

export const isDue = (card, now = Date.now()) => !card || card.due <= now;

export const isMastered = (card) => !!card && card.box >= MASTERED_BOX;

/** Human-readable interval, for the UI. */
export function dueLabel(card, now = Date.now()) {
    if (isDue(card, now)) return "due now";
    const days = Math.round((card.due - now) / DAY_MS);
    if (days <= 0) return "due today";
    if (days === 1) return "due tomorrow";
    return `due in ${days} days`;
}

/* ---------------- day streak ---------------- */

/** Local calendar day, so a streak matches what the user's own clock says. */
export function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
}

/**
 * Roll the day streak forward. Same day is a no-op, consecutive days extend,
 * any gap resets to 1.
 */
export function bumpStreak(stats, now = Date.now()) {
    const today = dayKey(now);
    if (stats.lastActiveDay === today) return stats;

    const yesterday = dayKey(now - DAY_MS);
    const dayStreak = stats.lastActiveDay === yesterday ? stats.dayStreak + 1 : 1;

    return {
        ...stats,
        dayStreak,
        longestStreak: Math.max(stats.longestStreak ?? 0, dayStreak),
        lastActiveDay: today,
    };
}
