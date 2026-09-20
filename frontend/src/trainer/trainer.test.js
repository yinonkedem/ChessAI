import fs from "fs";
import path from "path";

import { buildLinePrefix, legalMovesAt } from "./buildLinePrefix";
import { judgeMove, hintSquares } from "./judgeMove";
import {
    Phase,
    T,
    initialTrainerState,
    lineProgress,
    trainerReducer,
} from "./trainerReducer";

const BOOK = path.join(__dirname, "..", "..", "public", "openings");
const load = (f) => JSON.parse(fs.readFileSync(path.join(BOOK, f), "utf8"));

const italian = load("italian-white.json");
const giuoco = italian.lines[0];          // White, 13 plies
const caro = load("caro-kann-black.json");
const caroClassical = caro.lines[0];      // Black
const berlin = load("ruy-lopez-white.json").lines[1];  // has O-O and Qxd8+ Kxd8

describe("buildLinePrefix", () => {
    it("returns the start position at ply 0", () => {
        const { positions, movesList, turn } = buildLinePrefix(giuoco, 0);
        expect(positions).toHaveLength(1);
        expect(movesList).toEqual([]);
        expect(turn).toBe("w");
        expect(positions[0][0][4]).toBe("wk");
        expect(positions[0][7][4]).toBe("bk");
    });

    it("returns the whole history, not just the final board", () => {
        // getPawnCaptures detects en passant by diffing against prevPosition,
        // so the trainer needs every intermediate board, not one snapshot.
        const { positions } = buildLinePrefix(giuoco, 5);
        expect(positions).toHaveLength(6);
    });

    it("alternates the side to move with ply parity", () => {
        expect(buildLinePrefix(giuoco, 1).turn).toBe("b");
        expect(buildLinePrefix(giuoco, 2).turn).toBe("w");
        expect(buildLinePrefix(giuoco, 7).turn).toBe("b");
    });

    it("moves the rook too when the king castles", () => {
        const plies = berlin.moves.findIndex((m) => m.san === "O-O") + 1;
        const { positions } = buildLinePrefix(berlin, plies);
        const board = positions[positions.length - 1];
        expect(board[0][6]).toBe("wk");   // king on g1
        expect(board[0][5]).toBe("wr");   // rook hopped to f1
        expect(board[0][7]).toBe("");     // h1 empty
        expect(board[0][4]).toBe("");     // e1 empty
    });

    it("revokes castling rights once the king has moved", () => {
        const plies = berlin.moves.findIndex((m) => m.san === "O-O") + 1;
        expect(buildLinePrefix(berlin, plies).castleDirection.w).toBe("none");
    });

    it("keeps castling rights before anything has moved", () => {
        expect(buildLinePrefix(giuoco, 2).castleDirection).toEqual({ w: "both", b: "both" });
    });

    it("is pure — same inputs, same board", () => {
        const a = buildLinePrefix(giuoco, 6);
        const b = buildLinePrefix(giuoco, 6);
        expect(a.positions[a.positions.length - 1]).toEqual(b.positions[b.positions.length - 1]);
        expect(a.castleDirection).toEqual(b.castleDirection);
    });

    it("clamps a ply beyond the end of the line", () => {
        const { positions } = buildLinePrefix(giuoco, 999);
        expect(positions).toHaveLength(giuoco.moves.length + 1);
    });

    it("uses the book's SAN rather than regenerating it", () => {
        // getNewMoveNotation emits no + or #, so regenerating would diverge.
        const { movesList } = buildLinePrefix(giuoco, 4);
        expect(movesList).toEqual(giuoco.moves.slice(0, 4).map((m) => m.san));
    });

    it("offers castling as a legal move when rights are intact", () => {
        const idx = berlin.moves.findIndex((m) => m.san === "O-O");
        const prefix = buildLinePrefix(berlin, idx);
        // white king on e1 = [0,4]; castling target g1 = [0,6]
        expect(legalMovesAt(prefix, 0, 4)).toContainEqual([0, 6]);
    });
});

describe("judgeMove", () => {
    it("accepts the book move", () => {
        const { from, to } = hintSquares(giuoco, 0);
        expect(judgeMove(giuoco, 0, { from, to }).verdict).toBe("correct");
    });

    it("rejects a legal but non-book move", () => {
        // a2a3 instead of e2e4
        expect(judgeMove(giuoco, 0, { from: [1, 0], to: [2, 0] }).verdict).toBe("wrong");
    });

    it("rejects the right destination from the wrong square", () => {
        const { to } = hintSquares(giuoco, 0);
        expect(judgeMove(giuoco, 0, { from: [1, 3], to }).verdict).toBe("wrong");
    });

    it("reports what the book expected", () => {
        expect(judgeMove(giuoco, 0, { from: [1, 0], to: [2, 0] }).expected.san).toBe("e4");
    });

    it("returns off-line past the end", () => {
        expect(judgeMove(giuoco, 99, { from: [0, 0], to: [1, 1] }).verdict).toBe("off-line");
    });
});

