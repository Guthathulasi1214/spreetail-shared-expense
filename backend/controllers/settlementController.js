/**
 * controllers/settlementController.js
 *
 * Handles CRUD for settlements (person-to-person payments).
 */

const { Settlement, User, GroupMembership } = require('../models');

// Helper to check if user is in group
async function requireMembership(groupId, userId) {
  const membership = await GroupMembership.findOne({
    where: { group_id: groupId, user_id: userId, left_at: null }
  });
  if (!membership) {
    const err = new Error('You must be an active member of this group.');
    err.status = 403;
    throw err;
  }
  return membership;
}

exports.getSettlements = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    await requireMembership(groupId, req.user.id);

    const settlements = await Settlement.findAll({
      where: { group_id: groupId },
      order: [['settled_date', 'DESC'], ['created_at', 'DESC']],
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'avatar_color'] },
        { model: User, as: 'Payee', attributes: ['id', 'name', 'avatar_color'] }
      ]
    });

    res.json({ settlements });
  } catch (err) {
    next(err);
  }
};

exports.createSettlement = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    await requireMembership(groupId, req.user.id);

    const {
      paid_by_user_id,
      paid_to_user_id,
      amount,
      currency = 'INR',
      settled_date,
      notes
    } = req.body;

    if (!paid_by_user_id || !paid_to_user_id || !amount || !settled_date) {
      throw Object.assign(new Error('Missing required fields.'), { status: 400 });
    }

    if (paid_by_user_id === paid_to_user_id) {
      throw Object.assign(new Error('Cannot settle with yourself.'), { status: 400 });
    }

    // Verify both users are members
    const members = await GroupMembership.findAll({
      where: { group_id: groupId, user_id: [paid_by_user_id, paid_to_user_id] }
    });
    
    if (members.length !== 2) {
      throw Object.assign(new Error('Both users must be members of the group.'), { status: 400 });
    }

    const settlement = await Settlement.create({
      group_id: groupId,
      paid_by_user_id,
      paid_to_user_id,
      amount,
      currency: currency.toUpperCase(),
      settled_date,
      notes
    });

    const createdSettlement = await Settlement.findByPk(settlement.id, {
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'avatar_color'] },
        { model: User, as: 'Payee', attributes: ['id', 'name', 'avatar_color'] }
      ]
    });

    res.status(201).json({ settlement: createdSettlement });
  } catch (err) {
    next(err);
  }
};
