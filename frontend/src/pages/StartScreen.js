import {useEffect, useState} from "react";
import "./StartScreen.css";
import {setEngineDepth} from "../reducer/actions/game";
import {useAppContext} from "../contexts/Context";
import {GameMode} from "../constants";
import {useGlitch}  from "react-powerglitch";
import actionTypes from "../reducer/actionTypes";
import { signup, login, me, logout, getUser } from "../api/auth";

export default function StartScreen({onStart}) {
    const [colour, setColour] = useState(null);     // "w" | "b" | "rand"
    const [opponent, setOpponent] = useState(null); // "human" | "ai" | "rand"
    const [mode,     setMode]     = useState(GameMode.standard);

    // auth bits
    const [user, setUser] = useState(getUser());
    const [showAuth, setShowAuth] = useState(false);
    const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const ready = mode === GameMode.custom ? colour : colour && opponent;

    const {appState, dispatch} = useAppContext();
    useEffect(() => { dispatch({ type: actionTypes.RESET_ALL }); }, [dispatch]);
    const depth = appState.engineDepth;

    // try to hydrate user if we already have a token
    useEffect(() => { (async () => { if (!user) setUser(await me()); })(); }, []); // eslint-disable-line
    useEffect(() => {
        if (!showAuth) return;
        const first = document.querySelector(".auth-dialog input");
        first?.focus();

        const onKey = (e) => { if (e.key === "Escape") setShowAuth(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [showAuth]);

    /* helper – adds the css class "active" when selected */
    const cls = (base, active) => (active ? `${base} active` : base);

    const glitch = useGlitch({
        playMode: "always",
        slice: { count:4, velocity:10 },
        shake: { velocity:5 },
    });

    async function handleAuthSubmit(e){
        e.preventDefault();
        setError(""); setSubmitting(true);
        try{
            if(authMode === "signup"){
                await signup({ username: form.username.trim(), email: form.email.trim(), password: form.password });
                // auto-login after signup
                await login({ username: form.username.trim(), password: form.password });
            }else{
                await login({ username: form.username.trim(), password: form.password });
            }
            const u = await me();
            setUser(u);
            setShowAuth(false);
            setForm({ username: "", email: "", password: "" });
        }catch(err){
            setError(err.message || "Something went wrong");
        }finally{
            setSubmitting(false);
        }
    }

    function handleLogout(){
        logout();
        setUser(null);
    }

    return (
        <section className={`start-screen ${showAuth ? "modal-open" : ""}`}>
            {/* top-right auth bar */}
            <div className="auth-bar">
                {user ? (
                    <>
                        <span className="user-chip">👤 {user.username}</span>
                        <button className="btn btn--glass"
                                onClick={handleLogout}>Logout
                        </button>
                    </>
                ) : (
                    <>
                        <button className="btn btn--glass" onClick={() => {
                            setAuthMode("signup");
                            setShowAuth(true);
                        }}>Sign up
                        </button>
                        <button className="btn btn--glass" onClick={() => {
                            setAuthMode("login");
                            setShowAuth(true);
                        }}>Log in
                        </button>
                    </>
                )}
            </div>

            {/* glitch-animated title */}
            <h1 ref={glitch.ref} className="start-screen__title glitch">
                Yinon&nbsp;Chess
            </h1>
            <p className="start-screen__subtitle">Set up your match</p>

            {/* auth dialog (inline card) */}
            {(!user && showAuth) && (
                <>
                    {/* backdrop that closes on click */}
                    <div className="auth-backdrop" onClick={() => setShowAuth(false)} />

                    {/* centered modal layer */}
                    <div className="auth-layer" role="dialog" aria-modal="true">
                        <div className="auth-dialog" onClick={(e) => e.stopPropagation()}>
                            <h3>{authMode === "signup" ? "Create your account" : "Welcome back"}</h3>
                            <form onSubmit={handleAuthSubmit}>
                                <input
                                    placeholder="Username"
                                    value={form.username}
                                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                                    required
                                />
                                {authMode === "signup" && (
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
                                    <button type="button" className="btn btn--glass" onClick={() => setShowAuth(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn" disabled={submitting}>
                                        {submitting ? "Please wait..." : authMode === "signup" ? "Sign up" : "Log in"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            <div className="setup-grid panel--neo">
                {/* game mode block ------------------------------------------------- */}
                <div className="setup-block">
                    <h2 className="setup-heading">Game mode</h2>
                    <div className="btn-group">
                        <button
                            className={cls("btn btn--glass", mode === GameMode.standard)}
                            onClick={() => setMode(GameMode.standard)}>
                            Standard
                        </button>
                        <button
                            className={cls("btn btn--glass", mode === GameMode.custom)}
                            onClick={() => setMode(GameMode.custom)}>
                            Custom
                        </button>
                    </div>
                </div>

                {/* piece colour block ---------------------------------------------- */}
                <div className="setup-block">
                    <h2 className="setup-heading">Your colour</h2>
                    <div className="btn-group">
                        <button
                            className={cls("btn btn--white", colour === "white")}
                            onClick={() => setColour("white")}
                        >
                            White
                        </button>
                        <button
                            className={cls("btn btn--black", colour === "black")}
                            onClick={() => setColour("black")}
                        >
                            Black
                        </button>
                        <button
                            className={cls("btn btn--glass", colour === "rand")}
                            onClick={() => setColour("rand")}
                        >
                            Random
                        </button>
                    </div>
                </div>

                {/* opponent block --------------------------------------------------- */}
                <div className="setup-block">
                    <h2 className="setup-heading">Opponent</h2>
                    <div className="btn-group">
                        <button
                            className={cls("btn btn--glass", opponent === "human")}
                            onClick={() => setOpponent("human")}
                            disabled={mode === GameMode.custom}
                        >
                            Human
                        </button>
                        <button
                            className={cls("btn btn--glass", opponent === "ai")}
                            onClick={() => setOpponent("ai")}
                            disabled={mode === GameMode.custom}
                        >
                            Computer
                        </button>
                        <button
                            className={cls("btn btn--glass", opponent === "rand")}
                            onClick={() => setOpponent("rand")}
                            disabled={mode === GameMode.custom}
                        >
                            Random
                        </button>
                    </div>
                </div>
            </div>

            {/* depth slider – only show when playing vs AI -------------------------- */}
            {opponent === "ai" && (
                <div className="setup-block">
                    <h2 className="setup-heading">
                        Computer strength: depth&nbsp;
                        <strong>{depth}</strong>
                    </h2>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={depth}
                        onChange={e =>
                            dispatch(setEngineDepth(+e.target.value))
                        }
                    />
                </div>
            )}

            {/* play --------------------------------------------------------------- */}
            <footer className="footer">
                <button
                    type="button"
                    className="btn btn--primary play-btn"
                    disabled={!ready /* (Optional) || !user to require login */}
                    onClick={() => ready && onStart({
                        colour,
                        opponent,
                        mode,
                        depth
                    })}
                >
                    {mode === GameMode.custom ? "Next →" : "Play"}
                </button>
            </footer>
        </section>
    );
}
