// src/hooks/usePersistedReducer.js
import { useReducer, useCallback, useEffect } from "react";

export default function usePersistedReducer(reducer, initialState, key) {
    // ①  Hydrate from localStorage once
    const initializer = useCallback(() => {
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : initialState;
    }, [initialState, key]);

    const [state, dispatch] = useReducer(reducer, undefined, initializer);

    // ②  Save on every state change
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(state));
    }, [state, key]);

    return [state, dispatch];
}
