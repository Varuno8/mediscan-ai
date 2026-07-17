export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'development' ? 'http://localhost:3001' : '');

export const getApiUrl = (endpoint: string) => {
    // Remove leading slash from endpoint if present to avoid double slashes if base url has one
    // But our base url is either empty or http://...:3000 (no trailing slash)
    // So we should ensure endpoint starts with /

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
};
