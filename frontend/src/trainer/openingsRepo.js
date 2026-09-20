/**
 * Loads the generated opening book from /openings/.
 *
 * The book is a static asset in public/, fetched rather than imported: CRA
 * inlines JSON imported from src/ into the main JS bundle, and there is no
 * reason to ship 43 KB of book to someone who only wants to play a game.
 *
 * Results are memoised for the page's lifetime — the book never changes
 * between fetches, only between deploys.
 */

const BASE = `${process.env.PUBLIC_URL || ""}/openings`;

const cache = new Map();

function loadJson(path) {
    if (!cache.has(path)) {
        cache.set(
            path,
            fetch(path)
                .then((res) => {
                    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
                    return res.json();
                })
                .catch((err) => {
                    // Don't cache a failure: a flaky network shouldn't leave the
                    // catalog permanently broken for the rest of the session.
                    cache.delete(path);
                    throw err;
                })
        );
    }
    return cache.get(path);
}

/** The catalog: every repertoire with counts, but no move data. */
export function loadIndex() {
    return loadJson(`${BASE}/index.json`);
}

/** One repertoire, with all of its lines and moves. */
export async function loadRepertoire(id) {
    const index = await loadIndex();
    const entry = index.repertoires.find((r) => r.id === id);
    if (!entry) throw new Error(`Unknown repertoire: ${id}`);
    // Bust the CDN on a rebuild — public/ assets aren't content-hashed by CRA.
    return loadJson(`${BASE}/${entry.file}?v=${index.version}`);
}
