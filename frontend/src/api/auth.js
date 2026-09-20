import { apiUrl } from "./apiBase";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

const setToken = (t) =>
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export const getUser = () => {
    const s = localStorage.getItem(USER_KEY);
    try { return s ? JSON.parse(s) : null; } catch { return null; }
};

const cacheUser = (u) =>
    u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY);

export async function signup({ username, email, password }) {
    const res = await fetch(apiUrl("/auth/signup").toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Signup failed");
    return data;
}

export async function login({ username, password }) {
    const body = new URLSearchParams({ username, password });
    const res = await fetch(apiUrl("/auth/login").toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Login failed");
    setToken(data.access_token);
    return data;
}

export async function me() {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(apiUrl("/auth/me").toString(), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    cacheUser(user);
    return user;
}

/** FastAPI validation errors come back as a list of objects, not a string. */
function errorMessage(data, fallback) {
    const d = data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
    return fallback;
}

async function authed(path, { method, body }) {
    const token = getToken();
    if (!token) throw new Error("You are not signed in");
    const res = await fetch(apiUrl(path).toString(), {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, `Request failed (${res.status})`));
}

export async function changePassword({ currentPassword, newPassword }) {
    return authed("/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
    });
}

/** Permanently deletes the account and every game it owns. Signs out on success. */
export async function deleteAccount({ password }) {
    await authed("/auth/me", { method: "DELETE", body: { password } });
    logout();
}

export function logout() {
    setToken(null);
    cacheUser(null);
}
