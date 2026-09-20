import {
    BOX_DAYS,
    MAX_BOX,
    bumpStreak,
    dayKey,
    dueLabel,
    isDue,
    isMastered,
    newCard,
    review,
} from "./scheduler";
import { GRADUATE_AT, LEARNING_GAP, answer, createQueue, currentCard, isFinished, summarise } from "./queue";
import { cardKey, cardsFor, clearAll, load, recordReview } from "./localStore";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-06-15T12:00:00Z").getTime();

describe("Leitner scheduler", () => {
    it("starts a new card due immediately in box 0", () => {
        const c = newCard(T0);
        expect(c.box).toBe(0);
        expect(isDue(c, T0)).toBe(true);
    });

    it("treats a missing card as due — unseen material is always available", () => {
        expect(isDue(undefined, T0)).toBe(true);
    });

    it("promotes one box on a correct answer", () => {
        expect(review(newCard(T0), true, T0).box).toBe(1);
    });

    it("schedules the next review by the box interval", () => {
        const c = review(newCard(T0), true, T0);
        expect(c.due).toBe(T0 + BOX_DAYS[1] * DAY);
        expect(isDue(c, T0)).toBe(false);
        expect(isDue(c, T0 + BOX_DAYS[1] * DAY)).toBe(true);
    });

    it("climbs to the top box and stops there", () => {
        let c = newCard(T0);
        for (let i = 0; i < 10; i++) c = review(c, true, T0);
        expect(c.box).toBe(MAX_BOX);
        expect(c.reps).toBe(10);
    });

    it("drops two boxes on a miss, not all the way to zero", () => {
        let c = newCard(T0);
        for (let i = 0; i < 4; i++) c = review(c, true, T0);
        expect(c.box).toBe(4);
        expect(review(c, false, T0).box).toBe(2);
    });

    it("never drops below box 0", () => {
        expect(review(newCard(T0), false, T0).box).toBe(0);
    });

    it("counts lapses only on misses", () => {
        let c = review(newCard(T0), true, T0);
        expect(c.lapses).toBe(0);
        c = review(c, false, T0);
        expect(c.lapses).toBe(1);
    });

    it("marks a card mastered once it is deep enough", () => {
        let c = newCard(T0);
        expect(isMastered(c)).toBe(false);
        for (let i = 0; i < 4; i++) c = review(c, true, T0);
        expect(isMastered(c)).toBe(true);
    });

    it("describes the interval honestly", () => {
        expect(dueLabel(newCard(T0), T0)).toBe("due now");
        expect(dueLabel(review(newCard(T0), true, T0), T0)).toBe("due tomorrow");
        let c = newCard(T0);
        for (let i = 0; i < 3; i++) c = review(c, true, T0);
        expect(dueLabel(c, T0)).toBe("due in 7 days");
    });
});

