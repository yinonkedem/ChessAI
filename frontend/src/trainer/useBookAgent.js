import { useEffect } from "react";
import { Phase } from "./trainerReducer";
import { useTrainer } from "./TrainerContext";

const REPLY_DELAY_MS = 450;

/**
 * Plays the opponent's book reply.
 *
 * Far simpler than ai/useEngineAgent.js, which needs an isBusy ref and a
 * latestStateRef stale-guard only because it awaits a network round-trip.
 * Here the reply is already in memory, so this is just a timer that advances
 * the ply — the board rebuilds itself from the new prefix.
 *
 * The delay exists purely so the reply feels played rather than teleported.
 * Mounted by DrillPage, not App, so it unmounts on navigate.
 */
export default function useBookAgent() {
    const { session, advance } = useTrainer();
    const { phase, ply, line } = session;

    useEffect(() => {
        if (phase !== Phase.reply) return;
        const t = setTimeout(advance, REPLY_DELAY_MS);
        return () => clearTimeout(t);
    }, [phase, ply, line, advance]);
}
