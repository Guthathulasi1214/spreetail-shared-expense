/**
 * models/GroupMembership.js
 *
 * Date-range membership record. Answers: "Was user X a member of group G
 * on date D?" with a single SQL WHERE clause:
 *
 *   WHERE user_id = X
 *     AND group_id = G
 *     AND joined_at <= D
 *     AND (left_at IS NULL OR left_at > D)
 *
 * WHY DATE RANGES (not a boolean is_member)?
 * A boolean only tells you current state. Date ranges let the balance
 * calculator be date-aware: Meera leaving on 28-03-2026 means her
 * balance is unaffected by April expenses. Sam joining on 15-04-2026
 * means March expenses don't touch him.
 *
 * left_at = NULL means "currently active member."
 * left_at = some date means "left on that date."
 *
 * UNIQUE KEY on (group_id, user_id, joined_at) allows re-joining:
 * a user can leave and rejoin a group, creating two membership rows
 * with different date ranges.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GroupMembership = sequelize.define(
  'GroupMembership',
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
    user_id: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // The date this person joined (or was added to) the group.
    // For CSV import: if a user is first seen in a March expense,
    // their joined_at is set to the earliest expense date they appear in.
    joined_at: {
      type:      DataTypes.DATEONLY, // DATE column, no time component
      allowNull: false,
    },
    // NULL = still active. Set to a date when the person leaves.
    // The balance query uses: left_at IS NULL OR left_at > expense_date
    left_at: {
      type:      DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName:  'group_memberships',
    timestamps: false,
    indexes: [
      {
        // Allows re-joining: same user can have multiple membership rows
        // if they left and rejoined (different joined_at values)
        unique: true,
        fields: ['group_id', 'user_id', 'joined_at'],
      },
    ],
  }
);

module.exports = GroupMembership;
