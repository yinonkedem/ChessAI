export const API_HOST = process.env.REACT_APP_API_HOST || "";

export function apiUrl(path) {
    const base = API_HOST || window.location.origin;
    return new URL(path, base);
}
