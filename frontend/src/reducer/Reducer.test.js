import { reducer } from "./Reducer";
import actionTypes from "./actionTypes";
import { createInitGameState, Status } from "../constants";

/**
 * TAKE_BACK against an engine opponent has to know whether the engine has
 * actually answered yet. If it hasn't (state.turn already flipped to the
 * engine's colour, but its move hasn't landed — e.g. still thinking at a
 * high depth), undoing "the pair" also eats the previous, already-completed
 * move — and can leave the reducer in a state useEngineAgent's `isBusy` guard
 * never recovers from, since the stale in-flight response just discards
 * itself with nothing to re-trigger the effect. See CLAUDE.md.
 */

// Positions/moves are opaque to TAKE_BACK — it only slices the arrays — so
// plain markers stand in for real board state.
function stateAfterPlies(opponentType, plies) {
    let state = { ...createInitGameState(), opponentType, isGameSetup: true };
    for (let i = 0; i < plies; i++) {
        state = reducer(state, {
            type: actionTypes.NEW_MOVE,
            payload: { newPosition: `pos${i + 1}`, newMove: `move${i + 1}` },
        });
    }
    return state;
}

function takeBack(state) {
    return reducer(state, { type: actionTypes.TAKE_BACK });
}

describe("TAKE_BACK vs an engine opponent", () => {
    test("engine hasn't replied yet: undoes only the pending human move", () => {
        // White (human) has just played move 1; it's Black's (engine) turn,
        // and its reply hasn't arrived — exactly the depth-20 race.
        const state = stateAfterPlies("ai", 1);
        expect(state.turn).toBe("b");

        const after = takeBack(state);

        expect(after.movesList).toEqual([]);
        expect(after.position).toHaveLength(1);
        expect(after.turn).toBe("w"); // back to the human, not the engine
        expect(after.status).toBe(Status.ongoing);
    });

    test("engine already replied: undoes the pair, landing back on the human", () => {
        // move1 (white/human), move2 (black/engine) — turn is back to white.
        const state = stateAfterPlies("ai", 2);
        expect(state.turn).toBe("w");

        const after = takeBack(state);

        expect(after.movesList).toEqual([]);
        expect(after.position).toHaveLength(1);
        expect(after.turn).toBe("w"); // still the human's turn, just earlier
    });

    test("mid-game, engine hasn't replied: strips only the latest ply", () => {
        // 4 plies already resolved (2 full moves), then White's 5th is
        // pending a reply.
        const state = stateAfterPlies("ai", 5);
        expect(state.turn).toBe("b");

        const after = takeBack(state);

        expect(after.movesList).toEqual(["move1", "move2", "move3", "move4"]);
        expect(after.turn).toBe("w");
    });

    test("take-back never hands the turn to the engine", () => {
        // Whichever branch fires, control must return to the human — a
        // take-back that ends on the engine's turn is what let it go
        // silent (isBusy never gets a reason to re-fire).
        for (const plies of [1, 2, 3, 4, 5, 6]) {
            const state = stateAfterPlies("ai", plies);
            const after = takeBack(state);
            expect(after.turn).toBe("w");
        }
    });

    test("black-side human: engine's reply pending, undoes only the human's move", () => {
        // userColor "black" means the engine (white) moves first. move1 is
        // its opening; move2 is the human's reply; now it's the engine's
        // turn again and its answer to move2 hasn't landed yet.
        let state = { ...createInitGameState(), opponentType: "ai", userColor: "black", isGameSetup: true };
        for (const newMove of ["move1", "move2"]) {
            state = reducer(state, {
                type: actionTypes.NEW_MOVE,
                payload: { newPosition: newMove, newMove },
            });
        }
        expect(state.turn).toBe("w"); // the engine's colour — its move is pending

        const after = takeBack(state);

        expect(after.movesList).toEqual(["move1"]);
        expect(after.turn).toBe("b"); // back to the human, not the engine
    });
});

describe("TAKE_BACK vs a human opponent", () => {
    test("always undoes exactly one ply, unaffected by this change", () => {
        const state = stateAfterPlies("human", 3);
        const after = takeBack(state);
        expect(after.movesList).toEqual(["move1", "move2"]);
        expect(after.turn).toBe(state.turn === "w" ? "b" : "w");
    });
});
