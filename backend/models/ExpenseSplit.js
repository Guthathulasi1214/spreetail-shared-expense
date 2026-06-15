/**
 * models/ExpenseSplit.js
 *
 * One row per (expense, user) pair — the atomic unit of the balance system.
 *
 * WHY A SEPARATE TABLE (not JSON in expenses)?
 * The entire balance calculation reduces to two SQL aggregates:
 *
 *   -- What each user PAID:
 *   SELECT paid_by_user_id, SUM(amount_in_inr) FROM expenses
 *   WHERE group_id = ? AND is_active = true GROUP BY paid_by_user_id
 *
 *   -- What each user OWES (their share of every expense):
 *   SELECT es.user_id, SUM(es.share_amount) FROM expense_splits es
 *   JOIN expenses e ON e.id = es.expense_id
 *   WHERE e.group_id = ? AND e.is_active = true GROUP BY es.user_id
 *
 *   net_balance = paid - owed + settlements_received - settlements_paid
 *
 * With a JSON column, these queries become application-level loops.
 * With this table, they're single SQL GROUP BY statements — correct,
 * fast, and easy to explain in a live session.
 *
 * COLUMNS:
 *   share_amount:     ALWAYS populated — the INR amount this user owes
 *                     for this expense. This is what balance math uses.
 *   share_percentage: populated for PERCENTAGE splits (e.g., 30.0000)
 *                     Stored to reconstruct "what did we agree to?"
 *   share_units:      populated for SHARE splits (e.g., 2.0000)
 *                     Stored for the same traceability reason.
 *
 * Storing all three columns (not just share_amount) lets you show users:
 * "You had a 30% share = ₹660" rather than just "You owe ₹660."
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExpenseSplit = sequelize.define(
  'ExpenseSplit',
  {
    id: {
      type:          DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    expense_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    user_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // The computed INR amount this user owes for this expense.
    // All balance queries sum this column.
    share_amount: {
      type:      DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    // Populated for PERCENTAGE split type (e.g., 33.3333).
    // NULL for equal/unequal/share splits.
    share_percentage: {
      type:      DataTypes.DECIMAL(7, 4),
      allowNull: true,
      defaultValue: null,
    },
    // Populated for SHARE split type (e.g., 2.0000 meaning "2 units").
    // NULL for equal/unequal/percentage splits.
    share_units: {
      type:      DataTypes.DECIMAL(10, 4),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName:  'expense_splits',
    timestamps: false,
    indexes: [
      {
        // One split row per user per expense — prevents double-counting
        unique: true,
        fields: ['expense_id', 'user_id'],
      },
    ],
  }
);

module.exports = ExpenseSplit;
