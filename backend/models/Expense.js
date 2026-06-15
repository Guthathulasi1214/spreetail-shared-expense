/**
 * models/Expense.js
 *
 * One row per group expense. Stores both the original currency amount
 * AND the INR equivalent — all balance math uses amount_in_inr so the
 * system stays single-currency for calculations while supporting USD input.
 *
 * CURRENCY DESIGN:
 * - amount:               original value (4dp to avoid float loss on conversion)
 * - currency:             'INR' or 'USD' (see SUPPORTED_CURRENCIES in constants)
 * - exchange_rate_to_inr: rate used AT TIME OF IMPORT (immutable for audit trail)
 * - amount_in_inr:        computed: round(amount * exchange_rate_to_inr, 2)
 *
 * Storing the rate per-row means historical records stay accurate even if
 * EXCHANGE_RATE_USD_TO_INR is changed in .env later.
 *
 * is_active = false → soft-deleted (e.g. deduplicated CSV rows).
 * The balance calculator always adds WHERE is_active = true.
 * Soft deletion preserves the audit trail and enables review/restore.
 *
 * split_type ENUM values:
 *   'equal'      — divided evenly among split_with members
 *   'unequal'    — exact amount per person specified in split_details
 *   'percentage' — % per person (must sum ≈ 100)
 *   'share'      — proportional units (e.g. 1;2;1 → 1/4, 2/4, 1/4)
 *   'settlement' — NOTE: settlements go to the `settlements` table, NOT here.
 *                  This enum value exists for CSV import detection only.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define(
  'Expense',
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
    description: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    // Original amount in original currency (4 decimal places to avoid
    // float precision loss before the INR conversion multiply)
    amount: {
      type:      DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    // ISO 4217 currency code. Only 'INR' and 'USD' are supported.
    currency: {
      type:         DataTypes.CHAR(3),
      allowNull:    false,
      defaultValue: 'INR',
    },
    // The exchange rate used when this expense was imported/created.
    // Stored immutably so historical records are auditable.
    exchange_rate_to_inr: {
      type:         DataTypes.DECIMAL(10, 6),
      allowNull:    false,
      defaultValue: 1.000000,
    },
    // The INR value used in ALL balance calculations.
    // = round(amount * exchange_rate_to_inr, 2)
    amount_in_inr: {
      type:      DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    paid_by_user_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    split_type: {
      type:      DataTypes.ENUM('equal', 'unequal', 'percentage', 'share', 'settlement'),
      allowNull: false,
    },
    expense_date: {
      type:      DataTypes.DATEONLY,
      allowNull: false,
    },
    notes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    // false = soft-deleted (e.g. marked as duplicate during CSV import).
    // Always filter WHERE is_active = true in balance queries.
    is_active: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
    },
    created_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:  'expenses',
    timestamps: false,
  }
);

module.exports = Expense;
