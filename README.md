# Shared Expenses App

A full-stack Splitwise-style expense splitting application built with Node.js, Express, MySQL, Sequelize, React, and Tailwind CSS.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express.js (MVC) |
| Database | MySQL + Sequelize ORM |
| Frontend | React + Vite + Tailwind CSS |
| Auth | JWT + bcryptjs |
| File Upload | Multer |
| CSV Parsing | csv-parser |

---

## Project Structure

```
splitwise-app/
├── backend/          Express API + Sequelize models
├── frontend/         React + Vite app
├── README.md         This file
├── SCOPE.md          All 20 CSV anomaly policies + full schema explanation
├── DECISIONS.md      Design decision log with tradeoffs
└── AI_USAGE.md       AI assistance log
```

---

## Backend Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+ running locally

### 1. Create the database

```bash
mysql -u root -p < backend/migrations/001_initial_schema.sql
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env: set DB_PASSWORD, JWT_SECRET
```

Key `.env` variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `splitwise_db` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | *(required)* |
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `PORT` | API server port | `5000` |
| `CLIENT_URL` | Frontend origin for CORS | `http://localhost:5173` |
| `EXCHANGE_RATE_USD_TO_INR` | USD→INR rate | `83` |

### 3. Install + run

```bash
cd backend
npm install
npm run dev        # Starts with nodemon (auto-restarts on file change)
# OR
npm start          # Production start
```

The API will be available at `http://localhost:5000`.  
Health check: `GET http://localhost:5000/api/health`

---

## Frontend Setup

### 1. Install + run

```bash
cd frontend
npm install
npm run dev        # Vite dev server at http://localhost:5173
```

### 2. Environment (if needed)

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api
```

---

## API Overview

| Module | Base Path |
|--------|-----------|
| Auth | `/api/auth` |
| Groups | `/api/groups` |
| Expenses | `/api/groups/:groupId/expenses` |
| Balances | `/api/groups/:groupId/balances` |
| Settlements | `/api/groups/:groupId/settlements` |
| CSV Import | `/api/groups/:groupId/import` |

Full endpoint documentation: see `SCOPE.md`.

---

## Currency Scope

- **Display currency**: INR (all balances shown in INR)
- **Input currencies**: INR and USD
- **Conversion**: `amount_in_inr = amount × EXCHANGE_RATE_USD_TO_INR`
- Rate is a fixed config value (see `DECISIONS.md` for rationale)
- This is **not** a general multi-currency system — adding other currencies would require a currency conversion service and live rate API

---

## Running Both Together

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Reset Database

To start completely fresh:

```sql
DROP DATABASE splitwise_db;
```

Then re-run the migration: `mysql -u root -p < backend/migrations/001_initial_schema.sql`

And restart the backend.
