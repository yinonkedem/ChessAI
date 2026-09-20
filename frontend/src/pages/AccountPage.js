import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { changePassword } from "../api/auth";
import "./AccountPage.css";

const MIN_PASSWORD = 8;

function ChangePasswordCard() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [status, setStatus] = useState(null); // {kind: 'ok'|'error', text}
    const [busy, setBusy] = useState(false);

    const mismatch = confirm.length > 0 && next !== confirm;
    const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
    const ready = current && next.length >= MIN_PASSWORD && next === confirm && !busy;

    async function onSubmit(e) {
        e.preventDefault();
        if (!ready) return;
        setBusy(true);
        setStatus(null);
        try {
            await changePassword({ currentPassword: current, newPassword: next });
            setStatus({ kind: "ok", text: "Password changed." });
            setCurrent("");
            setNext("");
            setConfirm("");
        } catch (err) {
            setStatus({ kind: "error", text: err.message });
        } finally {
            setBusy(false);
        }
    }

    return (
        <form className="card account__card" onSubmit={onSubmit}>
            <h2 className="card__title">Change password</h2>
            <p className="card__subtitle">
                You&apos;ll stay signed in on this device. At least {MIN_PASSWORD} characters.
            </p>

            <div className="account__fields">
                <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Current password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                />
                <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    aria-invalid={tooShort || undefined}
                />
                <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={mismatch || undefined}
                />
            </div>

            {tooShort && (
                <p className="account__hint account__hint--error">
                    Needs at least {MIN_PASSWORD} characters.
                </p>
            )}
            {mismatch && (
                <p className="account__hint account__hint--error">Passwords don&apos;t match.</p>
            )}
            {status && (
                <p
                    className={`account__hint account__hint--${status.kind === "ok" ? "ok" : "error"}`}
                    role="status"
                >
                    {status.text}
                </p>
            )}

            <div className="account__actions">
                <button type="submit" className="btn btn--primary" disabled={!ready}>
                    {busy ? "Saving…" : "Change password"}
                </button>
            </div>
        </form>
    );
}

function DeleteAccountCard({ username }) {
    const { deleteAccount } = useAuth();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [typed, setTyped] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    // Two independent confirmations: proof of identity (password) and proof of
    // intent (typing the username). This is irreversible and cascades to games.
    const ready = password && typed === username && !busy;

    async function onDelete() {
        if (!ready) return;
        setBusy(true);
        setError(null);
        try {
            await deleteAccount(password);
            navigate("/login", { replace: true });
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <section className="card account__card account__card--danger">
            <h2 className="card__title">Delete account</h2>
            <p className="card__subtitle">
                Permanently deletes your account and every game you&apos;ve saved. This cannot be
                undone. Your username and email become available again, so you can sign up fresh.
            </p>

            {!open ? (
                <div className="account__actions">
                    <button type="button" className="btn btn--danger" onClick={() => setOpen(true)}>
                        Delete my account
                    </button>
                </div>
            ) : (
                <>
                    <div className="account__fields">
                        <input
                            type="password"
                            autoComplete="current-password"
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <input
                            type="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck="false"
                            placeholder={`Type ${username} to confirm`}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            aria-label={`Type your username, ${username}, to confirm deletion`}
                        />
                    </div>

                    {error && (
                        <p className="account__hint account__hint--error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="account__actions">
                        <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => {
                                setOpen(false);
                                setPassword("");
                                setTyped("");
                                setError(null);
                            }}
                            disabled={busy}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn--danger"
                            onClick={onDelete}
                            disabled={!ready}
                        >
                            {busy ? "Deleting…" : "Delete permanently"}
                        </button>
                    </div>
                </>
            )}
        </section>
    );
}

export default function AccountPage() {
    const { user } = useAuth();
    if (!user) return null; // ProtectedRoute handles the redirect

    const stats = user.stats || {};

    return (
        <main className="page page--account">
            <div className="account">
                <header className="account__header">
                    <h1>Account</h1>
                    <p className="muted">
                        {user.username} · {user.email}
                    </p>
                </header>

                <section className="card account__card">
                    <h2 className="card__title">Your record</h2>
                    <dl className="account__stats">
                        <div><dt>Games</dt><dd>{stats.games_played ?? 0}</dd></div>
                        <div><dt>Wins</dt><dd>{stats.wins ?? 0}</dd></div>
                        <div><dt>Losses</dt><dd>{stats.losses ?? 0}</dd></div>
                        <div><dt>Draws</dt><dd>{stats.draws ?? 0}</dd></div>
                    </dl>
                </section>

                <ChangePasswordCard />
                <DeleteAccountCard username={user.username} />
            </div>
        </main>
    );
}
