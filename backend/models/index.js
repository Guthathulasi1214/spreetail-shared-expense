/**
 * models/index.js
 *
 * Loads all Sequelize models and wires up every association.
 * Import this file ONCE in server.js — models register themselves
 * with the shared `sequelize` instance and associations take effect.
 *
 * ASSOCIATION PATTERN:
 * Every FK relationship is declared twice (belongsTo + hasMany/hasOne)
 * so Sequelize can traverse the relationship in either direction:
 *   - expense.getPaidBy()         ← belongsTo
 *   - user.getPaidExpenses()      ← hasMany
 *
 * Aliases (as: '...') are required wherever a model has MULTIPLE
 * FKs pointing to the same target (e.g. Settlement → User twice:
 * once as PaidBy, once as PaidTo).
 */

const sequelize    = require('../config/database');
const User         = require('./User');
const Group        = require('./Group');
const GroupMembership = require('./GroupMembership');
const Expense      = require('./Expense');
const ExpenseSplit = require('./ExpenseSplit');
const Settlement   = require('./Settlement');
const ImportLog    = require('./ImportLog');
const ImportAnomaly = require('./ImportAnomaly');

// ─── Group ↔ User (creator) ──────────────────────────────────────────────────
Group.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
User.hasMany(Group,   { foreignKey: 'created_by', as: 'CreatedGroups' });

// ─── GroupMembership ─────────────────────────────────────────────────────────
GroupMembership.belongsTo(Group, { foreignKey: 'group_id' });
GroupMembership.belongsTo(User,  { foreignKey: 'user_id' });
Group.hasMany(GroupMembership, { foreignKey: 'group_id' });
User.hasMany(GroupMembership,  { foreignKey: 'user_id' });

// ─── Expense ─────────────────────────────────────────────────────────────────
Expense.belongsTo(Group, { foreignKey: 'group_id' });
Expense.belongsTo(User,  { foreignKey: 'paid_by_user_id', as: 'Payer' });
Group.hasMany(Expense, { foreignKey: 'group_id' });
// 'PaidExpenses' alias avoids collision with the default User→Expense hasMany
User.hasMany(Expense,  { foreignKey: 'paid_by_user_id', as: 'PaidExpenses' });

// ─── ExpenseSplit ─────────────────────────────────────────────────────────────
ExpenseSplit.belongsTo(Expense, { foreignKey: 'expense_id' });
ExpenseSplit.belongsTo(User,    { foreignKey: 'user_id' });
Expense.hasMany(ExpenseSplit, { foreignKey: 'expense_id', as: 'Splits' });
User.hasMany(ExpenseSplit,    { foreignKey: 'user_id', as: 'ExpenseSplits' });

// ─── Settlement ───────────────────────────────────────────────────────────────
// Two FK columns pointing to users — MUST use aliases to distinguish them
Settlement.belongsTo(Group, { foreignKey: 'group_id' });
Settlement.belongsTo(User,  { foreignKey: 'paid_by_user_id', as: 'Payer' });
Settlement.belongsTo(User,  { foreignKey: 'paid_to_user_id', as: 'Payee' });
Settlement.belongsTo(Expense, {
  foreignKey: 'related_expense_id',
  as: 'RelatedExpense',
  constraints: false, // nullable FK — don't enforce if null
});

Group.hasMany(Settlement, { foreignKey: 'group_id' });
User.hasMany(Settlement,  { foreignKey: 'paid_by_user_id', as: 'SentSettlements' });
User.hasMany(Settlement,  { foreignKey: 'paid_to_user_id', as: 'ReceivedSettlements' });

// ─── ImportLog ────────────────────────────────────────────────────────────────
ImportLog.belongsTo(Group, { foreignKey: 'group_id' });
ImportLog.belongsTo(User,  { foreignKey: 'imported_by', as: 'ImportedBy' });
Group.hasMany(ImportLog, { foreignKey: 'group_id' });
User.hasMany(ImportLog,  { foreignKey: 'imported_by', as: 'ImportedLogs' });

// ─── ImportAnomaly ────────────────────────────────────────────────────────────
ImportAnomaly.belongsTo(ImportLog, { foreignKey: 'import_log_id' });
ImportAnomaly.belongsTo(User, {
  foreignKey: 'resolved_by',
  as: 'ResolvedBy',
  constraints: false, // nullable FK
});
ImportLog.hasMany(ImportAnomaly, { foreignKey: 'import_log_id', as: 'Anomalies' });

// Export all models so controllers can do:
//   const { User, Expense } = require('../models');
module.exports = {
  sequelize,
  User,
  Group,
  GroupMembership,
  Expense,
  ExpenseSplit,
  Settlement,
  ImportLog,
  ImportAnomaly,
};
