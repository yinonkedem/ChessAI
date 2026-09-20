import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "chess-theme";

/**
 * Theme is stored as "light" | "dark" | "system".
 * "system" writes no data-theme attribute at all, so tokens.css falls back
 * to :root (light) and we mirror the OS preference by stamping the resolved
 * value instead — that keeps the CSS to a single [data-theme="dark"] block.
 */
function readStored() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === "light" || v === "dark" || v === "system") return v;
    } catch {
        /* private mode / blocked storage — fall through */
    }
    return "system";
}

function prefersDark() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
    );
}

export function resolveTheme(pref) {
    if (pref === "system") return prefersDark() ? "dark" : "light";
    return pref;
}

export default function useTheme() {
    const [preference, setPreference] = useState(readStored);
    const resolved = resolveTheme(preference);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", resolved);
        document.documentElement.style.colorScheme = resolved;
    }, [resolved]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, preference);
        } catch {
            /* non-fatal */
        }
    }, [preference]);

    // Follow the OS while the user hasn't made an explicit choice.
    useEffect(() => {
        if (preference !== "system") return;
        const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
        if (!mq) return;
        const onChange = () => setPreference("system");
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [preference]);

    const toggle = useCallback(() => {
        setPreference(resolveTheme(preference) === "dark" ? "light" : "dark");
    }, [preference]);

    return { theme: resolved, preference, setPreference, toggle };
}
