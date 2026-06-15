/**
 * src/pages/auth/Login.jsx
 *
 * Split-screen layout:
 *  - Left (60%): dark zinc-950 background, centered form card
 *  - Right (40%): Unsplash image with gradient overlay + tagline
 *  - Mobile: form full-width, image panel hidden
 *
 * Features:
 *  - Email + password with icon prefixes
 *  - Password show/hide toggle
 *  - Loading spinner on submit
 *  - Error alert with icon
 *  - Link to signup
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle,
  TrendingUp, ArrowRight, Loader2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// Royalty-free Unsplash image — friends sharing a meal, warm tones
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1400&q=80';

export default function Login() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPw]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Something went wrong. Please try again.'
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
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-zinc-400 text-sm">
              Sign in to manage your shared expenses
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="alert-error mb-6 animate-slide-down">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-sm font-medium text-zinc-300">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="login-email"
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

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-with-icon-left pr-11"
                />
                {/* Show/hide toggle — important UX, reduces mis-type frustration */}
                <button
                  type="button"
                  onClick={() => setShowPw(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye    className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="text-brand-400 hover:text-brand-300 font-semibold transition"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Hero image panel (desktop only) ───────────────────── */}
      <div className="hidden lg:block relative w-[45%] flex-shrink-0 overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="Friends sharing a meal together"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        {/* Gradient overlay — keeps the tagline legible over any photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/80 via-zinc-900/60 to-zinc-950/90" />

        {/* Floating stat chips — gives a preview of the product */}
        <div className="absolute top-10 right-8 flex flex-col gap-3 animate-fade-in">
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success-500" />
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">You are owed</p>
              <p className="text-sm font-bold text-success-500">₹3,240</p>
            </div>
          </div>
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <span className="text-brand-400 font-bold text-xs">4</span>
            </div>
            <div>
              <p className="text-[11px] text-zinc-400">Active groups</p>
              <p className="text-sm font-bold text-white">Goa Trip, Flat 4B…</p>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-12 left-10 right-10">
          <blockquote className="text-white text-2xl font-semibold leading-snug">
            "Split fairly, settle easily — keep the friendships, lose the awkwardness."
          </blockquote>
          <p className="mt-4 text-zinc-400 text-sm">
            Track every rupee across groups, currencies, and friends.
          </p>
        </div>
      </div>
    </div>
  );
}
