import { chooseReply, describe, isEnd, isMine, pathMoves } from "./book";
import {
    answer as answerQueue,
    createQueue,
    currentCard,
    isFinished as queueFinished,
    remaining,
    summarise,
} from "./queue";

/**
 * Drill-session state, keyed on the UCI path through the opening tree.
 *
 * Deliberately separate from the global game reducer:
 * - StartScreen.js:17 dispatches RESET_ALL on mount, so anything kept there is
 *   wiped the moment the user taps the toolbar brand.
 * - The global reducer is persisted to localStorage on every change; a drill
 *   session is not something you want to half-resume after a refresh.
 */

export const Phase = {
    idle: "idle",
    answering: "answering",   // waiting for the learner's move
    reply: "reply",           // the book's reply is about to play
    lineComplete: "lineComplete",
    reveal: "reveal",         // review mode: showing the result before the next card
    sessionComplete: "sessionComplete",
};

/**
 * Two ways to drill:
 *   learn  — walk a line from the start, opponent answers from the book.
 *   review — serve the positions that are DUE, one standalone card at a time.
 * Review is what turns "I played through a line" into "I cleared today's
 * reviews", and it is where the learning-step queue lives.
 */
export const Mode = { learn: "learn", review: "review" };

export const initialTrainerState = {
    mode: Mode.learn,
    queue: null,        // review mode only
    lastCorrect: null,  // review mode: how the card just shown went
    repertoire: null,
    path: "",
    phase: Phase.idle,
    feedback: null,     // { verdict, expected[], idea, alternatives }
    hintLevel: 0,       // 0 none, 1 highlight the piece, 2 show the square
    attempts: 0,        // attempts at the CURRENT position
    results: {},        // { [path]: { firstTry, attempts, skipped? } }
    streak: 0,
    bestStreak: 0,
    runs: 0,            // lines finished this session
};

export const T = {
    START: "START",
    START_REVIEW: "START_REVIEW",
    NEXT_CARD: "NEXT_CARD",
    ATTEMPT: "ATTEMPT",
    ADVANCE: "ADVANCE",
    HINT: "HINT",
    SKIP: "SKIP",
    RESTART: "RESTART",
    RESET: "RESET",
};

/** Which phase does this position put us in? */
function phaseAt(repertoire, path) {
    if (isEnd(repertoire, path)) return Phase.lineComplete;
    return isMine(repertoire, path) ? Phase.answering : Phase.reply;
}

