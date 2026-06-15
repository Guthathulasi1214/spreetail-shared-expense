/**
 * server.js — Express application entry point
 *
 * Startup sequence:
 *  1. Load .env (must be first — everything reads from process.env)
 *  2. Import models (registers them with Sequelize, wires associations)
 *  3. Configure Express middleware (CORS, JSON parsing)
 *  4. Mount API routes (stubs for now, filled in per step)
 *  5. Authenticate DB connection + sync models
 *  6. Start listening
 *
 * sequelize.sync() behavior:
 *   - Creates tables that don't exist yet
 *   - Does NOT drop or alter existing tables (safe for development)
 *   - For a clean reset, run the SQL migration manually and restart
 */

require('dotenv').config(); // Step 1: .env must load before any process.env access

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const sequelize = require('./config/database');
require('./models'); // Step 2: register all models + associations

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS: allow all origins temporarily for deployment (TODO: restrict to deployed frontend URL later)
app.use(cors({
  origin: '*',
  credentials: true, // needed if we ever add cookie-based auth
}));

app.use(express.json());                     // parse application/json bodies
app.use(express.urlencoded({ extended: true })); // parse form-encoded bodies

// Static file serving for Multer uploads (accessible for CSV download/review)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
// Each route file will be mounted here as steps are completed.
// Keeping them as separate require() calls makes it obvious what each module owns.

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/groups',      require('./routes/expenses'));    // /api/groups/:groupId/expenses
app.use('/api/groups',      require('./routes/balances'));    // /api/groups/:groupId/balances
app.use('/api/groups',      require('./routes/settlements')); // /api/groups/:groupId/settlements
app.use('/api/groups',      require('./routes/imports'));     // /api/groups/:groupId/import

// Health check — always available, useful for "is the server up?" during demo
// NOTE: Must be defined BEFORE the 404 catch-all below
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 + Error Handlers ────────────────────────────────────────────────────

// Catch-all 404 for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — catches any next(err) calls in controllers
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    // Only include stack trace in development — never expose in production
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 5000;

async function start() {
  try {
    // Verify the DB is reachable before starting the HTTP server
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Create any missing tables. Won't alter existing ones.
    // If you need a full reset: drop the DB, recreate it, then restart.
    await sequelize.sync();
    console.log('✅ Models synchronized with database.');

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
