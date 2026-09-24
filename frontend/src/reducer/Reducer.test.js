import { reducer } from "./Reducer";
import actionTypes from "./actionTypes";
import { createInitGameState, Status } from "../constants";
import { createEmptyPosition, getScores } from "../helper";

/**
 * TAKE_BACK against an engine opponent has to know whether the engine has
 * actually answered yet. If it hasn't (state.turn already flipped to the
 * engine's colour, but its move hasn't landed — e.g. still thinking at a
 * high depth), undoing "the pair" also eats the previous, already-completed
 * move — and can leave the reducer in a state useEngineAgent's `isBusy` guard
 * never recovers from, since the stale in-flight response just discards
 * itself with nothing to re-trigger the effect. See CLAUDE.md.
 */

// Move labels are opaque to TAKE_BACK — it only slices the arrays — but
// NEW_MOVE now also scores each ply, which reads `newPosition` as a real
// 8x8 board. An empty board throughout keeps every ply's diff at 0 points,
// which is all these ply-counting tests care about.
function stateAfterPlies(opponentType, plies) {
    let state = {
        ...createInitGameState(),
        position: [createEmptyPosition()],
        opponentType,
        isGameSetup: true,
    };
    for (let i = 0; i < plies; i++) {
        state = reducer(state, {
            type: actionTypes.NEW_MOVE,
            payload: { newPosition: createEmptyPosition(), newMove: `move${i + 1}` },
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
        let state = {
            ...createInitGameState(),
            position: [createEmptyPosition()],
            opponentType: "ai",
            userColor: "black",
            isGameSetup: true,
        };
        for (const newMove of ["move1", "move2"]) {
            state = reducer(state, {
                type: actionTypes.NEW_MOVE,
                payload: { newPosition: createEmptyPosition(), newMove },
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

describe("NEW_MOVE scoring", () => {
    function board(placements) {
        const b = createEmptyPosition();
        for (const [rank, file, code] of placements) b[rank][file] = code;
        return b;
    }

    test("a capturing move raises the mover's score and lowers the captured side's by the same amount", () => {
        let state = {
            ...createInitGameState(),
            position: [board([[0, 0, "wp"], [0, 1, "bn"]])],
            opponentType: "ai",
            isGameSetup: true,
            turn: "w",
        };
        state = reducer(state, {
            type: actionTypes.NEW_MOVE,
            payload: { newPosition: board([[0, 1, "wp"]]), newMove: "Nxb1" },
        });
        expect(state.scoreLog).toEqual([{ w: 3, b: -3 }]);
        expect(getScores(state.scoreLog)).toEqual({ w: 3, b: -3 });
    });

    test("a quiet move logs a zero delta, not nothing", () => {
        let state = {
            ...createInitGameState(),
            position: [createEmptyPosition()],
            opponentType: "human",
            isGameSetup: true,
        };
        state = reducer(state, {
            type: actionTypes.NEW_MOVE,
            payload: { newPosition: createEmptyPosition(), newMove: "e4" },
        });
        expect(state.scoreLog).toEqual([{ w: 0, b: 0 }]);
    });

    test("CustomEditor's free piece placement is never scored", () => {
        // CustomEditor.js dispatches this same NEW_MOVE action to place
        // pieces while isCustomEditor is true — a board that would look
        // like a capture to scoreForMove must still score 0 here.
        let state = {
            ...createInitGameState(),
            position: [board([[0, 0, "wp"], [0, 1, "bn"]])],
            isCustomEditor: true,
            turn: "w",
        };
        state = reducer(state, {
            type: actionTypes.NEW_MOVE,
            payload: { newPosition: board([[0, 1, "wq"]]), newMove: "" },
        });
        expect(state.scoreLog).toEqual([{ w: 0, b: 0 }]);
    });

    test("TAKE_BACK undoes a capture's score swing for both sides along with the move", () => {
        let state = {
            ...createInitGameState(),
            position: [board([[0, 0, "wp"], [0, 1, "bn"]])],
            opponentType: "ai",
            isGameSetup: true,
            turn: "w",
        };
        state = reducer(state, {
            type: actionTypes.NEW_MOVE,
            payload: { newPosition: board([[0, 1, "wp"]]), newMove: "Nxb1" },
        });
        expect(getScores(state.scoreLog)).toEqual({ w: 3, b: -3 });

        // The engine hasn't replied yet (turn is now 'b'), so this undoes
        // exactly the capturing move.
        state = takeBack(state);
        expect(state.scoreLog).toEqual([]);
        expect(getScores(state.scoreLog)).toEqual({ w: 0, b: 0 });
    });
});
