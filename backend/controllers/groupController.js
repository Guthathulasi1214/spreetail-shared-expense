/**
 * controllers/groupController.js
 *
 * Handles all CRUD for groups and group membership management.
 *
 * Authorization pattern: every route first checks the requester
 * is an active member (left_at IS NULL) before returning data.
 * This prevents a user who left a group from seeing its expenses.
 *
 * Membership lifecycle:
 *   Create group  → creator auto-added with joined_at = today
 *   Add member    → find user by email, insert GroupMembership row
 *   Remove member → set left_at = date (soft removal, preserves history)
 *   Re-join       → new row with new joined_at (UNIQUE KEY allows this)
 */

const { Op }  = require('sequelize');
const { Group, User, GroupMembership } = require('../models');

// ─── Internal helper ─────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD string (for joined_at defaults). */
function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Checks if `userId` is an active member of `groupId`.
 * "Active" = left_at IS NULL.
 * Used as a guard in every handler that needs group access.
 */
async function getActiveMembership(groupId, userId) {
  return GroupMembership.findOne({
    where: { group_id: groupId, user_id: userId, left_at: null },
  });
}

/** Shapes a GroupMembership+User row into the API response format. */
function formatMembership(m) {
  return {
    id:        m.id,
    user:      { id: m.User.id, name: m.User.name, email: m.User.email, avatar_color: m.User.avatar_color },
    joined_at: m.joined_at,
    left_at:   m.left_at,
    is_active: m.left_at === null,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/groups
 * Returns all groups the authenticated user is currently an active member of,
 * each with a preview of up to 4 member avatars and the total active count.
 */
async function getGroups(req, res, next) {
  try {
    // Find all active memberships for this user, include the Group + its Creator
    const myMemberships = await GroupMembership.findAll({
      where: { user_id: req.user.id, left_at: null },
      include: [{
        model: Group,
        include: [{ model: User, as: 'Creator', attributes: ['id', 'name', 'avatar_color'] }],
      }],
      order: [[Group, 'created_at', 'DESC']],
    });

    // For each group: fetch active member count + avatar preview
    // N+1 is acceptable here — group lists are small in this app
    const groups = await Promise.all(
      myMemberships.map(async ({ Group: group }) => {
        const activeMembers = await GroupMembership.findAll({
          where: { group_id: group.id, left_at: null },
          include: [{ model: User, attributes: ['id', 'name', 'avatar_color'] }],
          order: [['joined_at', 'ASC']],
          limit: 4, // only need preview avatars
        });
        const totalCount = await GroupMembership.count({
          where: { group_id: group.id, left_at: null },
        });
        return {
          ...group.toJSON(),
          member_count:    totalCount,
          members_preview: activeMembers.map(m => ({
            id:           m.User.id,
            name:         m.User.name,
            avatar_color: m.User.avatar_color,
          })),
        };
      })
    );

    return res.json({ groups });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/groups
 * Body: { name, description? }
 * Creates a new group and immediately adds the creator as an active member.
 */
async function createGroup(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await Group.create({
      name:        name.trim(),
      description: description?.trim() || null,
      created_by:  req.user.id,
    });

    // Auto-add creator as the first member
    await GroupMembership.create({
      group_id:  group.id,
      user_id:   req.user.id,
      joined_at: today(),
    });

    return res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/groups/:id
 * Returns group details + full membership history (active + past members).
 * Only accessible to current active members.
 */
async function getGroup(req, res, next) {
  try {
    const groupId = parseInt(req.params.id, 10);

    // Guard: must be an active member to view
    const myMembership = await getActiveMembership(groupId, req.user.id);
    if (!myMembership) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    const group = await Group.findByPk(groupId, {
      include: [{ model: User, as: 'Creator', attributes: ['id', 'name', 'avatar_color'] }],
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // All memberships (including past) — used for the timeline view
    const memberships = await GroupMembership.findAll({
      where:   { group_id: groupId },
      include: [{ model: User, attributes: ['id', 'name', 'email', 'avatar_color'] }],
      order:   [['joined_at', 'ASC']],
    });

    return res.json({
      group: {
        ...group.toJSON(),
        memberships: memberships.map(formatMembership),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/groups/:id
 * Body: { name?, description? }
 * Only the group creator can rename/re-describe the group.
 */
async function updateGroup(req, res, next) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const group   = await Group.findByPk(groupId);

    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the group creator can edit group details' });
    }

    const { name, description } = req.body;
    await group.update({
      name:        name?.trim()        || group.name,
      description: description !== undefined
        ? (description?.trim() || null)
        : group.description,
    });

    return res.json({ group });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/groups/:id
 * Hard delete — cascades to memberships, expenses, splits, settlements.
 * Only the creator can delete. This is intentionally destructive.
 */
async function deleteGroup(req, res, next) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const group   = await Group.findByPk(groupId);

    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only the group creator can delete this group' });
    }

    await group.destroy(); // CASCADE handles child rows
    return res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/groups/:id/members
 * Query param: ?date=YYYY-MM-DD
 *   With date → only members active ON that specific date
 *   Without   → all members (active + past)
 */
async function getMembers(req, res, next) {
  try {
    const groupId = parseInt(req.params.id, 10);

    const myMembership = await getActiveMembership(groupId, req.user.id);
    if (!myMembership) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    let where = { group_id: groupId };

    if (req.query.date) {
      const d = req.query.date; // YYYY-MM-DD
      // Active on date D = joined BEFORE D and (left AFTER D or never left)
      where = {
        ...where,
        joined_at: { [Op.lte]: d },
        [Op.or]:   [{ left_at: null }, { left_at: { [Op.gt]: d } }],
      };
    }

    const memberships = await GroupMembership.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'email', 'avatar_color'] }],
      order:   [['joined_at', 'ASC']],
    });

    return res.json({ members: memberships.map(formatMembership) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/groups/:id/members
 * Body: { email, joined_at? }
 * Adds an existing user (by email) to the group.
 * Returns 404 if no account with that email exists — user must sign up first.
 */
async function addMember(req, res, next) {
  try {
    const groupId          = parseInt(req.params.id, 10);
    const { email, joined_at } = req.body;

    if (!email) return res.status(400).json({ error: 'Email address is required' });

    const myMembership = await getActiveMembership(groupId, req.user.id);
    if (!myMembership) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      return res.status(404).json({
        error: `No account found with email "${email}". Ask them to sign up first.`,
      });
    }

    // Prevent adding someone who's already an active member
    const existing = await getActiveMembership(groupId, user.id);
    if (existing) {
      return res.status(409).json({ error: `${user.name} is already an active member` });
    }

    const m = await GroupMembership.create({
      group_id:  groupId,
      user_id:   user.id,
      joined_at: joined_at || today(),
    });

    return res.status(201).json({ membership: formatMembership({ ...m.toJSON(), User: user }) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/groups/:id/members/:userId
 * Body: { left_at } — sets the leave date for a member.
 * Pass left_at = null to mark them active again (re-activate).
 *
 * This endpoint modifies the most recent membership row for the user
 * (handles re-join scenarios where they might have multiple rows).
 */
async function updateMember(req, res, next) {
  try {
    const groupId = parseInt(req.params.id, 10);
    const userId  = parseInt(req.params.userId, 10);

    const myMembership = await getActiveMembership(groupId, req.user.id);
    if (!myMembership) {
      return res.status(403).json({ error: 'You are not an active member of this group' });
    }

    // Get the most recent membership row for this user
    const target = await GroupMembership.findOne({
      where: { group_id: groupId, user_id: userId },
      order: [['joined_at', 'DESC']],
    });
    if (!target) return res.status(404).json({ error: 'Membership record not found' });

    await target.update({ left_at: req.body.left_at || null });
    return res.json({ membership: target });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGroups, createGroup, getGroup, updateGroup, deleteGroup,
  getMembers, addMember, updateMember,
};
