/**
 * src/pages/auth/Signup.jsx
 *
 * Same split-screen layout as Login.
 * Extra fields: name + confirm password.
 * Client-side validation before hitting the API:
 *   - All fields required
 *   - Password ≥ 8 characters
 *   - Passwords match
 *
 * The backend also validates — client-side is for UX speed,
 * not security (never trust client-only validation).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Mail, Lock, Eye, EyeOff,
  AlertCircle, TrendingUp, ArrowRight, Loader2, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1400&q=80';

// Password strength helper — gives live feedback as user types
function getPasswordStrength(pw) {
  if (!pw) return null;
  if (pw.length < 8) return { label: 'Too short', color: 'text-danger-500', width: 'w-1/4' };
  if (pw.length < 12) return { label: 'Fair',      color: 'text-warning-500', width: 'w-2/4' };
  if (pw.match(/[A-Z]/) && pw.match(/[0-9]/)) {
    return { label: 'Strong', color: 'text-success-500', width: 'w-full' };
  }
  return { label: 'Good', color: 'text-brand-400', width: 'w-3/4' };
}

export default function Signup() {
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPassword, setShowPw]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const { signup } = useAuth();
  const navigate   = useNavigate();
  const strength   = getPasswordStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (password !== confirmPw) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Signup failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-zinc-950">

      {/* ── Left: Form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md animate-fade-in">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-brand-glow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Split<span className="text-brand-400">Ease</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-zinc-400 text-sm">
              Start splitting expenses with your group in minutes
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="alert-error mb-6 animate-slide-down">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="signup-name" className="block text-sm font-medium text-zinc-300">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aisha Sharma"
                  className="input-with-icon-left"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="block text-sm font-medium text-zinc-300">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-with-icon-left"
                />
              </div>
            </div>

            {/* Password + strength meter */}
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input-with-icon-left pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Live password strength indicator */}
              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.width} ${
                        strength.label === 'Too short' ? 'bg-danger-500' :
                        strength.label === 'Fair'      ? 'bg-warning-500' :
                        strength.label === 'Good'      ? 'bg-brand-500' : 'bg-success-500'
                      }`}
                    />
                  </div>
                  <p className={`text-xs ${strength.color}`}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-zinc-300">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  className="input-with-icon-left pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="Toggle confirm password visibility"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Match indicator */}
              {confirmPw && password && (
                <p className={`text-xs flex items-center gap-1 ${
                  confirmPw === password ? 'text-success-500' : 'text-danger-500'
                }`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {confirmPw === password ? 'Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="signup-submit"
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-brand-400 hover:text-brand-300 font-semibold transition"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Hero image panel (desktop only) ───────────────────── */}
      <div className="hidden lg:block relative w-[45%] flex-shrink-0 overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="People cooking together in a shared kitchen"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/80 via-zinc-900/60 to-zinc-950/90" />

        {/* Feature highlights */}
        <div className="absolute top-1/2 -translate-y-1/2 left-10 right-10 space-y-4">
          {[
            { icon: '🧮', title: 'Smart splitting', desc: 'Equal, percentage, share units — any split you need' },
            { icon: '🌍', title: 'Multi-currency', desc: 'USD expenses auto-converted to INR at a fixed rate' },
            { icon: '📊', title: 'Full traceability', desc: 'Every balance number drills down to the exact expense' },
            { icon: '📥', title: 'CSV import', desc: 'Import 40 rows with 20 anomaly types detected automatically' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
