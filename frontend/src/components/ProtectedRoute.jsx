/**
 * src/components/ProtectedRoute.jsx
 *
 * Wraps any route that requires authentication.
 *
 * While the session is being rehydrated from localStorage (loading=true),
 * shows a full-screen spinner so there's no flash of the login page for
 * users who are already authenticated.
 *
 * Once loading is done:
 *   - user exists → render the protected content
 *   - no user     → redirect to /login (replace=true so back button works correctly)
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
