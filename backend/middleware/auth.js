/**
 * middleware/auth.js
 *
 * JWT authentication middleware. Attach this to any route that requires
 * a logged-in user:
 *
 *   router.get('/protected', authenticate, controller.handler);
 *
 * On success: populates req.user = { id, name, email } from the token payload.
 * On failure: returns 401 JSON — never calls next() with an error object so
 * the auth failure message is always the same shape as other errors.
 *
 * Token format: "Authorization: Bearer <jwt>"
 * We only support the Bearer scheme (not cookies) to keep the auth flow
 * simple and inspectable in the live session with Postman.
 */

const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // Must be present and start with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required — no token provided' });
  }

  const token = authHeader.split(' ')[1]; // everything after "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach minimal user object — controllers use this to know who is acting
    req.user = {
      id:    decoded.id,
      name:  decoded.name,
      email: decoded.email,
    };

    next();
  } catch (err) {
    // Distinguish expired vs corrupted token for clearer client error messages
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired — please log in again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authenticate;
