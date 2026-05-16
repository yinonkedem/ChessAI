import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
    getToken,
    getUser,
    login as apiLogin,
    logout as apiLogout,
    me,
    signup as apiSignup,
} from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const cached = getUser();
    const [user, setUser] = useState(cached);
    const [isLoading, setIsLoading] = useState(!!getToken() && !cached);

    useEffect(() => {
        if (!getToken()) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const u = await me();
            if (cancelled) return;
            setUser(u);
            setIsLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const refresh = useCallback(async () => {
        const u = await me();
        setUser(u);
        return u;
    }, []);

    const login = useCallback(async (creds) => {
        await apiLogin(creds);
        return refresh();
    }, [refresh]);

    const signup = useCallback(async (creds) => {
        await apiSignup(creds);
        await apiLogin({ username: creds.username, password: creds.password });
        return refresh();
    }, [refresh]);

    const logout = useCallback(() => {
        apiLogout();
        setUser(null);
    }, []);

    const value = { user, isLoading, login, signup, logout, refresh };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
