import { apiUrl } from "./apiBase";
import { getToken } from "./auth";

const authHeaders = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
};

async function req(path, { method = "GET", body } = {}) {
    const res = await fetch(apiUrl(path).toString(), {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...authHeaders(),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const d = data?.detail;
        throw new Error(typeof d === "string" ? d : `Request failed (${res.status})`);
    }
    return data;
}

/** Every stored card, for merging into the local store on sign-in. */
export const fetchCards = (repertoireId) =>
    req(`/training/cards${repertoireId ? `?repertoire_id=${encodeURIComponent(repertoireId)}` : ""}`);

/** Push a batch of reviews. One request per session, not per move. */
export const pushReviews = (reviews) => req("/training/review", { method: "POST", body: { reviews } });

export const fetchProgress = () => req("/training/progress");

export const fetchStats = () => req("/training/stats");

export const resetRepertoire = (repertoireId) =>
    req(`/training/repertoire/${encodeURIComponent(repertoireId)}`, { method: "DELETE" });
