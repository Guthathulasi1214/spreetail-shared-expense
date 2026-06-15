const { sequelize, User, GroupMembership, Expense, ExpenseSplit, Settlement, ImportLog, ImportAnomaly } = require('../models');

async function fixDatabase() {
  const t = await sequelize.transaction();
  try {
    console.log('Starting migration...');
    const groupId = 1;
    
    // 1. Clear all expenses and import logs for Group 1 to start fresh
    console.log(`Clearing expenses, settlements, and import logs for Group ${groupId}...`);
    
    // Deleting in correct order to respect foreign key constraints
    await ExpenseSplit.destroy({ 
      where: {}, 
      include: [{ model: Expense, where: { group_id: groupId } }],
      transaction: t 
    });
    
    await Settlement.destroy({ where: { group_id: groupId }, transaction: t });
    await ImportAnomaly.destroy({ 
      where: {}, 
      include: [{ model: ImportLog, where: { group_id: groupId } }],
      transaction: t 
    });
    await ImportLog.destroy({ where: { group_id: groupId }, transaction: t });
    await Expense.destroy({ where: { group_id: groupId }, transaction: t });

    console.log('Successfully cleared all existing group data.');

    // 2. Find Priya and Priya S and delete Priya S
    const priya = await User.findOne({ where: { name: 'Priya' } });
    const priyaS = await User.findOne({ where: { name: 'Priya S' } });

    if (priya && priyaS) {
      console.log(`Found Priya (ID: ${priya.id}) and Priya S (ID: ${priyaS.id}). Deleting Priya S...`);
      // Delete Priya S membership and user
      await GroupMembership.destroy({ where: { user_id: priyaS.id }, transaction: t });
      await User.destroy({ where: { id: priyaS.id }, transaction: t });
      console.log('Successfully deleted Priya S.');
    } else {
      console.log('Priya S not found, skipping merge.');
    }

    await t.commit();
    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

fixDatabase();
