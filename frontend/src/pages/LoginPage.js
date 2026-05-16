import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthForm from "../auth/AuthForm";
import "./LoginPage.css";

export default function LoginPage() {
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/";

    useEffect(() => {
        if (!isLoading && user) navigate(from, { replace: true });
    }, [user, isLoading, navigate, from]);

    if (isLoading) {
        return <main className="page page--login"><div className="login-card">Loading…</div></main>;
    }

    return (
        <main className="page page--login">
            <div className="login-card">
                <h1 className="login-title">Welcome to Yinon Chess</h1>
                <p className="login-sub">Log in or create an account to play.</p>
                <AuthForm
                    initialMode="login"
                    onSuccess={() => navigate(from, { replace: true })}
                />
            </div>
        </main>
    );
}
