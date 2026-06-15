const { sequelize } = require('./models');

async function debugBalances() {
  const groupId = 1; // Assuming Goa trip is group 1. We can fetch it if needed.

  try {
    console.log("===========================================================");
    console.log("STEP 1: VERIFY THE SUM-TO-ZERO INVARIANT");
    console.log("===========================================================");

    const [balances] = await sequelize.query(`
      WITH UserPaid AS (
        SELECT paid_by_user_id as user_id, SUM(amount_in_inr) as total_paid
        FROM expenses
        WHERE group_id = :groupId AND is_active = true
        GROUP BY paid_by_user_id
      ),
      UserOwed AS (
        SELECT es.user_id, SUM(es.share_amount) as total_owed
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        WHERE e.group_id = :groupId AND e.is_active = true
        GROUP BY es.user_id
      ),
      SettlementsPaid AS (
        SELECT paid_by_user_id as user_id, SUM(amount) as settlements_paid
        FROM settlements
        WHERE group_id = :groupId
        GROUP BY paid_by_user_id
      ),
      SettlementsReceived AS (
        SELECT paid_to_user_id as user_id, SUM(amount) as settlements_received
        FROM settlements
        WHERE group_id = :groupId
        GROUP BY paid_to_user_id
      ),
      AllUsers AS (
        SELECT user_id FROM UserPaid
        UNION SELECT user_id FROM UserOwed
        UNION SELECT user_id FROM SettlementsPaid
        UNION SELECT user_id FROM SettlementsReceived
      )
      SELECT 
        u.id, 
        u.name,
        COALESCE(up.total_paid, 0) as paid_expenses,
        COALESCE(uo.total_owed, 0) as owed_expenses,
        COALESCE(sp.settlements_paid, 0) as settlements_paid,
        COALESCE(sr.settlements_received, 0) as settlements_received,
        (COALESCE(up.total_paid, 0) - COALESCE(uo.total_owed, 0) + COALESCE(sp.settlements_paid, 0) - COALESCE(sr.settlements_received, 0)) as net_balance
      FROM AllUsers au
      JOIN users u ON u.id = au.user_id
      LEFT JOIN UserPaid up ON up.user_id = au.user_id
      LEFT JOIN UserOwed uo ON uo.user_id = au.user_id
      LEFT JOIN SettlementsPaid sp ON sp.user_id = au.user_id
      LEFT JOIN SettlementsReceived sr ON sr.user_id = au.user_id;
    `, { replacements: { groupId } });

    console.table(balances);

    let sum = 0;
    balances.forEach(b => sum += parseFloat(b.net_balance));
    console.log("SUM OF ALL BALANCES: ", sum);

    console.log("\n===========================================================");
    console.log("STEP 2: TRACE AISHA SPECIFICALLY");
    console.log("===========================================================");
    
    // Find Aisha's user ID
    const [aisha] = await sequelize.query("SELECT id FROM users WHERE name LIKE '%Aisha%'");
    if (!aisha || aisha.length === 0) {
      console.log("Aisha not found!");
      return;
    }
    const aishaId = aisha[0].id;
    
    // Trace her expenses (paid)
    const [paidByAisha] = await sequelize.query(`
      SELECT id, description, expense_date, amount_in_inr, 'PAID_BY_HER' as role
      FROM expenses
      WHERE group_id = :groupId AND paid_by_user_id = :aishaId AND is_active = true
      ORDER BY expense_date ASC
    `, { replacements: { groupId, aishaId } });

    // Trace her splits (owed)
    const [owedByAisha] = await sequelize.query(`
      SELECT e.id, e.description, e.expense_date, es.share_amount, 'HER_SHARE' as role
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = :groupId AND es.user_id = :aishaId AND e.is_active = true
      ORDER BY e.expense_date ASC
    `, { replacements: { groupId, aishaId } });

    // Trace her settlements
    const [settlementsAisha] = await sequelize.query(`
      SELECT id, notes, settled_date as date, amount, 'SETTLEMENT_PAID_BY_HER' as role
      FROM settlements
      WHERE group_id = :groupId AND paid_by_user_id = :aishaId
      UNION ALL
      SELECT id, notes, settled_date as date, amount, 'SETTLEMENT_RECEIVED_BY_HER' as role
      FROM settlements
      WHERE group_id = :groupId AND paid_to_user_id = :aishaId
    `, { replacements: { groupId, aishaId } });

    console.log("--- EXPENSES PAID BY AISHA ---");
    console.table(paidByAisha);

    console.log("--- EXPENSE SHARES (OWED BY AISHA) ---");
    console.table(owedByAisha);

    console.log("--- SETTLEMENTS INVOLVING AISHA ---");
    console.table(settlementsAisha);

    console.log("\nChecking for duplicates in expenses...");
    const [dupes] = await sequelize.query(`
      SELECT description, expense_date, paid_by_user_id, COUNT(*) as count
      FROM expenses
      GROUP BY description, expense_date, paid_by_user_id
      HAVING count > 1
    `);
    console.table(dupes);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

debugBalances();
