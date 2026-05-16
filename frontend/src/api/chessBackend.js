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

export function getBestMove({ fen, depth = 8, engine = "stockfish" }) {
    return callEngine("best-move", { engine }, { fen, depth });
}
