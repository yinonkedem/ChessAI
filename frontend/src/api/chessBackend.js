// src/chessBackend.js

// ① Derive the API base URL from your app’s current host & protocol.
//    Falls back to REACT_APP_API_HOST if you’d rather configure it via .env.
// const API_HOST =
//     process.env.REACT_APP_API_HOST ||
//     (() => {
//         const { protocol, hostname } = window.location;
//         return `${protocol}//${hostname}:8000`;
//     })();

// When served from the GKE Ingress, an empty host = same origin.
const API_HOST = process.env.REACT_APP_API_HOST || "";

/**
 * Generic helper to call any /engine/* endpoint on the backend.
 *
 * @param {string} path     - The sub-path under /engine (e.g. "best-move").
 * @param {object} params   - Query parameters to append to the URL.
 * @param {object} body     - JSON body to send in the POST request.
 * @returns {Promise<any>}   - Parsed JSON response from the server.
 * @throws {Error}           - If the response status is not OK.
 */
async function callEngine(path, params = {}, body = {}) {
    // If API_HOST is empty → same origin; otherwise prepend the host.
    const base = API_HOST || window.location.origin;
    const url = new URL(`/engine/${path}`, base);

    Object.entries(params).forEach(([k, v]) =>
        url.searchParams.set(k, v)
    );

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        // credentials: 'include',        // if you later add cookies/auth
        // signal: abortController.signal  // if you want timeout / cancellation
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Engine error (${response.status}): ${errorText}`);
    }

    return response.json();
}

/**
 * Request the best move from the specified engine.
 *
 * @param {object} options
 * @param {string} options.fen      - FEN string of the current position.
 * @param {number} options.depth    - Search depth (default: 8).
 * @param {string} options.engine   - Engine key (e.g. "stockfish" or "random").
 * @returns {Promise<{best_move: string, info: object}>}
 */
export function getBestMove({fen, depth = 8, engine = "stockfish"}) {
    return callEngine("best-move", {engine}, {fen, depth});
}

/**
 * Request all legal moves for the given position.
 *
 * @param {object} options
 * @param {string} options.fen      - FEN string of the current position.
 * @returns {Promise<{ moves: string[] }>}
 */
export function getLegalMoves({fen}) {
    return callEngine("legal-moves", {}, {fen});
}
