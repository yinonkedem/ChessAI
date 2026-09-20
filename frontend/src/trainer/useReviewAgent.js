import { useEffect } from "react";
import { Phase } from "./trainerReducer";
import { useTrainer } from "./TrainerContext";

// Long enough to read the move and its explanation, short enough not to drag.
const REVEAL_MS = 1500;
const REVEAL_MS_WRONG = 2600;   // a miss is the moment worth reading

/**
 * Advances a review session past the reveal to the next due card.
 *
 * Mounted by ReviewPage, so it unmounts on navigate. The delay is the only
 * reason this exists — without it the next position would appear before the
 * learner had seen why they were wrong.
 */
export default function useReviewAgent() {
    const { session, nextCard } = useTrainer();
    const { phase, path, lastCorrect } = session;

    useEffect(() => {
        if (phase !== Phase.reveal) return;
        const t = setTimeout(nextCard, lastCorrect ? REVEAL_MS : REVEAL_MS_WRONG);
        return () => clearTimeout(t);
    }, [phase, path, lastCorrect, nextCard]);
}
