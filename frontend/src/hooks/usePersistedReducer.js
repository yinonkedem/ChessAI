import { useReducer, useEffect } from "react";

const isFn = (v) => typeof v === "function";

export default function usePersistedReducer(reducer, initial, key) {
    const initializer = () => {
        const cached = localStorage.getItem(key);
        if (cached) {
            try { return JSON.parse(cached); } catch { /* fall through */ }
        }
        return isFn(initial) ? initial() : initial;
    };

    const [state, dispatch] = useReducer(reducer, undefined, initializer);

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(state));
    }, [state, key]);

    return [state, dispatch];
}
