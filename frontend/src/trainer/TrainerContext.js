import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from "react";

import { useAppContext } from "../contexts/Context";
import { loadPositionSequence } from "../reducer/actions/move";

import { buildPosition } from "./buildPosition";
import { judgeMove } from "./judgeMove";
import { recordReview } from "./localStore";
import { duePositions } from "./progress";
import { flushOutbox } from "./sync";
import { getToken } from "../api/auth";
import {
    Mode,
    Phase,
    T,
    currentMoves,
    currentOpening,
    initialTrainerState,
    reviewProgress,
    runProgress,
    sessionAnnotations,
    trainerReducer,
} from "./trainerReducer";

const TrainerContext = createContext(null);

export function TrainerProvider({ children }) {
    const { dispatch } = useAppContext();
    const [session, send] = useReducer(trainerReducer, initialTrainerState);

    const active = session.phase !== Phase.idle && !!session.repertoire;

    /**
     * The trainer is the SOLE board writer during a drill. Rather than applying
     * one move at a time, it recomputes the whole position history from the
     * line prefix whenever the ply changes. A wrong move therefore never
     * half-applies — there is nothing to revert and nothing to flicker.
     */
    useEffect(() => {
        if (!active) return;
        const prefix = buildPosition(session.repertoire, session.path);
        dispatch(
            loadPositionSequence({
                ...prefix,
                userColor: session.repertoire.side === "w" ? "white" : "black",
            })
        );
    }, [active, session.repertoire, session.path, dispatch]);

    /**
     * Handed to Pieces.js. Returns null outside a drill, so /game behaves
     * exactly as it always has.
     *
     * INVARIANT: onAttempt is only ever called from a pointer-up / click
     * handler, never during render. That is what makes this side effect safe
     * and StrictMode-proof. A future refactor that memoises the move handler
     * must preserve it.
     */
    const sessionRef = useRef(session);
    sessionRef.current = session;

    const gate = useMemo(() => {
        if (!active) return null;
        return {
            onAttempt({ from, to }) {
                const s = sessionRef.current;
                if (s.phase !== Phase.answering) return;
                // A position can have several book replies; judgeMove checks
                // membership, so any of them counts as correct.
                const judged = judgeMove(s.repertoire, s.path, { from, to });

                // Grade only the FIRST attempt at a position. Retrying until
                // it sticks must not schedule it as if it were known — the
                // in-session retry is the learning step, not the review.
                //
                // The marker is `attempts`, NOT `results`: results is only
                // written on a correct answer, so after a miss it is still
                // empty and the retry would be graded a second time.
                //
                // In review mode the queue owns re-asking, and it only reports
                // a card's first encounter, so grade whenever this position
                // has not been graded in this session.
                const firstLook = s.mode === Mode.review
                    ? !(s.path in s.results)
                    : s.attempts === 0;
                if (firstLook) {
                    recordReview(s.repertoire.id, s.path, judged.verdict === "correct");
                }

                send({ type: T.ATTEMPT, payload: judged });
            },
        };
    }, [active]);

    /**
     * What the board should draw. sessionAnnotations() is a pure function of
     * session state (trainerReducer.js), so this can never drift out of
     * sync with the position — and is unit tested directly there.
     */
    const annotations = useMemo(
        () => (active ? sessionAnnotations(session) : []),
        [active, session]
    );

    /**
     * Catch the server up at the end of a session rather than after every
     * move: one request instead of thirty, and a sleeping backend costs the
     * learner nothing mid-drill. Failure is fine — the outbox keeps the
     * reviews for next time.
     */
    const phase = session.phase;
    useEffect(() => {
        if (phase !== Phase.lineComplete && phase !== Phase.sessionComplete) return;
        if (!getToken()) return;
        flushOutbox().catch((err) => console.warn("review sync failed:", err));
    }, [phase]);

    const start = useCallback((repertoire) => {
        send({ type: T.START, payload: { repertoire } });
    }, []);

    /** Begin a review session over everything currently due. */
    const startReview = useCallback((repertoire) => {
        send({
            type: T.START_REVIEW,
            payload: { repertoire, paths: duePositions(repertoire) },
        });
    }, []);

    const value = useMemo(
        () => ({
            session,
            active,
            gate,
            annotations,
            moves: currentMoves(session),
            opening: currentOpening(session),
            progress: runProgress(session),
            start,
            startReview,
            review: reviewProgress(session),
            advance: () => send({ type: T.ADVANCE }),
            nextCard: () => send({ type: T.NEXT_CARD }),
            hint: () => send({ type: T.HINT }),
            skip: () => {
                const s = sessionRef.current;
                // Same rule: if they already guessed, the miss is recorded.
                if (s.phase === Phase.answering && s.attempts === 0) {
                    recordReview(s.repertoire.id, s.path, false);
                }
                send({ type: T.SKIP });
            },
            restart: () => send({ type: T.RESTART }),
            reset: () => send({ type: T.RESET }),
        }),
        [session, active, gate, annotations, start, startReview]
    );

    return <TrainerContext.Provider value={value}>{children}</TrainerContext.Provider>;
}

export function useTrainer() {
    const ctx = useContext(TrainerContext);
    if (!ctx) throw new Error("useTrainer must be used within a TrainerProvider");
    return ctx;
}

/**
 * The board's hook into the trainer. Returns null when no drill is running,
 * which is how Pieces.js stays untouched outside /learn.
 */
export function useMoveGate() {
    const ctx = useContext(TrainerContext);
    return ctx ? ctx.gate : null;
}

/** What the board should draw. Empty outside a drill, so /game is unaffected. */
export function useAnnotations() {
    const ctx = useContext(TrainerContext);
    return ctx ? ctx.annotations : [];
}
