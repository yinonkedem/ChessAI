import { useEffect } from "react";
import AuthForm from "../../auth/AuthForm";
import "./AuthDialog.css";

export default function AuthDialog({ initialMode = "login", onClose, onAuthenticated }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <>
            <div className="auth-backdrop" onClick={onClose} />
            <div className="auth-layer" role="dialog" aria-modal="true">
                <div className="auth-dialog" onClick={(e) => e.stopPropagation()}>
                    <AuthForm
                        initialMode={initialMode}
                        onCancel={onClose}
                        onSuccess={(u) => {
                            onAuthenticated?.(u);
                            onClose?.();
                        }}
                    />
                </div>
            </div>
        </>
    );
}
