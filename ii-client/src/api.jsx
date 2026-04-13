import axios from "axios";

// In production the React app and API share the same domain, so /api works.
// In development Vite proxies /api → https://localhost:7046 (see vite.config.js).
const api = axios.create({
    baseURL: "/api",
    withCredentials: true
});

export default api;