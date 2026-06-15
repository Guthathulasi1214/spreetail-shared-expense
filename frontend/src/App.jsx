/**
 * src/App.jsx
 *
 * React Router v6 route tree.
 * All protected routes are wrapped in ProtectedRoute (auth check + loading spinner).
 * Pages imported step-by-step — stubs are inline for routes not yet built.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect }          from 'react';
import { AuthProvider }    from './context/AuthContext';
import ProtectedRoute      from './components/ProtectedRoute';
import Layout              from './components/layout/Layout';

// Keep-alive ping: prevents Render free tier from sleeping (spins down after 15min inactivity)
// Pings backend every 14 minutes silently in the background
const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
function useKeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${BACKEND}/health`).catch(() => {});
    ping(); // ping immediately on first load to wake up if sleeping
    const id = setInterval(ping, 14 * 60 * 1000); // then every 14 minutes
    return () => clearInterval(id);
  }, []);
}

// ── Auth pages (Step 2) ───────────────────────────────────────────────────────
import Login  from './pages/auth/Login';
import Signup from './pages/auth/Signup';

// ── Group pages (Step 3) ──────────────────────────────────────────────────────
import Groups      from './pages/Groups';
import GroupDetail from './pages/GroupDetail';

// ── Expenses page (Step 4) ──────────────────────────────────────────────────────
import Expenses      from './pages/Expenses';
import Balances      from './pages/Balances';
import SettleUp      from './pages/SettleUp';
import ImportCsv     from './pages/ImportCsv';
import Dashboard     from './pages/Dashboard';
import Profile       from './pages/Profile';

// ── Stub for pages not yet built (Steps 4–9) ─────────────────────────────────
function Stub({ label, step }) {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-full py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-4 text-2xl">
          🚧
        </div>
        <p className="text-zinc-400 font-medium">{label}</p>
        <p className="text-zinc-600 text-sm mt-1">Coming in Step {step}</p>
      </div>
    </Layout>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  useKeepAlive(); // Wake up + keep backend alive silently
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<Login />}  />
          <Route path="/signup" element={<Signup />} />

          {/* Groups (Step 3) */}
          <Route path="/groups" element={
            <ProtectedRoute><Groups /></ProtectedRoute>
          } />
          <Route path="/groups/:groupId" element={
            <ProtectedRoute><GroupDetail /></ProtectedRoute>
          } />

          {/* Expenses, Balances, Import — nested under group (Steps 4/5/7) */}
          <Route path="/groups/:groupId/expenses" element={
            <ProtectedRoute><Expenses /></ProtectedRoute>
          } />
          <Route path="/groups/:groupId/balances" element={
            <ProtectedRoute><Balances /></ProtectedRoute>
          } />
          <Route path="/groups/:groupId/settle" element={
            <ProtectedRoute><SettleUp /></ProtectedRoute>
          } />
          <Route path="/groups/:groupId/import" element={
            <ProtectedRoute><ImportCsv /></ProtectedRoute>
          } />

          {/* Dashboard (Step 8) */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          {/* Profile */}
          <Route path="/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />

          {/* Default redirects */}
          <Route path="/"  element={<Navigate to="/groups"    replace />} />
          <Route path="*"  element={<Navigate to="/groups"    replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
