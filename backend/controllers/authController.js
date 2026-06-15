/**
 * controllers/authController.js
 *
 * Handles: POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me
 *
 * SECURITY NOTES for the live session:
 *
 * 1. "Invalid email or password" is used for BOTH "not found" AND "wrong password".
 *    This prevents user enumeration attacks (attacker can't learn which emails
 *    exist by testing different error messages).
 *
 * 2. We NEVER send password_hash back in any response — the SELECT in `me`
 *    explicitly lists allowed attributes.
 *
 * 3. Sequelize unique constraint violation (email already exists) is caught
 *    explicitly and mapped to a 409 response, not a 500.
 */

const { UniqueConstraintError } = require('sequelize');
const { User } = require('../models');
const {
  hashPassword,
  comparePassword,
  generateToken,
  generateAvatarColor,
} = require('../services/authService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strips fields we never want in API responses
function publicUser(user) {
  return {
    id:           user.id,
    name:         user.name,
    email:        user.email,
    avatar_color: user.avatar_color,
    created_at:   user.created_at,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 * Body: { name, email, password }
 * Returns: { token, user }
 */
async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // Field validation — fail fast with clear messages
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const password_hash = await hashPassword(password);
    const avatar_color  = generateAvatarColor(name.trim());

    const user = await User.create({
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      password_hash,
      avatar_color,
    });

    const token = generateToken(user);

    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    // Sequelize throws UniqueConstraintError when email already exists
    if (err instanceof UniqueConstraintError) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    next(err); // pass unexpected errors to global error handler
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({
      where: { email: email.trim().toLowerCase() },
    });

    // Same error for "not found" and "wrong password" — prevents user enumeration
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Returns: { user }
 *
 * Used by the React app on startup to rehydrate the auth session
 * from a stored token without asking the user to log in again.
 */
async function me(req, res, next) {
  try {
    // req.user is populated by the authenticate middleware
    const user = await User.findByPk(req.user.id, {
      // Explicit attribute list — never return password_hash
      attributes: ['id', 'name', 'email', 'avatar_color', 'created_at'],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, me };
