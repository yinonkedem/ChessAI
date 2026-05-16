import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function AuthForm({ initialMode = "login", onSuccess, onCancel, autoFocus = true }) {
    const { login, signup } = useAuth();
    const [mode, setMode] = useState(initialMode);
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const creds = {
                username: form.username.trim(),
                email: form.email.trim(),
                password: form.password,
            };
            const user = mode === "signup" ? await signup(creds) : await login(creds);
            onSuccess?.(user);
        } catch (err) {
            setError(err.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-tabs">
                <button
                    type="button"
                    className={mode === "login" ? "active" : ""}
                    onClick={() => setMode("login")}
                >Log in</button>
                <button
                    type="button"
                    className={mode === "signup" ? "active" : ""}
                    onClick={() => setMode("signup")}
                >Sign up</button>
            </div>

            <input
                placeholder="Username"
                autoFocus={autoFocus}
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
            />
            {mode === "signup" && (
                <input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                />
            )}
            <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
            />

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-actions">
                {onCancel && (
                    <button type="button" className="btn btn--glass" onClick={onCancel}>
                        Cancel
                    </button>
                )}
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                    {submitting ? "Please wait…" : mode === "signup" ? "Sign up" : "Log in"}
                </button>
            </div>
        </form>
    );
}
