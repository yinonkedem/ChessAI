// src/api/auth.js
const API_HOST =
    process.env.REACT_APP_API_HOST ||
    (() => {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:8000`;
    })();

export const getToken = () => localStorage.getItem("auth_token");
export const setToken = (t) =>
    t ? localStorage.setItem("auth_token", t) : localStorage.removeItem("auth_token");

export const getUser = () => {
    const s = localStorage.getItem("auth_user");
    try { return s ? JSON.parse(s) : null; } catch { return null; }
};
export const setUser = (u) =>
    u ? localStorage.setItem("auth_user", JSON.stringify(u)) : localStorage.removeItem("auth_user");

export async function signup({ username, email, password }) {
    const res = await fetch(`${API_HOST}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Signup failed");
    return data; // { id, username, email, disabled }
}

export async function login({ username, password }) {
    const body = new URLSearchParams({ username, password });
    const res = await fetch(`${API_HOST}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Login failed");
    setToken(data.access_token);
    return data; // { access_token, token_type }
}

export async function me() {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(`${API_HOST}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    setUser(user);
    return user; // { id, username, email, disabled }
}

export function logout() {
    setToken(null);
    setUser(null);
}
