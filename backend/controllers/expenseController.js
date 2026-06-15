/**
 * controllers/expenseController.js
 *
 * Handles CRUD for expenses. Uses splitCalculator.js for computing split shares.
 * All operations are wrapped in Sequelize transactions to ensure atomic writes
 * to both `expenses` and `expense_splits`.
 */

const { Expense, ExpenseSplit, User, GroupMembership, sequelize } = require('../models');
const splitCalculator = require('../services/splitCalculator');
const { EXCHANGE_RATE_USD_TO_INR } = require('../config/constants');

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

exports.getExpenses = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    await requireMembership(groupId, req.user.id);

    const expenses = await Expense.findAll({
      where: { group_id: groupId, is_active: true },
      order: [['expense_date', 'DESC'], ['created_at', 'DESC']],
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'avatar_color'] },
        { 
          model: ExpenseSplit, 
          as: 'Splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'avatar_color'] }]
        }
      ]
    });

    res.json({ expenses });
  } catch (err) {
    next(err);
  }
};

exports.createExpense = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { groupId } = req.params;
    await requireMembership(groupId, req.user.id);

    let {
      description,
      amount,
      currency = 'INR',
      paid_by_user_id,
      split_type = 'equal',
      expense_date,
      notes,
      split_details // structure depends on split_type
    } = req.body;

    if (!description || !amount || !paid_by_user_id || !expense_date) {
      throw Object.assign(new Error('Missing required fields.'), { status: 400 });
    }

    // Determine exchange rate and base INR amount
    const rate = currency.toUpperCase() === 'USD' ? EXCHANGE_RATE_USD_TO_INR : 1.0;
    const amountInInr = parseFloat((parseFloat(amount) * rate).toFixed(2));

    // Calculate splits using pure functions
    let splitsData = [];
    if (split_type === 'equal') {
      splitsData = splitCalculator.calculateEqualSplit(amountInInr, split_details.userIds, paid_by_user_id);
    } else if (split_type === 'unequal') {
      splitsData = splitCalculator.calculateUnequalSplit(amountInInr, split_details.splits);
    } else if (split_type === 'percentage') {
      splitsData = splitCalculator.calculatePercentageSplit(amountInInr, split_details.splits, paid_by_user_id);
    } else if (split_type === 'share') {
      splitsData = splitCalculator.calculateShareSplit(amountInInr, split_details.splits, paid_by_user_id);
    } else {
      throw Object.assign(new Error(`Invalid split type: ${split_type}`), { status: 400 });
    }

    // Verify all users in the split are active members on the expense date
    // Note: for production, we might want to check the specific active date ranges
    // For now, ensure they exist in the group
    const userIdsInSplit = splitsData.map(s => s.userId);
    const members = await GroupMembership.findAll({
      where: { group_id: groupId, user_id: userIdsInSplit },
      transaction: t
    });
    
    if (members.length !== userIdsInSplit.length) {
      throw Object.assign(new Error('One or more users in the split are not members of the group.'), { status: 400 });
    }

    // Insert Expense
    const expense = await Expense.create({
      group_id: groupId,
      description,
      amount,
      currency: currency.toUpperCase(),
      exchange_rate_to_inr: rate,
      amount_in_inr: amountInInr,
      paid_by_user_id,
      split_type,
      expense_date,
      notes,
      is_active: true
    }, { transaction: t });

    // Insert Splits
    const splitsToInsert = splitsData.map(s => ({
      expense_id: expense.id,
      user_id: s.userId,
      share_amount: s.shareAmount,
      share_percentage: s.sharePercentage,
      share_units: s.shareUnits
    }));

    await ExpenseSplit.bulkCreate(splitsToInsert, { transaction: t });
    await t.commit();

    // Fetch complete expense to return
    const createdExpense = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'avatar_color'] },
        { 
          model: ExpenseSplit, 
          as: 'Splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'avatar_color'] }]
        }
      ]
    });

    res.status(201).json({ expense: createdExpense });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const { groupId, id } = req.params;
    await requireMembership(groupId, req.user.id);

    const expense = await Expense.findOne({ where: { id, group_id: groupId, is_active: true } });
    if (!expense) {
      throw Object.assign(new Error('Expense not found'), { status: 404 });
    }

    // Soft delete
    expense.is_active = false;
    await expense.save();

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    next(err);
  }
};
