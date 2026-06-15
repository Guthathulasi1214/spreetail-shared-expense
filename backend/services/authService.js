/**
 * services/authService.js
 *
 * Pure utility functions for auth — no Express req/res, fully testable.
 *
 * SALT_ROUNDS = 12: bcrypt cost factor. 12 rounds ≈ 300ms on a modern CPU —
 * slow enough to defeat brute-force but fast enough for a demo/prod server.
 * (10 rounds = 100ms, 14 rounds = 1.2s — 12 is the standard sweet spot.)
 *
 * AVATAR_COLORS: deterministic hex palette. generateAvatarColor() always
 * returns the same color for the same name, making avatars consistent
 * across devices without storing or uploading any image.
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const SALT_ROUNDS = 12;

// Ten distinct brand-compatible colors for initials avatars.
// Chosen for readability on both dark and light backgrounds.
const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ef4444', // red
  '#3b82f6', // blue
];

/**
 * Picks a color from AVATAR_COLORS deterministically based on the user's name.
 * Uses a simple djb2-style hash — same name always yields same color.
 * This means Rohan's avatar is always violet, Aisha's always indigo, etc.
 *
 * @param {string} name
 * @returns {string} hex color, e.g. "#6366f1"
 */
function generateAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // force 32-bit signed integer
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Hashes a plaintext password with bcrypt.
 * @param {string} plaintext
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Signs a JWT for the given user.
 * Payload: { id, name, email } — minimal, no sensitive data.
 * Expiry comes from JWT_EXPIRES_IN env var (default "7d").
 *
 * @param {{ id: number, name: string, email: string }} user
 * @returns {string} signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { hashPassword, comparePassword, generateToken, generateAvatarColor };
