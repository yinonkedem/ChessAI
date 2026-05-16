import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/Context";
import { Status } from "../../constants";
import { useAuth } from "../../auth/AuthContext";
import AuthDialog from "./AuthDialog";
import "./Toolbar.css";

export default function Toolbar({ onNewGame }) {
    const { appState } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [showAuth, setShowAuth] = useState(false);

    const inProgress =
        appState.isGameSetup &&
        (appState.status === Status.ongoing || appState.status === Status.promoting) &&
        appState.movesList.length > 0;

    const confirmIfNeeded = () => {
        const onStartScreen = location.pathname === "/";
        if (!onStartScreen && inProgress) {
            return window.confirm("Start a new game? Your current game will be lost.");
        }
        return true;
    };

    const onHomeClick = () => {
        if (!confirmIfNeeded()) return;
        onNewGame?.();
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
                aria-label="Yinon Chess — start new game"
            >
                <span className="toolbar__brand-mark" aria-hidden="true">♛</span>
                <span className="toolbar__brand-text">Yinon Chess</span>
            </button>

            <nav className="toolbar__nav" aria-label="Primary">
                <button
                    type="button"
                    className={`toolbar__btn toolbar__btn--primary${isOn("/") ? " is-active" : ""}`}
                    onClick={onHomeClick}
                    aria-current={isOn("/") ? "page" : undefined}
                >
                    New Game
                </button>
                <button
                    type="button"
                    className={`toolbar__btn${isOn("/custom") ? " is-active" : ""}`}
                    onClick={onEditorClick}
                    aria-current={isOn("/custom") ? "page" : undefined}
                >
                    Editor
                </button>
            </nav>

            <div className="toolbar__auth">
                {user ? (
                    <>
                        <span className="toolbar__user" title={user.username}>
                            <span aria-hidden="true">👤</span>
                            <span className="toolbar__user-name">{user.username}</span>
                        </span>
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
