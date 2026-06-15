/**
 * config/database.js
 *
 * Sequelize connection factory. Reads from .env — never hardcoded credentials.
 *
 * pool: kept deliberately small (max 10) to avoid overwhelming a local MySQL
 * instance during development. Increase in production.
 *
 * logging: SQL queries logged only in development — off in production to
 * avoid leaking sensitive data to logs.
 *
 * define.timestamps: false — we define created_at explicitly in each model
 * so column names match the SQL schema exactly (no Sequelize magic renaming).
 */

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,      // e.g. "splitwise_db"
  process.env.DB_USER,      // e.g. "root"
  process.env.DB_PASSWORD,  // from .env
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: 'mysql',

    // Log SQL only in dev — helps debug balance queries during live session
    logging: process.env.NODE_ENV === 'development' ? console.log : false,

    pool: {
      max:     10,
      min:     0,
      acquire: 30000, // ms before "connection not available" error
      idle:    10000, // ms a connection can sit idle before release
    },

    define: {
      // We manage timestamps ourselves (created_at only, no updated_at).
      // This prevents Sequelize from adding unexpected columns.
      timestamps: false,

      // Column names stay snake_case in JS — no auto-camelCase conversion.
      // This keeps model field names identical to SQL column names,
      // which makes the live session much easier to follow.
      underscored: false,
    },
  }
);

module.exports = sequelize;
