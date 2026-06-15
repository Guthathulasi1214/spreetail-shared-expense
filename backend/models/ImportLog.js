/**
 * models/ImportLog.js
 *
 * One row per CSV upload. Provides an aggregate audit trail of every import:
 * how many rows were parsed, how many made it cleanly, how many were flagged.
 *
 * The UI's import report summary cards (total / imported / skipped / flagged)
 * are populated from this single row — no re-aggregation needed.
 *
 * imported_by: FK to users — who triggered this import (from JWT).
 * original_filename: stored for the audit log display ("imported from expenses.csv")
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImportLog = sequelize.define(
  'ImportLog',
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
    imported_by: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    imported_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    total_rows: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    rows_imported: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    rows_skipped: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    rows_flagged: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    original_filename: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName:  'import_logs',
    timestamps: false,
  }
);

module.exports = ImportLog;
