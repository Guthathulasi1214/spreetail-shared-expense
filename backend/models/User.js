/**
 * models/User.js
 *
 * Core identity table. One row per person in the system.
 *
 * password_hash: bcrypt-hashed, never the plaintext password.
 * avatar_color:  deterministic hex color for the initials avatar
 *               (set by auth controller based on name hash).
 *               Stored so it's consistent across sessions/devices.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type:          DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    name: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      unique:    true,
      validate:  { isEmail: true },
    },
    password_hash: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    // Hex color string for the initials avatar (e.g. "#6366f1").
    // Generated deterministically from the user's name so every device
    // renders the same color without storing an image.
    avatar_color: {
      type:         DataTypes.STRING(7),
      defaultValue: '#6366f1',
    },
    created_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:  'users',
    timestamps: false, // we manage created_at manually above
  }
);

module.exports = User;
