/**
 * models/ImportAnomaly.js
 *
 * One row per flagged CSV row. This is the approval queue.
 *
 * raw_row_data (JSON): the original CSV row exactly as parsed, before any
 * transformation. Never loses the source data — essential for side-by-side
 * duplicate comparison in the UI and for rollback.
 *
 * anomaly_type: a string constant from ANOMALY_TYPES in constants.js.
 * Using VARCHAR (not ENUM) because the list of types might grow and
 * ALTER TABLE to add ENUM values is a pain in MySQL.
 *
 * requires_approval / approved:
 *   requires_approval=false → auto-resolved, just flagged for visibility
 *   requires_approval=true + approved=null   → in the approval queue
 *   requires_approval=true + approved=true   → user approved → apply action
 *   requires_approval=true + approved=false  → user rejected → exclude row
 *
 * resolved_by: FK to users — who clicked Approve/Reject (audit trail).
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportAnomaly = sequelize.define(
  'ImportAnomaly',
  {
    id: {
      type:          DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    import_log_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // 1-indexed row number from the CSV file (header = row 0, data starts at 1)
    // NOTE: `row_number` is a reserved keyword in MySQL 8.0+ (window function).
    // The `field` property tells Sequelize to quote it as `row_number` in SQL.
    row_number: {
      type:      DataTypes.INTEGER,
      allowNull: false,
      field:     '`row_number`', // escape the reserved keyword in generated SQL
    },
    // The original CSV row as a JSON object. Example:
    // { "date": "Mar-14", "paid_by": "rohan ", "amount": "1,200", ... }
    raw_row_data: {
      type:      DataTypes.JSON,
      allowNull: false,
    },
    // One of the ANOMALY_TYPES constants (e.g. 'DUPLICATE_EXACT')
    anomaly_type: {
      type:      DataTypes.STRING(50),
      allowNull: false,
    },
    // Human-readable description for the approval UI (Meera-friendly language)
    description: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    // What was actually done (if auto-applied) or what WILL be done if approved
    action_taken: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    // true → show in approval queue; false → auto-resolved, logged for visibility
    requires_approval: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    },
    // null = pending, true = approved, false = rejected
    approved: {
      type:      DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    resolved_at: {
      type:      DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // FK to users — who approved/rejected this anomaly
    resolved_by: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName:  'import_anomalies',
    timestamps: false,
  }
);

module.exports = ImportAnomaly;
