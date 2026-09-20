/**
 * Validates the generated opening book against the app's OWN chess engine.
 *
 * The book is produced by tools/build_openings.py using python-chess. This test
 * is the bridge: it proves that every move python-chess considers legal is also
 * legal according to frontend/src/arbiter, using the app's own board convention
 * (position[rank][file], rank 0 = White's back rank).
 *
 * Without this, a coordinate or castling-convention mismatch between the two
 * engines would surface as the trainer rejecting a correct book move — telling
 * a learner they were wrong when they were right. That is the single worst
 * failure this feature can have, so it is tested up front.
 */

import fs from "fs";
import path from "path";

import arbiter from "../arbiter/arbiter";
import { getCastlingDirections } from "../arbiter/getMoves";
import { createPosition } from "../helper";
import { uciToCoords } from "../utils/uciToCoords";

const BOOK_DIR = path.join(__dirname, "..", "..", "public", "openings");

const index = JSON.parse(fs.readFileSync(path.join(BOOK_DIR, "index.json"), "utf8"));

/**
 * Replays a line the way the trainer will: ply by ply, through the arbiter,
 * tracking castling rights incrementally.
 *
 * Rights are tracked with getCastlingDirections rather than inferred from the
 * final board (helper.js getCastleRights), because inference wrongly restores
 * the right when a rook leaves h1 and comes back.
 */
function replayThroughArbiter(line) {
    const history = [createPosition()];
    let castleDirection = { w: "both", b: "both" };
    const problems = [];

    line.moves.forEach((move, ply) => {
        const board = history[history.length - 1];
        const prevBoard = history.length > 1 ? history[history.length - 2] : board;
        const [[fromRank, fromFile], [toRank, toFile]] = uciToCoords(move.uci);

        const piece = board[fromRank][fromFile];
        if (!piece) {
            problems.push(`ply ${ply} (${move.san}): no piece on the from-square`);
            return;
        }

        const expectedColor = ply % 2 === 0 ? "w" : "b";
        if (piece[0] !== expectedColor) {
            problems.push(`ply ${ply} (${move.san}): ${piece} moved but it is ${expectedColor} to play`);
            return;
        }

        const legal = arbiter.getValidMoves({
            // getValidMoves wants the STRING for the side to move
            // ('both'|'left'|'right'|'none'), not the {w,b} object — see
            // getCastlingMoves in arbiter/getMoves.js:176, and the call sites
            // in Piece.js:32 / Pieces.js:154. Passing the object silently
            // disables castling instead of throwing.
            position: board,
            castleDirection: castleDirection[piece[0]],
            prevPosition: prevBoard,
            piece,
            rank: fromRank,
            file: fromFile,
        });
        if (!legal.some(([r, f]) => r === toRank && f === toFile)) {
            problems.push(
                `ply ${ply} (${move.san} / ${move.uci}): arbiter says ${piece} ` +
                `cannot reach [${toRank},${toFile}]`
            );
            return;
        }

        if (piece.endsWith("k") || piece.endsWith("r")) {
            const dir = getCastlingDirections({
                castleDirection,
                piece,
                file: fromFile,
                rank: fromRank,
            });
            if (dir) {
                castleDirection = { ...castleDirection, [piece[0]]: dir };
            }
        }

        history.push(
            arbiter.performMove({
                position: board,
                piece,
                rank: fromRank,
                file: fromFile,
                x: toRank,
                y: toFile,
            })
        );
    });

    return { problems, history, castleDirection };
}

describe("opening book", () => {
    it("has a catalog with at least one repertoire", () => {
        expect(index.repertoires.length).toBeGreaterThan(0);
        expect(index.version).toBeGreaterThan(0);
    });

    it("covers both colours", () => {
        const sides = new Set(index.repertoires.map((r) => r.side));
        expect(sides).toEqual(new Set(["w", "b"]));
    });

    it("has globally unique line ids", () => {
        const ids = index.repertoires
            .flatMap((r) => JSON.parse(fs.readFileSync(path.join(BOOK_DIR, r.file), "utf8")).lines)
            .map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    describe.each(index.repertoires.map((r) => [r.id, r]))("%s", (_id, entry) => {
        const doc = JSON.parse(fs.readFileSync(path.join(BOOK_DIR, entry.file), "utf8"));

        it("matches the catalog entry", () => {
            expect(doc.side).toBe(entry.side);
            expect(doc.lines).toHaveLength(entry.lineCount);
            const cards = doc.lines.reduce((n, l) => n + l.answerPlies.length, 0);
            expect(cards).toBe(entry.cardCount);
        });

        describe.each(doc.lines.map((l) => [l.label, l]))("%s", (_label, line) => {
            it("replays legally through the arbiter", () => {
                const { problems } = replayThroughArbiter(line);
                expect(problems).toEqual([]);
            });

            it("has ideas index-aligned with moves", () => {
                expect(line.ideas).toHaveLength(line.moves.length);
            });

            it("gives the learner a move on every answer ply, and only their own", () => {
                expect(line.answerPlies.length).toBeGreaterThan(0);
                const wantEven = line.side === "w";
                line.answerPlies.forEach((ply) => {
                    expect(ply % 2 === 0).toBe(wantEven);
                    expect(ply).toBeLessThan(line.moves.length);
                });
            });

            it("carries a well-formed ECO code and a uci for every move", () => {
                expect(line.eco).toMatch(/^[A-E]\d{2}$/);
                expect(line.name.length).toBeGreaterThan(0);
                line.moves.forEach((m) => {
                    expect(m.uci).toMatch(/^[a-h][1-8][a-h][1-8]$/);
                    expect(m.san.length).toBeGreaterThan(0);
                });
            });
        });
    });
});
