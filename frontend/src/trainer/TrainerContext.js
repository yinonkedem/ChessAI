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

import { buildLinePrefix } from "./buildLinePrefix";
import { judgeMove } from "./judgeMove";
import {
    Phase,
    T,
    initialTrainerState,
    lineProgress,
    trainerReducer,
} from "./trainerReducer";

const TrainerContext = createContext(null);

export function TrainerProvider({ children }) {
    const { dispatch } = useAppContext();
    const [session, send] = useReducer(trainerReducer, initialTrainerState);

    const active = session.phase !== Phase.idle && !!session.line;

    /**
     * The trainer is the SOLE board writer during a drill. Rather than applying
     * one move at a time, it recomputes the whole position history from the
     * line prefix whenever the ply changes. A wrong move therefore never
     * half-applies — there is nothing to revert and nothing to flicker.
     */
    useEffect(() => {
        if (!active) return;
        const prefix = buildLinePrefix(session.line, session.ply);
        dispatch(
            loadPositionSequence({
                ...prefix,
                userColor: session.line.side === "w" ? "white" : "black",
            })
        );
    }, [active, session.line, session.ply, dispatch]);

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
                const { verdict, expected } = judgeMove(s.line, s.ply, { from, to });
                send({
                    type: T.ATTEMPT,
                    payload: {
                        verdict,
                        expected,
                        // Show what the book expected; we deliberately don't
                        // regenerate SAN for the attempt, because
                        // getNewMoveNotation omits + and #.
                        attemptedSan: null,
                    },
                });
            },
        };
    }, [active]);

    const startLine = useCallback((repertoire, lineIndex = 0) => {
        send({ type: T.START_LINE, payload: { repertoire, lineIndex } });
    }, []);

    const value = useMemo(
        () => ({
            session,
            active,
            gate,
            progress: lineProgress(session),
            startLine,
            advance: () => send({ type: T.ADVANCE }),
            hint: () => send({ type: T.HINT }),
            skip: () => send({ type: T.SKIP }),
            nextLine: () => send({ type: T.NEXT_LINE }),
            reset: () => send({ type: T.RESET }),
        }),
        [session, active, gate, startLine]
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
