import fs from "fs";
import path from "path";

import { buildPosition, legalMovesAt } from "./buildPosition";
import { bookSquares, coordsToUci, judgeMove } from "./judgeMove";
import { isEnd, isMine, nodeAt, pathMoves, repliesAt } from "./book";
import {
    Phase,
    T,
    currentOpening,
    initialTrainerState,
    runProgress,
    trainerReducer,
} from "./trainerReducer";

const BOOK = path.join(__dirname, "..", "..", "public", "openings");
const load = (f) => JSON.parse(fs.readFileSync(path.join(BOOK, f), "utf8"));

const italian = load("italian-white.json");
const caro = load("caro-kann-black.json");
const ruy = load("ruy-lopez-white.json");

/** Walk a repertoire root-to-leaf, always taking the first book reply. */
function mainPath(rep) {
    let p = "";
    while (!isEnd(rep, p)) p += repliesAt(rep, p)[0].uci;
    return p;
}

describe("book tree", () => {
    it("has a root position with book replies", () => {
        expect(nodeAt(italian, "")).toBeTruthy();
        expect(repliesAt(italian, "").length).toBeGreaterThan(0);
    });

    it("merges lines that share a prefix into one branching node", () => {
        // All four Italian lines start 1.e4 e5 2.Nf3 Nc6 3.Bc4, then diverge.
        const shared = "e2e4e7e5g1f3b8c6f1c4";
        expect(repliesAt(italian, shared).length).toBeGreaterThan(1);
    });

    it("dedups shared prefixes into a single card", () => {
        // 1.e4 appears in every Italian line but is one position, so one card.
        expect(repliesAt(italian, "")).toHaveLength(1);
    });

    it("marks the learner's turn correctly for a White repertoire", () => {
        expect(isMine(italian, "")).toBe(true);
        expect(isMine(italian, "e2e4")).toBe(false);
    });

    it("marks the learner's turn correctly for a Black repertoire", () => {
        expect(isMine(caro, "")).toBe(false);
        expect(isMine(caro, "e2e4")).toBe(true);
    });

    it("names every node, inheriting from the nearest named ancestor", () => {
        Object.entries(italian.nodes).forEach(([p, n]) => {
            if (p.length >= 8) expect(typeof n.name).toBe("string");
        });
    });

    it("recovers the book SAN for a path", () => {
        const moves = pathMoves(italian, "e2e4e7e5g1f3");
        expect(moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
        expect(moves.map((m) => m.mine)).toEqual([true, false, true]);
    });

    it("reports the end of a line", () => {
        expect(isEnd(italian, mainPath(italian))).toBe(true);
    });
});

describe("buildPosition", () => {
    it("returns the start position for an empty path", () => {
        const { positions, movesList, turn } = buildPosition(italian, "");
        expect(positions).toHaveLength(1);
        expect(movesList).toEqual([]);
        expect(turn).toBe("w");
    });

    it("returns the whole history, not just the final board", () => {
        // getPawnCaptures detects en passant by diffing against prevPosition.
        const { positions } = buildPosition(italian, "e2e4e7e5g1f3b8c6");
        expect(positions).toHaveLength(5);
    });

    it("alternates the side to move with path length", () => {
        expect(buildPosition(italian, "e2e4").turn).toBe("b");
        expect(buildPosition(italian, "e2e4e7e5").turn).toBe("w");
    });

    it("moves the rook too when the king castles", () => {
        // find a path through the Ruy that contains O-O
        let p = "";
        while (!isEnd(ruy, p)) {
            const r = repliesAt(ruy, p)[0];
            p += r.uci;
            if (r.san === "O-O" && r.uci === "e1g1") break;
        }
        const { positions } = buildPosition(ruy, p);
        const b = positions[positions.length - 1];
        expect(b[0][6]).toBe("wk");
        expect(b[0][5]).toBe("wr");
        expect(b[0][7]).toBe("");
        expect(b[0][4]).toBe("");
    });

    it("revokes castling rights once the king has moved", () => {
        let p = "";
        while (!isEnd(ruy, p)) {
            const r = repliesAt(ruy, p)[0];
            p += r.uci;
            if (r.uci === "e1g1") break;
        }
        expect(buildPosition(ruy, p).castleDirection.w).toBe("none");
    });

    it("is pure — same path, same board", () => {
        const a = buildPosition(italian, "e2e4e7e5g1f3");
        const b = buildPosition(italian, "e2e4e7e5g1f3");
        expect(a.positions.at(-1)).toEqual(b.positions.at(-1));
        expect(a.castleDirection).toEqual(b.castleDirection);
    });

    it("uses the book SAN rather than regenerating it", () => {
        expect(buildPosition(italian, "e2e4e7e5").movesList).toEqual(["e4", "e5"]);
    });
});

describe("judgeMove", () => {
    it("round-trips coordinates to uci", () => {
        expect(coordsToUci([1, 4], [3, 4])).toBe("e2e4");
        expect(coordsToUci([0, 4], [0, 6])).toBe("e1g1");
    });

    it("accepts the book move", () => {
        const { from, to } = bookSquares(italian, "")[0];
        expect(judgeMove(italian, "", { from, to }).verdict).toBe("correct");
    });

    it("rejects a legal but non-book move", () => {
        expect(judgeMove(italian, "", { from: [1, 0], to: [2, 0] }).verdict).toBe("wrong");
    });

    it("accepts ANY of several book moves at a branch", () => {
        const branch = "e2e4e7e5g1f3b8c6f1c4";
        const options = bookSquares(italian, branch);
        expect(options.length).toBeGreaterThan(1);
        options.forEach((o) => {
            expect(judgeMove(italian, branch, { from: o.from, to: o.to }).verdict).toBe("correct");
        });
    });

    it("reports which book move was played", () => {
        const o = bookSquares(italian, "")[0];
        expect(judgeMove(italian, "", { from: o.from, to: o.to }).played.san).toBe("e4");
    });

    it("returns off-line past the end of the tree", () => {
        expect(judgeMove(italian, mainPath(italian), { from: [1, 0], to: [2, 0] }).verdict)
            .toBe("off-line");
    });
});

describe("trainerReducer", () => {
    const start = (rep = italian) =>
        trainerReducer(initialTrainerState, { type: T.START, payload: { repertoire: rep } });

    const playBook = (s, which = 0) => {
        const o = bookSquares(s.repertoire, s.path)[which];
        return trainerReducer(s, {
            type: T.ATTEMPT,
            payload: judgeMove(s.repertoire, s.path, { from: o.from, to: o.to }),
        });
    };
    const playWrong = (s) =>
        trainerReducer(s, {
            type: T.ATTEMPT,
            payload: judgeMove(s.repertoire, s.path, { from: [1, 0], to: [2, 0] }),
        });

    it("starts a White repertoire waiting for the learner", () => {
        const s = start();
        expect(s.phase).toBe(Phase.answering);
        expect(s.path).toBe("");
    });

    it("starts a Black repertoire in reply phase, since White moves first", () => {
        const s = start(caro);
        expect(s.phase).toBe(Phase.reply);
    });

    it("a correct move extends the path", () => {
        const s = playBook(start());
        expect(s.feedback.verdict).toBe("correct");
        expect(s.path).toBe("e2e4");
        expect(s.phase).toBe(Phase.reply);
    });

    it("a wrong move does NOT extend the path", () => {
        const s = playWrong(start());
        expect(s.feedback.verdict).toBe("wrong");
        expect(s.path).toBe("");
        expect(s.phase).toBe(Phase.answering);
        expect(s.attempts).toBe(1);
    });

    it("tells you how many book moves were available", () => {
        expect(playWrong(start()).feedback.expected).toEqual(["e4"]);
    });

    it("counts alternatives when the LEARNER has a choice", () => {
        // Find a position where the learner themselves has more than one book
        // move — that is what the tree exists for. Discovered rather than
        // hardcoded, so adding curation can't silently break this.
        const branch = Object.entries(italian.nodes)
            .find(([, n]) => n.mine && n.replies.length > 1);
        expect(branch).toBeTruthy();

        const [branchPath, node] = branch;
        const s = { ...start(), path: branchPath, phase: Phase.answering };

        // every one of them is accepted
        bookSquares(italian, branchPath).forEach((o) => {
            expect(judgeMove(italian, branchPath, { from: o.from, to: o.to }).verdict)
                .toBe("correct");
        });
        // and the learner is told the others exist
        expect(playBook(s).feedback.alternatives).toBe(node.replies.length - 1);
    });

    it("scores first-time-correct as firstTry", () => {
        expect(playBook(start()).results[""].firstTry).toBe(true);
    });

    it("does not score firstTry after a mistake", () => {
        expect(playBook(playWrong(start())).results[""].firstTry).toBe(false);
    });

    it("does not score firstTry after a hint", () => {
        const hinted = trainerReducer(start(), { type: T.HINT });
        expect(playBook(hinted).results[""].firstTry).toBe(false);
    });

    it("breaks the streak on a wrong move", () => {
        let s = playBook(start());
        s = trainerReducer(s, { type: T.ADVANCE, payload: { reply: repliesAt(italian, s.path)[0] } });
        s = playBook(s);
        expect(s.streak).toBe(2);
        s = trainerReducer(s, { type: T.ADVANCE, payload: { reply: repliesAt(italian, s.path)[0] } });
        expect(playWrong(s).streak).toBe(0);
    });

    it("remembers the best streak across a reset", () => {
        const s = playBook(start());
        expect(trainerReducer(s, { type: T.RESET }).bestStreak).toBe(1);
    });

    it("hint level tops out at 2", () => {
        let s = start();
        for (let i = 0; i < 5; i++) s = trainerReducer(s, { type: T.HINT });
        expect(s.hintLevel).toBe(2);
    });

    it("skip advances but scores a miss", () => {
        const s = trainerReducer(start(), { type: T.SKIP });
        expect(s.path).toBe("e2e4");
        expect(s.results[""].firstTry).toBe(false);
        expect(s.results[""].skipped).toBe(true);
    });

    it("ignores an attempt while the book is replying", () => {
        const s = playBook(start());
        expect(playWrong(s)).toBe(s);
    });

    it("the opening name deepens as the line goes on", () => {
        let s = start();
        const first = currentOpening(s).name;
        for (let i = 0; i < 6 && s.phase !== Phase.lineComplete; i++) {
            s = s.phase === Phase.answering
                ? playBook(s)
                : trainerReducer(s, {
                    type: T.ADVANCE,
                    payload: { reply: repliesAt(s.repertoire, s.path)[0] },
                });
        }
        expect(currentOpening(s).name).not.toBe(first);
        expect(currentOpening(s).depth).toBeGreaterThan(0);
    });

    it("reaches lineComplete and reports the run", () => {
        let s = start();
        for (let g = 0; g < 80 && s.phase !== Phase.lineComplete; g++) {
            s = s.phase === Phase.answering
                ? playBook(s)
                : trainerReducer(s, {
                    type: T.ADVANCE,
                    payload: { reply: repliesAt(s.repertoire, s.path)[0] },
                });
        }
        expect(s.phase).toBe(Phase.lineComplete);
        const p = runProgress(s);
        expect(p.answered).toBeGreaterThan(0);
        expect(p.firstTry).toBe(p.answered);
    });

    it("restart goes back to the root", () => {
        const s = trainerReducer(playBook(start()), { type: T.RESTART });
        expect(s.path).toBe("");
        expect(s.runs).toBe(1);
    });
});

describe("every book move is playable on the real board", () => {
    it("holds for every position in every repertoire", () => {
        [italian, caro, ruy].forEach((rep) => {
            Object.keys(rep.nodes).forEach((p) => {
                const prefix = buildPosition(rep, p);
                bookSquares(rep, p).forEach((o) => {
                    expect(legalMovesAt(prefix, o.from[0], o.from[1]))
                        .toContainEqual([o.to[0], o.to[1]]);
                });
            });
        });
    });
});