describe("trainerReducer", () => {
    const start = (rep = italian, i = 0) =>
        trainerReducer(initialTrainerState, {
            type: T.START_LINE,
            payload: { repertoire: rep, lineIndex: i },
        });

    const correctAt = (state) => {
        const { from, to } = hintSquares(state.line, state.ply);
        const { verdict, expected } = judgeMove(state.line, state.ply, { from, to });
        return trainerReducer(state, {
            type: T.ATTEMPT,
            payload: { verdict, expected, attemptedSan: null },
        });
    };
    const wrongAt = (state) =>
        trainerReducer(state, {
            type: T.ATTEMPT,
            payload: { verdict: "wrong", expected: state.line.moves[state.ply], attemptedSan: null },
        });

    it("starts a White line waiting for the learner", () => {
        const s = start();
        expect(s.phase).toBe(Phase.answering);
        expect(s.ply).toBe(0);
    });

    it("starts a Black line in reply phase, since White moves first", () => {
        const s = start(caro, 0);
        expect(s.line.side).toBe("b");
        expect(s.phase).toBe(Phase.reply);
        expect(s.ply).toBe(0);
    });

    it("a correct move advances to the opponent's reply", () => {
        const s = correctAt(start());
        expect(s.feedback.verdict).toBe("correct");
        expect(s.ply).toBe(1);
        expect(s.phase).toBe(Phase.reply);
    });

    it("a wrong move does NOT advance the ply", () => {
        const s = wrongAt(start());
        expect(s.feedback.verdict).toBe("wrong");
        expect(s.ply).toBe(0);
        expect(s.phase).toBe(Phase.answering);
        expect(s.attempts).toBe(1);
    });

    it("surfaces the expected move after a mistake", () => {
        expect(wrongAt(start()).feedback.expectedSan).toBe("e4");
    });

    it("scores a first-time-correct move as firstTry", () => {
        expect(correctAt(start()).results[0].firstTry).toBe(true);
    });

    it("does not score firstTry after a mistake on the same card", () => {
        const s = correctAt(wrongAt(start()));
        expect(s.results[0].firstTry).toBe(false);
    });

    it("does not score firstTry after a hint", () => {
        const hinted = trainerReducer(start(), { type: T.HINT });
        expect(correctAt(hinted).results[0].firstTry).toBe(false);
    });

    it("breaks the streak on a wrong move", () => {
        let s = correctAt(start());
        s = trainerReducer(s, { type: T.ADVANCE });
        expect(s.phase).toBe(Phase.answering);
        s = correctAt(s);
        expect(s.streak).toBe(2);
        s = trainerReducer(s, { type: T.ADVANCE });
        expect(wrongAt(s).streak).toBe(0);
    });

    it("remembers the best streak across a reset", () => {
        let s = correctAt(start());
        expect(s.bestStreak).toBe(1);
        expect(trainerReducer(s, { type: T.RESET }).bestStreak).toBe(1);
    });

    it("hint level tops out at 2", () => {
        let s = start();
        for (let i = 0; i < 5; i++) s = trainerReducer(s, { type: T.HINT });
        expect(s.hintLevel).toBe(2);
    });

    it("skip advances the line but scores a miss", () => {
        const s = trainerReducer(start(), { type: T.SKIP });
        expect(s.ply).toBe(1);
        expect(s.results[0].firstTry).toBe(false);
        expect(s.results[0].skipped).toBe(true);
        expect(s.feedback.verdict).toBe("skipped");
    });

    it("ignores an attempt while the opponent is replying", () => {
        const s = correctAt(start());   // now in reply phase
        expect(wrongAt(s)).toBe(s);
    });

    it("reaches lineComplete after every answer ply", () => {
        let s = start();
        // drive the whole line: answer, then let the reply land
        for (let guard = 0; guard < 60 && s.phase !== Phase.lineComplete; guard++) {
            s = s.phase === Phase.answering ? correctAt(s) : trainerReducer(s, { type: T.ADVANCE });
        }
        expect(s.phase).toBe(Phase.lineComplete);
        expect(lineProgress(s)).toEqual({
            done: giuoco.answerPlies.length,
            total: giuoco.answerPlies.length,
        });
    });

    it("next line wraps around the repertoire", () => {
        let s = start(italian, italian.lines.length - 1);
        s = trainerReducer(s, { type: T.NEXT_LINE });
        expect(s.lineIndex).toBe(0);
        expect(s.results).toEqual({});
    });
});

describe("the drilled line stays playable on the real board", () => {
    it("every learner answer is a legal move according to the arbiter", () => {
        [giuoco, caroClassical, berlin].forEach((line) => {
            line.answerPlies.forEach((ply) => {
                const prefix = buildLinePrefix(line, ply);
                const { from, to } = hintSquares(line, ply);
                const legal = legalMovesAt(prefix, from[0], from[1]);
                expect(legal).toContainEqual([to[0], to[1]]);
            });
        });
    });
});
