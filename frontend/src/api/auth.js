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

export function logout() {
    setToken(null);
    cacheUser(null);
}
