/**
 * src/api/axios.js
 *
 * Shared Axios instance for all API calls.
 *
 * Two interceptors:
 *
 * REQUEST interceptor: reads the JWT from localStorage and attaches it to
 * every outgoing request as "Authorization: Bearer <token>". This means
 * no controller or page component needs to manually add auth headers.
 *
 * RESPONSE interceptor: if any response comes back 401, the token is stale
 * or invalid — clear it and redirect to /login. This handles token expiry
 * transparently without every page needing to catch 401 individually.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach JWT ────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — handle global 401 ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear session and send to login
      localStorage.removeItem('token');
      // Only redirect if not already on the auth pages (prevents redirect loop)
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/signup')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
