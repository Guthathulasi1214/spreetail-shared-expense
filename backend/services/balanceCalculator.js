/**
 * services/balanceCalculator.js
 *
 * Computes individual balances and an optimal repayment plan for a group.
 */

const { sequelize } = require('../models');

async function calculateBalances(groupId) {
  // 1. What each user PAID for expenses
  const [paidResults] = await sequelize.query(`
    SELECT paid_by_user_id as user_id, SUM(amount_in_inr) as total_paid
    FROM expenses
    WHERE group_id = :groupId AND is_active = true
    GROUP BY paid_by_user_id
  `, { replacements: { groupId } });

  // 2. What each user OWES for expenses
  const [owedResults] = await sequelize.query(`
    SELECT es.user_id, SUM(es.share_amount) as total_owed
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = :groupId AND e.is_active = true
    GROUP BY es.user_id
  `, { replacements: { groupId } });

  // 3. Settlements PAID by each user
  const [settlementsPaid] = await sequelize.query(`
    SELECT paid_by_user_id as user_id, SUM(amount) as total_settled_paid
    FROM settlements
    WHERE group_id = :groupId
    GROUP BY paid_by_user_id
  `, { replacements: { groupId } });

  // 4. Settlements RECEIVED by each user
  const [settlementsReceived] = await sequelize.query(`
    SELECT paid_to_user_id as user_id, SUM(amount) as total_settled_received
    FROM settlements
    WHERE group_id = :groupId
    GROUP BY paid_to_user_id
  `, { replacements: { groupId } });

  // 5. Get active members to ensure everyone is included, even with 0 balance
  const [members] = await sequelize.query(`
    SELECT gm.user_id, u.name, u.avatar_color
    FROM group_memberships gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = :groupId
  `, { replacements: { groupId } });

  const balances = {};
  members.forEach(m => {
    balances[m.user_id] = {
      user_id: m.user_id,
      name: m.name,
      avatar_color: m.avatar_color,
      paid: 0,
      owed: 0,
      settlements_paid: 0,
      settlements_received: 0,
      net_balance: 0
    };
  });

  paidResults.forEach(r => { if (balances[r.user_id]) balances[r.user_id].paid = parseFloat(r.total_paid); });
  owedResults.forEach(r => { if (balances[r.user_id]) balances[r.user_id].owed = parseFloat(r.total_owed); });
  settlementsPaid.forEach(r => { if (balances[r.user_id]) balances[r.user_id].settlements_paid = parseFloat(r.total_settled_paid); });
  settlementsReceived.forEach(r => { if (balances[r.user_id]) balances[r.user_id].settlements_received = parseFloat(r.total_settled_received); });

  Object.values(balances).forEach(b => {
    // net_balance = (paid - owed) + (settlements_paid - settlements_received)
    // Positive means they are owed money. Negative means they owe money.
    b.net_balance = parseFloat((b.paid - b.owed + b.settlements_paid - b.settlements_received).toFixed(2));
  });

  console.log('[BALANCE DEBUG] groupId:', groupId, 'paidResults:', JSON.stringify(paidResults), 'owedResults:', JSON.stringify(owedResults));

  return {
    balances: Object.values(balances),
    repayments: calculateRepaymentPlan(Object.values(balances))
  };
}

/**
 * Greedily matches debtors (negative balance) with creditors (positive balance).
 */
function calculateRepaymentPlan(balances) {
  const debtors = balances.filter(b => b.net_balance < -0.01).map(b => ({ ...b, amount: Math.abs(b.net_balance) })).sort((a, b) => b.amount - a.amount);
  const creditors = balances.filter(b => b.net_balance > 0.01).map(b => ({ ...b, amount: b.net_balance })).sort((a, b) => b.amount - a.amount);

  const repayments = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const amount = Math.min(debtor.amount, creditor.amount);
    
    repayments.push({
      from: debtor.user_id,
      from_name: debtor.name,
      to: creditor.user_id,
      to_name: creditor.name,
      amount: parseFloat(amount.toFixed(2))
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) d++;
    if (creditor.amount < 0.01) c++;
  }

  return repayments;
}

module.exports = {
  calculateBalances,
  calculateRepaymentPlan
};
