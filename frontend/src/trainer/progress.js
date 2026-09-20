import { myPositions } from "./book";
import { cardsFor, load } from "./localStore";
import { isDue, isMastered } from "./scheduler";

/**
 * Progress for one repertoire, as the catalog and drill screens show it.
 *
 * `total` counts positions the learner must answer — the tree's own card
 * count, so a shared prefix like 1.e4 counts once however many lines use it.
 */
export function repertoireProgress(repertoire, now = Date.now(), state = load()) {
    const cards = cardsFor(repertoire.id, state);
    const positions = myPositions(repertoire);

    let seen = 0;
    let due = 0;
    let mastered = 0;

    positions.forEach((p) => {
        const card = cards[p];
        if (!card) return;          // never attempted — not due, not seen
        seen += 1;
        if (isDue(card, now)) due += 1;
        if (isMastered(card)) mastered += 1;
    });

    return {
        total: positions.length,
        seen,
        due,
        mastered,
        fresh: positions.length - seen,
        percent: positions.length ? Math.round((mastered / positions.length) * 100) : 0,
    };
}

/**
 * Due counts for the catalog, without loading every repertoire's move data.
 *
 * The catalog only has `cardCount`, not the paths, so this counts stored cards
 * that are due rather than intersecting with the tree. A card can only exist
 * because the learner answered that position, so the count is still correct.
 */
export function catalogProgress(now = Date.now(), state = load()) {
    const out = {};
    for (const [key, card] of Object.entries(state.cards)) {
        const id = key.slice(0, key.indexOf("|"));
        const bucket = (out[id] ??= { seen: 0, due: 0, mastered: 0 });
        bucket.seen += 1;
        if (isDue(card, now)) bucket.due += 1;
        if (isMastered(card)) bucket.mastered += 1;
    }
    return out;
}

/**
 * Positions due for review, most overdue first.
 *
 * Only positions the learner has actually met. An unseen position counts as
 * "due" to the scheduler — that is what makes new material available — but a
 * *review* session must not serve it: the catalog would promise "6 due" and
 * then queue all 40, and reviewing is supposed to mean "what I already learned
 * and owe". New material belongs in Learn mode.
 *
 * Pass `includeNew` for a combined session.
 */
export function duePositions(repertoire, now = Date.now(), state = load(), includeNew = false) {
    const cards = cardsFor(repertoire.id, state);
    return myPositions(repertoire)
        .filter((p) => (cards[p] ? isDue(cards[p], now) : includeNew))
        .sort((a, b) => {
            const ca = cards[a];
            const cb = cards[b];
            if (!ca && cb) return 1;          // unseen last
            if (ca && !cb) return -1;
            if (!ca && !cb) return a.length - b.length;
            return ca.due - cb.due;           // most overdue first
        });
}
