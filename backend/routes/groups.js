/**
 * routes/groups.js
 *
 * All group routes require authentication (applied via router.use).
 *
 * Route structure:
 *   /api/groups                        → list / create groups
 *   /api/groups/:id                    → get / update / delete one group
 *   /api/groups/:id/members            → list / add members
 *   /api/groups/:id/members/:userId    → update member (set left_at)
 *
 * NOTE: The expense, balance, settlement, and import routes are mounted
 * on the same /api/groups prefix in server.js — they live in their own
 * route files to keep each module self-contained.
 */

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/groupController');

// All group routes require a valid JWT
router.use(authenticate);

// ── Group CRUD ────────────────────────────────────────────────────────────────
router.get('/',    ctrl.getGroups);    // GET  /api/groups
router.post('/',   ctrl.createGroup);  // POST /api/groups

router.get('/:id',    ctrl.getGroup);     // GET    /api/groups/:id
router.put('/:id',    ctrl.updateGroup);  // PUT    /api/groups/:id
router.delete('/:id', ctrl.deleteGroup); // DELETE /api/groups/:id

// ── Membership management ─────────────────────────────────────────────────────
router.get('/:id/members',             ctrl.getMembers);   // GET  /api/groups/:id/members(?date=)
router.post('/:id/members',            ctrl.addMember);    // POST /api/groups/:id/members
router.patch('/:id/members/:userId',   ctrl.updateMember); // PATCH /api/groups/:id/members/:userId

module.exports = router;