export function trainerReducer(state, action) {
    switch (action.type) {
        case T.START: {
            const { repertoire } = action.payload;
            return {
                ...state,
                mode: Mode.learn,
                queue: null,
                repertoire,
                path: "",
                phase: phaseAt(repertoire, ""),
                feedback: null,
                hintLevel: 0,
                attempts: 0,
                results: {},
            };
        }

        case T.START_REVIEW: {
            const { repertoire, paths } = action.payload;
            const queue = createQueue(paths);
            const first = currentCard(queue);
            return {
                ...state,
                mode: Mode.review,
                repertoire,
                queue,
                path: first ?? "",
                phase: first == null ? Phase.sessionComplete : Phase.answering,
                feedback: null,
                hintLevel: 0,
                attempts: 0,
                results: {},
                lastCorrect: null,
            };
        }

        // Review mode: the reveal timer expired, move to the next due card.
        case T.NEXT_CARD: {
            if (state.phase !== Phase.reveal) return state;
            const next = currentCard(state.queue);
            if (next == null || queueFinished(state.queue)) {
                return { ...state, phase: Phase.sessionComplete };
            }
            return {
                ...state,
                path: next,
                phase: Phase.answering,
                feedback: null,
                hintLevel: 0,
                attempts: 0,
                lastCorrect: null,
            };
        }

        case T.ATTEMPT: {
            if (state.phase !== Phase.answering) return state;
            const { verdict, played, replies } = action.payload;

            // --- review mode: one shot per card, then reveal and move on.
            // A miss is reinserted a few cards later by the queue, so the
            // learner meets it again this session rather than tomorrow.
            if (state.mode === Mode.review) {
                const correct = verdict === "correct";
                const { queue } = answerQueue(state.queue, correct);
                const shown = replies[0];
                return {
                    ...state,
                    queue,
                    phase: Phase.reveal,
                    lastCorrect: correct,
                    streak: correct ? state.streak + 1 : 0,
                    bestStreak: Math.max(state.bestStreak, correct ? state.streak + 1 : 0),
                    results: {
                        ...state.results,
                        [state.path]: { firstTry: correct, attempts: state.attempts },
                    },
                    feedback: {
                        verdict: correct ? "correct" : "wrong",
                        played: correct ? played.san : shown?.san ?? null,
                        playedUci: correct ? played.uci : shown?.uci ?? null,
                        idea: (correct ? played : shown)?.idea ?? null,
                        expected: replies.map((r) => r.san),
                        alternatives: correct ? replies.length - 1 : 0,
                    },
                };
            }

            if (verdict !== "correct") {
                return {
                    ...state,
                    attempts: state.attempts + 1,
                    streak: 0,
                    feedback: {
                        verdict: "wrong",
                        expected: replies.map((r) => r.san),
                        idea: null,
                    },
                };
            }

            const firstTry = state.attempts === 0 && state.hintLevel === 0;
            const streak = firstTry ? state.streak + 1 : 0;
            const nextPath = state.path + played.uci;

            return {
                ...state,
                path: nextPath,
                phase: phaseAt(state.repertoire, nextPath),
                attempts: 0,
                hintLevel: 0,
                streak,
                bestStreak: Math.max(state.bestStreak, streak),
                results: {
                    ...state.results,
                    [state.path]: { firstTry, attempts: state.attempts },
                },
                feedback: {
                    verdict: "correct",
                    played: played.san,
                    idea: played.idea ?? null,
                    // How many OTHER book moves were available here. Worth
                    // surfacing: it teaches that openings branch.
                    alternatives: replies.length - 1,
                },
            };
        }

        // The book's reply landed.
        case T.ADVANCE: {
            if (state.phase !== Phase.reply) return state;
            const reply = action.payload?.reply ?? chooseReply(state.repertoire, state.path);
            if (!reply) return { ...state, phase: Phase.lineComplete };
            const nextPath = state.path + reply.uci;
            return {
                ...state,
                path: nextPath,
                phase: phaseAt(state.repertoire, nextPath),
            };
        }

        case T.HINT: {
            if (state.phase !== Phase.answering) return state;
            return { ...state, hintLevel: Math.min(state.hintLevel + 1, 2) };
        }

        // Give up on this position: play a book move, scored as a miss.
        case T.SKIP: {
            if (state.phase !== Phase.answering) return state;
            const reply = chooseReply(state.repertoire, state.path);
            if (!reply) return state;
            const nextPath = state.path + reply.uci;
            return {
                ...state,
                path: nextPath,
                phase: phaseAt(state.repertoire, nextPath),
                attempts: 0,
                hintLevel: 0,
                streak: 0,
                results: {
                    ...state.results,
                    [state.path]: { firstTry: false, attempts: state.attempts, skipped: true },
                },
                feedback: {
                    verdict: "skipped",
                    played: reply.san,
                    // kept so the board can draw the move that was revealed
                    playedUci: reply.uci,
                    idea: reply.idea ?? null,
                    alternatives: 0,
                },
            };
        }

        // Back to the root for another run — the tree branches randomly, so
        // this usually takes a different line through the same repertoire.
        case T.RESTART: {
            return {
                ...state,
                path: "",
                phase: phaseAt(state.repertoire, ""),
                feedback: null,
                hintLevel: 0,
                attempts: 0,
                runs: state.runs + 1,
            };
        }

        case T.RESET:
            return { ...initialTrainerState, bestStreak: state.bestStreak };

        default:
            return state;
    }
}

/* ---------- selectors ---------- */

/** Moves played so far, for the move list. */
export const currentMoves = (state) =>
    state.repertoire ? pathMoves(state.repertoire, state.path) : [];

/** Where the learner is, named by the deepest ECO match on this path. */
export const currentOpening = (state) =>
    state.repertoire ? describe(state.repertoire, state.path) : { eco: null, name: null, depth: 0 };

/** Review-session progress for the header. */
export function reviewProgress(state) {
    if (!state.queue) return null;
    const s = summarise(state.queue);
    return { ...s, left: remaining(state.queue) };
}

/** Progress through THIS run: positions answered, and how many first time. */
export function runProgress(state) {
    if (!state.repertoire) return { answered: 0, firstTry: 0 };
    const mine = Object.keys(state.results);
    return {
        answered: mine.length,
        firstTry: mine.filter((p) => state.results[p].firstTry).length,
    };
}
