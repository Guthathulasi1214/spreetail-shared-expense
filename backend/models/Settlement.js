/**
 * models/Settlement.js
 *
 * A direct person-to-person payment within a group context.
 * Example: "Rohan paid Aisha ₹5000 to settle his debt."
 *
 * WHY SEPARATE FROM expenses?
 * Settlements have no split_with, no split_type, and no expense_splits.
 * Mixing them into the expenses table would require:
 *   - Nullable split_type
 *   - Special-casing split_type='settlement' throughout the split calculator
 *   - Skipping expense_splits creation for 'settlement' rows
 *
 * Keeping them separate means the balance formula is clean:
 *   net(user) = Σ paid_expenses - Σ owed_splits
 *             + Σ settlements_received - Σ settlements_sent
 *
 * related_expense_id: optional FK used when a CSV row was "mislabeled
 * as an expense but is actually a settlement" (anomaly types #7 and #19).
 * Links the settlement back to the original import row for audit trail.
 *
 * Currency note: settlements are always stored in INR (amount column).
 * The settle-up UI pre-fills amounts already converted to INR.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settlement = sequelize.define(
  'Settlement',
  {
    id: {
      type:          DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    group_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // The person making the payment
    paid_by_user_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // The person receiving the payment
    paid_to_user_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    amount: {
      type:      DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    currency: {
      type:         DataTypes.CHAR(3),
      allowNull:    false,
      defaultValue: 'INR',
    },
    settled_date: {
      type:      DataTypes.DATEONLY,
      allowNull: false,
    },
    notes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    // Set when this settlement was auto-created from a CSV row that
    // was detected as a person-to-person transaction (anomaly #7/#19)
    related_expense_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    },
    created_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:  'settlements',
    timestamps: false,
  }
);

module.exports = Settlement;
