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

import { uciToCoords } from "../utils/uciToCoords";
import { buildPosition } from "./buildPosition";
import { bookSquares, judgeMove } from "./judgeMove";
import { recordReview } from "./localStore";
import {
    Phase,
    T,
    currentMoves,
    currentOpening,
    initialTrainerState,
    runProgress,
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
     * INVARIANT: onAttempt is only ever called from an onDrop / onClick
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
                if (s.attempts === 0) {
                    recordReview(s.repertoire.id, s.path, judged.verdict === "correct");
                }

                send({ type: T.ATTEMPT, payload: judged });
            },
        };
    }, [active]);

    /**
     * What the board should draw. Derived from session state rather than
     * stored, so it can never drift out of sync with the position.
     *
     * The hint ladder is deliberately two-stage: level 1 says WHICH piece,
     * level 2 says where it goes. Being nudged is more useful than being told.
     */
    const annotations = useMemo(() => {
        if (!active || !session.repertoire) return [];
        const { hintLevel, feedback, phase, path, repertoire } = session;

        // After "Show me", draw the move the book actually played.
        if (feedback?.verdict === "skipped" && feedback.playedUci) {
            const [from, to] = uciToCoords(feedback.playedUci);
            return [{ type: "arrow", from, to, tone: "good" }];
        }

        if (phase !== Phase.answering || hintLevel === 0) return [];

        const options = bookSquares(repertoire, path);
        if (hintLevel === 1) {
            // Just the piece. Dedupe: two book moves may share an origin.
            const seen = new Set();
            return options
                .filter((o) => {
                    const k = String(o.from);
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                })
                .map((o) => ({ type: "square", square: o.from, tone: "hint" }));
        }
        return options.map((o) => ({
            type: "arrow",
            from: o.from,
            to: o.to,
            tone: "hint",
        }));
    }, [active, session]);

    const start = useCallback((repertoire) => {
        send({ type: T.START, payload: { repertoire } });
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
            advance: () => send({ type: T.ADVANCE }),
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
        [session, active, gate, annotations, start]
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
