/**
 * models/Group.js
 *
 * A "group" is a shared expense pool — e.g., "Goa Trip 2026" or "Flat 4B".
 *
 * created_by: soft reference to the user who created the group.
 * ON DELETE RESTRICT ensures we can't accidentally delete a user who
 * created groups — they'd need to be transferred first.
 *
 * The group persists even if the creator leaves (is removed from
 * group_memberships). created_by is just audit history.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Group = sequelize.define(
  'Group',
  {
    id: {
      type:          DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    name: {
      type:      DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    // FK to users.id — who created this group (for display only)
    created_by: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    created_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:  'groups',
    timestamps: false,
  }
);

module.exports = Group;
