import { apiUrl } from "./apiBase";

async function callEngine(path, params = {}, body = {}) {
    const url = apiUrl(`/engine/${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Engine error (${response.status}): ${errorText}`);
    }

    return response.json();
}

export function getBestMove({ fen, movetime_ms, depth, engine = "stockfish" }) {
    const body = { fen };
    if (movetime_ms != null) body.movetime_ms = movetime_ms;
    if (depth != null) body.depth = depth;
    return callEngine("best-move", { engine }, body);
}
