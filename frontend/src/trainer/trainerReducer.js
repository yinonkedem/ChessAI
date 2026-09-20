/**
 * Drill-session state. Deliberately separate from the global game reducer:
 *
 * - StartScreen.js:17 dispatches RESET_ALL on mount, so anything kept in the
 *   global reducer is wiped the moment the user taps the toolbar brand.
 * - The global reducer is persisted to localStorage on every change; a drill
 *   session is not something you want to resume half-way after a refresh.
 */

export const Phase = {
    idle: "idle",             // nothing loaded
    answering: "answering",   // waiting for the learner's move
    reply: "reply",           // opponent's book move is about to play
    lineComplete: "lineComplete",
};

export const initialTrainerState = {
    repertoire: null,   // the loaded repertoire doc
    line: null,         // the line being drilled
    lineIndex: 0,       // position within repertoire.lines
    ply: 0,             // how many moves of the line are on the board
    phase: Phase.idle,
    feedback: null,     // { verdict, attemptedSan, expectedSan, idea }
    hintLevel: 0,       // 0 none, 1 highlight piece, 2 show target
    attempts: 0,        // attempts on the CURRENT card
    results: {},        // { [ply]: { firstTry: bool, attempts: n } }
    streak: 0,
    bestStreak: 0,
};

export const T = {
    START_LINE: "START_LINE",
    ATTEMPT: "ATTEMPT",
    ADVANCE: "ADVANCE",
    HINT: "HINT",
    SKIP: "SKIP",
    NEXT_LINE: "NEXT_LINE",
    RESET: "RESET",
};

/** Is it the learner's turn to find a move at this ply? */
function isAnswerPly(line, ply) {
    if (!line || ply >= line.moves.length) return false;
    return line.answerPlies.includes(ply);
}

/**
 * From `ply`, walk forward past any opponent moves and land on the next ply
 * the learner must answer. Returns the resulting {ply, phase}.
 */
function settle(line, ply) {
    if (ply >= line.moves.length) return { ply: line.moves.length, phase: Phase.lineComplete };
    if (isAnswerPly(line, ply)) return { ply, phase: Phase.answering };
    // An opponent move is due — useBookAgent plays it after a beat.
    return { ply, phase: Phase.reply };
}

export function trainerReducer(state, action) {
    switch (action.type) {
        case T.START_LINE: {
            const { repertoire, lineIndex } = action.payload;
            const line = repertoire.lines[lineIndex];
            const { ply, phase } = settle(line, 0);
            return {
                ...state,
                repertoire,
                line,
                lineIndex,
                ply,
                phase,
                feedback: null,
                hintLevel: 0,
                attempts: 0,
                results: {},
            };
        }

        case T.ATTEMPT: {
            const { verdict, expected, attemptedSan } = action.payload;
            if (state.phase !== Phase.answering) return state;

            if (verdict !== "correct") {
                return {
                    ...state,
                    attempts: state.attempts + 1,
                    streak: 0,
                    feedback: {
                        verdict: "wrong",
                        attemptedSan,
                        expectedSan: expected?.san ?? null,
                        idea: null,
                    },
                };
            }

            const firstTry = state.attempts === 0 && state.hintLevel === 0;
            const streak = firstTry ? state.streak + 1 : 0;
            const next = settle(state.line, state.ply + 1);

            return {
                ...state,
                ...next,
                attempts: 0,
                hintLevel: 0,
                streak,
                bestStreak: Math.max(state.bestStreak, streak),
                results: {
                    ...state.results,
                    [state.ply]: { firstTry, attempts: state.attempts },
                },
                feedback: {
                    verdict: "correct",
                    attemptedSan,
                    expectedSan: expected?.san ?? null,
                    idea: state.line.ideas?.[state.ply] ?? null,
                },
            };
        }

        // The opponent's book reply landed.
        case T.ADVANCE: {
            if (state.phase !== Phase.reply) return state;
            const next = settle(state.line, state.ply + 1);
            return { ...state, ...next };
        }

        case T.HINT: {
            if (state.phase !== Phase.answering) return state;
            return { ...state, hintLevel: Math.min(state.hintLevel + 1, 2) };
        }

        // Give up on this card: play the book move and move on, scored as a miss.
        case T.SKIP: {
            if (state.phase !== Phase.answering) return state;
            const next = settle(state.line, state.ply + 1);
            return {
                ...state,
                ...next,
                attempts: 0,
                hintLevel: 0,
                streak: 0,
                results: {
                    ...state.results,
                    [state.ply]: { firstTry: false, attempts: state.attempts, skipped: true },
                },
                feedback: {
                    verdict: "skipped",
                    attemptedSan: null,
                    expectedSan: state.line.moves[state.ply]?.san ?? null,
                    idea: state.line.ideas?.[state.ply] ?? null,
                },
            };
        }

        case T.NEXT_LINE: {
            const lineIndex = (state.lineIndex + 1) % state.repertoire.lines.length;
            const line = state.repertoire.lines[lineIndex];
            const { ply, phase } = settle(line, 0);
            return {
                ...state,
                line,
                lineIndex,
                ply,
                phase,
                feedback: null,
                hintLevel: 0,
                attempts: 0,
                results: {},
            };
        }

        case T.RESET:
            return { ...initialTrainerState, bestStreak: state.bestStreak };

        default:
            return state;
    }
}

/** Fraction of this line's answer plies already solved. */
export function lineProgress(state) {
    if (!state.line) return { done: 0, total: 0 };
    const total = state.line.answerPlies.length;
    const done = state.line.answerPlies.filter((p) => state.results[p]).length;
    return { done, total };
}
