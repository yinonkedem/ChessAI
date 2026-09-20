/**
 * Bridges the local store to the backend.
 *
 * Local-first, deliberately: Render's free tier sleeps, so a cold start is
 * ~10 seconds and a learner must never wait on it to answer "what's due?".
 * Every review is written to localStorage immediately and queued in an
 * outbox; the server is caught up opportunistically. Signed out, none of this
 * runs and the trainer works exactly the same.
 */

import { fetchCards, pushReviews } from "../api/training";
import { clearOutbox, mergeServerCards, pendingReviews } from "./localStore";

const BATCH = 200;

/** Send queued reviews. Safe to call when there is nothing to send. */
export async function flushOutbox() {
    const queued = pendingReviews();
    if (!queued.length) return { pushed: 0 };

    const batch = queued.slice(0, BATCH);
    await pushReviews(batch);
    // Only drop what was accepted — a later failure must not lose the rest.
    clearOutbox(batch.length);
    return { pushed: batch.length };
}

/**
 * Called on sign-in: push anything drilled while logged out, then fold the
 * server's cards in. Order matters — pushing first means the merge sees this
 * device's work rather than overwriting it.
 */
export async function syncOnLogin() {
    await flushOutbox().catch(() => ({ pushed: 0 }));
    const cards = await fetchCards();
    mergeServerCards(cards ?? []);
    return { merged: cards?.length ?? 0 };
}
