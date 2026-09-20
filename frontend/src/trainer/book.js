/**
 * Navigating the opening tree.
 *
 * A repertoire is a map of positions keyed by the UCI path that reaches them
 * ("" is the start). Each node lists every book reply, so a position with two
 * playable continuations has two replies and either is correct.
 *
 * The path is also the spaced-repetition card key: one card per position, so
 * a shared prefix like 1.e4 is drilled once no matter how many lines use it.
 */

export const pathSteps = (path) => {
    const out = [];
    for (let i = 0; i < path.length; i += 4) out.push(path.slice(i, i + 4));
    return out;
};

export const nodeAt = (repertoire, path) => repertoire.nodes[path] ?? null;

export const repliesAt = (repertoire, path) => nodeAt(repertoire, path)?.replies ?? [];

/** Has the learner reached the end of a line? */
export function isEnd(repertoire, path) {
    const node = nodeAt(repertoire, path);
    return !node || node.end === true || node.replies.length === 0;
}

/** Is the learner the one to move here? */
export function isMine(repertoire, path) {
    return nodeAt(repertoire, path)?.mine === true;
}

/**
 * The moves played to reach `path`, with the SAN taken from the book so it
 * keeps its + and # (getNewMoveNotation emits neither).
 */
export function pathMoves(repertoire, path) {
    const out = [];
    let prefix = "";
    for (const uci of pathSteps(path)) {
        const node = nodeAt(repertoire, prefix);
        const reply = node?.replies.find((r) => r.uci === uci);
        out.push({
            uci,
            san: reply?.san ?? uci,
            mine: node?.mine === true,
            idea: reply?.idea ?? null,
        });
        prefix += uci;
    }
    return out;
}

/** Where the learner currently is, named by the deepest ECO match. */
export function describe(repertoire, path) {
    const node = nodeAt(repertoire, path);
    return {
        eco: node?.eco ?? null,
        name: node?.name ?? null,
        depth: pathSteps(path).length,
    };
}

/** The opponent's reply. Random among the book moves, so drills vary. */
export function chooseReply(repertoire, path, rng = Math.random) {
    const replies = repliesAt(repertoire, path);
    if (replies.length === 0) return null;
    return replies[Math.floor(rng() * replies.length)];
}

/** Every position in the repertoire the learner has to answer. */
export function myPositions(repertoire) {
    return Object.entries(repertoire.nodes)
        .filter(([, n]) => n.mine && n.replies.length > 0)
        .map(([path]) => path);
}

/**
 * A path to start a fresh run from. Walks the tree from the root, taking a
 * random book reply at every branch, so repeated runs explore different lines.
 * Returns "" — the start position — since the tree itself does the branching.
 */
export const startPath = () => "";
