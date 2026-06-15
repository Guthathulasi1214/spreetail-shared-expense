/**
 * src/context/AuthContext.jsx
 *
 * Provides auth state (user, loading) and actions (login, signup, logout)
 * to the entire app via React Context.
 *
 * On mount: if a token exists in localStorage, calls GET /auth/me to
 * rehydrate the session. This means refreshing the page keeps you logged in.
 * If /auth/me fails (expired/invalid token), the token is silently cleared.
 *
 * WHY context + hook (not Redux)?
 * Auth state is global but simple (one user object). Context + a custom hook
 * gives us the same ergonomics with zero extra dependencies and far less
 * boilerplate — easy to trace in a live session.
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true until initial session check completes

  // On app startup: rehydrate session from stored token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('token')) // stale token — discard
      .finally(() => setLoading(false));
  }, []);

  /**
   * Log in with email + password.
   * Stores the returned JWT and updates the user state.
   * Throws on bad credentials so the Login page can show an error.
   */
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  /**
   * Create a new account.
   * Immediately logs the user in after successful signup.
   */
  const signup = useCallback(async (name, email, password) => {
    const res = await api.post('/auth/signup', { name, email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  /**
   * Clear session — removes token from storage and resets user state.
   * The Axios 401 interceptor also calls this automatically on expired tokens.
   */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
