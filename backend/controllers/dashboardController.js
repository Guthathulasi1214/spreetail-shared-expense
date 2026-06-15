/**
 * controllers/dashboardController.js
 *
 * Provides global statistics and recent activity for the user's dashboard.
 */

const { sequelize, Expense, Settlement, Group, User, ExpenseSplit } = require('../models');

exports.getDashboardData = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Calculate global balances
    // Paid for expenses
    const [[{ totalPaid }]] = await sequelize.query(`
      SELECT COALESCE(SUM(amount_in_inr), 0) as totalPaid
      FROM expenses
      WHERE paid_by_user_id = :userId AND is_active = true
    `, { replacements: { userId } });

    // Owed for expenses
    const [[{ totalOwed }]] = await sequelize.query(`
      SELECT COALESCE(SUM(es.share_amount), 0) as totalOwed
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE es.user_id = :userId AND e.is_active = true
    `, { replacements: { userId } });

    // Settlements Paid (I gave money)
    const [[{ settlementsPaid }]] = await sequelize.query(`
      SELECT COALESCE(SUM(amount), 0) as settlementsPaid
      FROM settlements
      WHERE paid_by_user_id = :userId
    `, { replacements: { userId } });

    // Settlements Received (I got money)
    const [[{ settlementsReceived }]] = await sequelize.query(`
      SELECT COALESCE(SUM(amount), 0) as settlementsReceived
      FROM settlements
      WHERE paid_to_user_id = :userId
    `, { replacements: { userId } });

    const netBalance = parseFloat(totalPaid) - parseFloat(totalOwed) + parseFloat(settlementsPaid) - parseFloat(settlementsReceived);

    // 2. Fetch Recent Activity (combining expenses and settlements)
    // We will fetch the 10 most recent expenses in the user's active groups
    const recentExpenses = await Expense.findAll({
      where: { is_active: true },
      include: [
        {
          model: Group,
          required: true,
          include: [{
            model: sequelize.models.GroupMembership, // checking if user is in group
            where: { user_id: userId, left_at: null }
          }]
        },
        { model: User, as: 'Payer', attributes: ['name', 'avatar_color'] },
        { model: ExpenseSplit, as: 'Splits', where: { user_id: userId }, required: false }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    const recentSettlements = await Settlement.findAll({
      include: [
        {
          model: Group,
          required: true,
          include: [{
            model: sequelize.models.GroupMembership,
            where: { user_id: userId, left_at: null }
          }]
        },
        { model: User, as: 'Payer', attributes: ['name', 'avatar_color'] },
        { model: User, as: 'Payee', attributes: ['name', 'avatar_color'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // Format activity
    let activity = [];
    
    recentExpenses.forEach(e => {
      activity.push({
        type: 'expense',
        id: `e-${e.id}`,
        groupId: e.group_id,
        groupName: e.Group.name,
        description: e.description,
        amount: parseFloat(e.amount_in_inr),
        actor: e.Payer.name,
        actorColor: e.Payer.avatar_color,
        date: e.created_at,
        myShare: e.Splits.length > 0 ? parseFloat(e.Splits[0].share_amount) : 0
      });
    });

    recentSettlements.forEach(s => {
      activity.push({
        type: 'settlement',
        id: `s-${s.id}`,
        groupId: s.group_id,
        groupName: s.Group.name,
        description: `Settlement`,
        amount: parseFloat(s.amount),
        actor: s.Payer.name,
        actorColor: s.Payer.avatar_color,
        target: s.Payee.name,
        targetColor: s.Payee.avatar_color,
        date: s.created_at
      });
    });

    // Sort combined and take top 10
    activity.sort((a, b) => new Date(b.date) - new Date(a.date));
    activity = activity.slice(0, 10);

    res.json({
      stats: {
        totalPaid: parseFloat(totalPaid),
        totalOwed: parseFloat(totalOwed),
        netBalance: netBalance
      },
      activity
    });
  } catch (err) {
    next(err);
  }
};
