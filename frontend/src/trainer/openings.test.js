/**
 * Validates the generated opening book against the app's OWN chess engine.
 *
 * The book is produced by tools/build_openings.py using python-chess. This
 * test is the bridge: it proves that every move python-chess considers legal
 * is also legal according to frontend/src/arbiter, in the app's own board
 * convention (position[rank][file], rank 0 = White's back rank).
 *
 * Without it, a mismatch between the two engines would surface as the trainer
 * rejecting a correct book move — telling a learner they were wrong when they
 * were right. That is the worst failure this feature can have.
 */

import fs from "fs";
import path from "path";

import { buildPosition, legalMovesAt } from "./buildPosition";
import { bookSquares } from "./judgeMove";
import { pathSteps } from "./book";

const BOOK_DIR = path.join(__dirname, "..", "..", "public", "openings");
const index = JSON.parse(fs.readFileSync(path.join(BOOK_DIR, "index.json"), "utf8"));

describe("opening book", () => {
    it("has a catalog", () => {
        expect(index.repertoires.length).toBeGreaterThan(0);
        expect(index.version).toBeGreaterThan(0);
    });

    it("covers both colours", () => {
        expect(new Set(index.repertoires.map((r) => r.side))).toEqual(new Set(["w", "b"]));
    });

    describe.each(index.repertoires.map((r) => [r.id, r]))("%s", (_id, entry) => {
        const doc = JSON.parse(fs.readFileSync(path.join(BOOK_DIR, entry.file), "utf8"));

        it("matches its catalog entry", () => {
            expect(doc.side).toBe(entry.side);
            expect(doc.lines).toHaveLength(entry.lineCount);
            expect(Object.keys(doc.nodes)).toHaveLength(entry.nodeCount);
            const cards = Object.values(doc.nodes)
                .filter((n) => n.mine && n.replies.length > 0).length;
            expect(cards).toBe(entry.cardCount);
        });

        it("has a root position", () => {
            expect(doc.nodes[""]).toBeTruthy();
            expect(doc.nodes[""].ply).toBe(0);
        });

        it("assigns turns consistently with the learner's colour", () => {
            Object.entries(doc.nodes).forEach(([p, n]) => {
                const ply = pathSteps(p).length;
                expect(n.ply).toBe(ply);
                expect(n.turn).toBe(ply % 2 === 0 ? "w" : "b");
                expect(n.mine).toBe((ply % 2 === 0) === (doc.side === "w"));
            });
        });

        it("keeps the tree connected — every node's parent exists", () => {
            Object.keys(doc.nodes).forEach((p) => {
                if (!p) return;
                const parent = p.slice(0, -4);
                expect(doc.nodes[parent]).toBeTruthy();
                expect(doc.nodes[parent].replies.some((r) => r.uci === p.slice(-4))).toBe(true);
            });
        });

        it("every book move is legal according to the arbiter", () => {
            const problems = [];
            Object.keys(doc.nodes).forEach((p) => {
                const prefix = buildPosition(doc, p);
                bookSquares(doc, p).forEach((o) => {
                    const legal = legalMovesAt(prefix, o.from[0], o.from[1]);
                    if (!legal.some(([r, f]) => r === o.to[0] && f === o.to[1])) {
                        problems.push(`${p || "start"} -> ${o.san} (${o.uci})`);
                    }
                });
            });
            expect(problems).toEqual([]);
        });

        it("uses well-formed uci and a real ECO code", () => {
            Object.values(doc.nodes).forEach((n) => {
                if (n.eco) expect(n.eco).toMatch(/^[A-E]\d{2}$/);
                n.replies.forEach((r) => {
                    expect(r.uci).toMatch(/^[a-h][1-8][a-h][1-8]$/);
                    expect(r.san.length).toBeGreaterThan(0);
                });
            });
        });

        it("explains the learner's moves", () => {
            const mine = Object.values(doc.nodes).filter((n) => n.mine && n.replies.length);
            const total = mine.reduce((a, n) => a + n.replies.length, 0);
            const explained = mine.reduce(
                (a, n) => a + n.replies.filter((r) => r.idea).length, 0);
            // Content can lag, but a repertoire with no prose at all is a bug.
            expect(explained / total).toBeGreaterThan(0.5);
        });

        it("lists its named variations", () => {
            doc.lines.forEach((l) => {
                expect(doc.nodes[l.path]).toBeTruthy();
                expect(l.plies).toBe(pathSteps(l.path).length);
            });
        });
    });
});