describe("day streak", () => {
    const base = { dayStreak: 0, longestStreak: 0, lastActiveDay: null };

    it("starts at 1 on the first day", () => {
        expect(bumpStreak(base, T0).dayStreak).toBe(1);
    });

    it("is a no-op twice in the same day", () => {
        const a = bumpStreak(base, T0);
        expect(bumpStreak(a, T0 + 3600_000)).toBe(a);
    });

    it("extends on consecutive days", () => {
        let s = bumpStreak(base, T0);
        s = bumpStreak(s, T0 + DAY);
        s = bumpStreak(s, T0 + 2 * DAY);
        expect(s.dayStreak).toBe(3);
    });

    it("resets after a gap but remembers the best", () => {
        let s = bumpStreak(base, T0);
        s = bumpStreak(s, T0 + DAY);
        s = bumpStreak(s, T0 + 5 * DAY);
        expect(s.dayStreak).toBe(1);
        expect(s.longestStreak).toBe(2);
    });

    it("uses the local calendar day", () => {
        expect(dayKey(T0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("learning-step queue", () => {
    const paths = ["a", "b", "c", "d", "e"];

    it("serves cards in order", () => {
        const q = createQueue(paths);
        expect(currentCard(q)).toBe("a");
    });

    it("a first-time-correct card graduates immediately", () => {
        const { queue, graded } = answer(createQueue(paths), true);
        expect(queue.done).toContain("a");
        expect(queue.pending).toHaveLength(5);
        expect(graded).toEqual({ path: "a", correct: true });
    });

    it("a missed card comes back later in the same session", () => {
        const { queue } = answer(createQueue(paths), false);
        expect(queue.pending).toHaveLength(6);
        expect(queue.pending.lastIndexOf("a")).toBeGreaterThan(0);
        expect(queue.pending[Math.min(1 + LEARNING_GAP, 5)]).toBe("a");
    });

    it("only the FIRST attempt is reported to the scheduler", () => {
        // Getting it right on the third try must not look like knowing it.
        let q = createQueue(["a"]);
        const first = answer(q, false);
        expect(first.graded).toEqual({ path: "a", correct: false });
        q = first.queue;
        const second = answer(q, true);
        expect(second.graded).toBeNull();
    });

    it("a missed card must be answered correctly twice to leave", () => {
        let q = createQueue(["a"]);
        q = answer(q, false).queue;          // missed
        q = answer(q, true).queue;           // 1st correct — not enough
        expect(q.done).not.toContain("a");
        expect(q.pending.length).toBeGreaterThan(2);
        q = answer(q, true).queue;           // 2nd correct — graduates
        expect(q.done).toContain("a");
    });

    it(`GRADUATE_AT is ${GRADUATE_AT} consecutive correct`, () => {
        expect(GRADUATE_AT).toBe(2);
    });

    it("a second miss resets the consecutive count", () => {
        let q = createQueue(["a"]);
        q = answer(q, false).queue;
        q = answer(q, true).queue;
        q = answer(q, false).queue;
        expect(q.streaks.a).toBe(0);
        expect(q.done).not.toContain("a");
    });

    it("finishes once every card has graduated", () => {
        let q = createQueue(["a", "b"]);
        q = answer(q, true).queue;
        q = answer(q, true).queue;
        expect(isFinished(q)).toBe(true);
    });

    it("summarises first-attempt accuracy, not eventual accuracy", () => {
        let q = createQueue(["a", "b"]);
        q = answer(q, true).queue;    // a right first time
        q = answer(q, false).queue;   // b missed
        q = answer(q, true).queue;    // b right on retry
        const s = summarise(q);
        expect(s.positions).toBe(2);
        expect(s.firstTry).toBe(1);
        expect(s.accuracy).toBe(50);
    });

    it("answering an empty queue is a no-op", () => {
        const q = createQueue([]);
        expect(answer(q, true)).toEqual({ queue: q, graded: null });
    });
});

describe("local persistence", () => {
    beforeEach(() => clearAll());

    it("starts empty", () => {
        expect(load().cards).toEqual({});
        expect(load().stats.dayStreak).toBe(0);
    });

    it("stores a review and can read it back", () => {
        recordReview("italian-white", "e2e4", true, T0);
        const cards = cardsFor("italian-white");
        expect(cards["e2e4"].box).toBe(1);
        expect(cards["e2e4"].reps).toBe(1);
    });

    it("namespaces cards per repertoire", () => {
        recordReview("italian-white", "e2e4", true, T0);
        recordReview("ruy-lopez-white", "e2e4", true, T0);
        expect(Object.keys(cardsFor("italian-white"))).toEqual(["e2e4"]);
        expect(Object.keys(cardsFor("ruy-lopez-white"))).toEqual(["e2e4"]);
        expect(cardKey("a", "b")).toBe("a|b");
    });

    it("accumulates review and correct counts", () => {
        recordReview("r", "p1", true, T0);
        recordReview("r", "p2", false, T0);
        const { stats } = load();
        expect(stats.reviews).toBe(2);
        expect(stats.correct).toBe(1);
    });

    it("rolls the day streak as reviews happen", () => {
        recordReview("r", "p", true, T0);
        expect(load().stats.dayStreak).toBe(1);
        recordReview("r", "p", true, T0 + DAY);
        expect(load().stats.dayStreak).toBe(2);
    });

    it("survives corrupted storage", () => {
        localStorage.setItem("chess-trainer-v1", "{not json");
        expect(load().cards).toEqual({});
    });

    it("ignores data from a future schema version", () => {
        localStorage.setItem("chess-trainer-v1", JSON.stringify({ version: 99, cards: { x: 1 } }));
        expect(load().cards).toEqual({});
    });
});

describe("reviewing ahead of schedule", () => {
    beforeEach(() => clearAll());

    it("does not promote a card that is not due yet", () => {
        recordReview("r", "p", true, T0);                 // box 0 -> 1, due +1d
        const after = cardsFor("r")["p"];
        recordReview("r", "p", true, T0 + 60_000);        // same day, not due
        expect(cardsFor("r")["p"]).toEqual(after);
    });

    it("still records a MISS on a card that is not due", () => {
        let c = null;
        for (let i = 0; i < 4; i++) {
            recordReview("r", "p", true, T0 + i * DAY * 10);
        }
        c = cardsFor("r")["p"];
        expect(c.box).toBeGreaterThan(1);
        recordReview("r", "p", false, T0 + 1000);          // forgot it early
        expect(cardsFor("r")["p"].box).toBeLessThan(c.box);
    });

    it("promotes normally once the card comes due", () => {
        recordReview("r", "p", true, T0);
        expect(cardsFor("r")["p"].box).toBe(1);
        recordReview("r", "p", true, T0 + DAY);            // now due
        expect(cardsFor("r")["p"].box).toBe(2);
    });
});
