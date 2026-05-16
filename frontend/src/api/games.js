import { apiUrl } from "./apiBase";
import { getToken } from "./auth";

function authHeaders() {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function saveGame({ user_color, opponent_type, result, reason, moves, final_fen }) {
    const res = await fetch(apiUrl("/games").toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ user_color, opponent_type, result, reason, moves, final_fen }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Save failed (${res.status})`);
    return data;
}

export async function listGames({ limit = 50, skip = 0 } = {}) {
    const url = apiUrl("/games");
    url.searchParams.set("limit", limit);
    url.searchParams.set("skip", skip);
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error(`List failed (${res.status})`);
    return res.json();
}
