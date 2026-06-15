/**
 * routes/auth.js
 *
 * Auth routes — no authentication required except /me.
 *
 * POST /api/auth/signup → create account, return token
 * POST /api/auth/login  → verify credentials, return token
 * GET  /api/auth/me     → return current user (requires valid token)
 */

const router       = require('express').Router();
const authenticate = require('../middleware/auth');
const { signup, login, me } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login',  login);
router.get('/me',      authenticate, me); // protected

module.exports = router;
