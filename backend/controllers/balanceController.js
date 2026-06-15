/**
 * controllers/balanceController.js
 *
 * Handles balance queries using the balanceCalculator service.
 */

const balanceCalculator = require('../services/balanceCalculator');
const { GroupMembership } = require('../models');

exports.getBalances = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // Auth check
    const membership = await GroupMembership.findOne({
      where: { group_id: groupId, user_id: req.user.id, left_at: null }
    });
    
    if (!membership) {
      throw Object.assign(new Error('You must be an active member of this group.'), { status: 403 });
    }

    const data = await balanceCalculator.calculateBalances(groupId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
