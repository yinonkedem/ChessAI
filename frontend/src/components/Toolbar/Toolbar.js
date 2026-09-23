import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/Context";
import { Status } from "../../constants";
import { useAuth } from "../../auth/AuthContext";
import useTheme from "../../hooks/useTheme";
import { load as loadTrainer } from "../../trainer/localStore";
import AuthDialog from "./AuthDialog";
import "./Toolbar.css";

export default function Toolbar({ onNewGame }) {
    const { appState } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { theme, toggle: toggleTheme } = useTheme();

    const [showAuth, setShowAuth] = useState(false);
    // Read on each render rather than subscribing: the toolbar re-renders on
    // navigation, which is exactly when the streak can have changed.
    const streak = loadTrainer().stats.dayStreak;

    const inProgress =
        appState.isGameSetup &&
        (appState.status === Status.ongoing || appState.status === Status.promoting) &&
        appState.movesList.length > 0;

    const confirmIfNeeded = () => {
        const onStartScreen = location.pathname === "/play";
        if (!onStartScreen && inProgress) {
            return window.confirm("Start a new game? Your current game will be lost.");
        }
        return true;
    };

    const onNewGameClick = () => {
        if (!confirmIfNeeded()) return;
        onNewGame?.();
    };

    // Going home leaves the game untouched — only the setup screen resets it.
    const onHomeClick = () => navigate("/");

    const onLearnClick = () => {
        if (location.pathname.startsWith("/learn")) return;
        if (inProgress) {
            const ok = window.confirm("Go to the openings trainer? Your current game will be lost.");
            if (!ok) return;
        }
        navigate("/learn");
    };

    const onEditorClick = () => {
        if (location.pathname === "/custom") return;
        if (inProgress) {
            const ok = window.confirm("Open the position editor? Your current game will be lost.");
            if (!ok) return;
        }
        navigate("/custom");
    };

    const handleLogout = () => {
        logout();
        navigate("/login", { replace: true });
    };

    const isOn = (path) => location.pathname === path;

    return (
        <header className="toolbar">
            <button
                type="button"
                className="toolbar__brand"
                onClick={onHomeClick}
                aria-label="Yinon Chess — home"
            >
                <span className="toolbar__brand-mark" aria-hidden="true">♛</span>
                <span className="toolbar__brand-text">Yinon Chess</span>
            </button>

            <nav className="toolbar__nav" aria-label="Primary">
                {/* Learn leads: the trainer is what the site is for. */}
                <button
                    type="button"
                    className={`toolbar__btn toolbar__btn--primary${location.pathname.startsWith("/learn") ? " is-active" : ""}`}
                    onClick={onLearnClick}
                    aria-current={location.pathname.startsWith("/learn") ? "page" : undefined}
                >
                    Learn
                </button>
                <button
                    type="button"
                    className={`toolbar__btn${isOn("/play") ? " is-active" : ""}`}
                    onClick={onNewGameClick}
                    aria-current={isOn("/play") ? "page" : undefined}
                >
                    Play
                </button>
                <button
                    type="button"
                    className={`toolbar__btn toolbar__btn--secondary${isOn("/progress") ? " is-active" : ""}`}
                    onClick={() => navigate("/progress")}
                    aria-current={isOn("/progress") ? "page" : undefined}
                >
                    Progress
                </button>
                <button
                    type="button"
                    className={`toolbar__btn toolbar__btn--optional${isOn("/custom") ? " is-active" : ""}`}
                    onClick={onEditorClick}
                    aria-current={isOn("/custom") ? "page" : undefined}
                >
                    Editor
                </button>
            </nav>

            <div className="toolbar__auth">
                {streak > 0 && (
                    <span
                        className="toolbar__streak"
                        title={`${streak}-day learning streak`}
                        aria-label={`${streak} day learning streak`}
                    >
                        <span aria-hidden="true">🔥</span> {streak}
                    </span>
                )}
                <button
                    type="button"
                    className="toolbar__btn toolbar__btn--icon"
                    onClick={toggleTheme}
                    aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    title={theme === "dark" ? "Light theme" : "Dark theme"}
                >
                    <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
                </button>

                {user ? (
                    <>
                        <button
                            type="button"
                            className={`toolbar__user${isOn("/account") ? " is-active" : ""}`}
                            onClick={() => navigate("/account")}
                            title={`${user.username} — account settings`}
                            aria-current={isOn("/account") ? "page" : undefined}
                        >
                            <span aria-hidden="true">👤</span>
                            <span className="toolbar__user-name">{user.username}</span>
                        </button>
                        <button
                            type="button"
                            className="toolbar__btn"
                            onClick={handleLogout}
                        >Logout</button>
                    </>
                ) : (
                    !isOn("/login") && (
                        <button
                            type="button"
                            className="toolbar__btn"
                            onClick={() => setShowAuth(true)}
                        >Log in</button>
                    )
                )}
            </div>

            {showAuth && !user && (
                <AuthDialog
                    initialMode="login"
                    onClose={() => setShowAuth(false)}
                    onAuthenticated={() => setShowAuth(false)}
                />
            )}
        </header>
    );
}
