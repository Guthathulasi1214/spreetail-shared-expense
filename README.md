# SplitEase - Shared Expenses App

A shared expenses tracker built for the Spreetail software developer assignment. Supports groups with changing membership over time, multiple split types, USD/INR currency handling, and a guided CSV import that detects and lets users resolve data anomalies.

## Tech Stack

- **Backend:** Node.js, Express.js, Sequelize (ORM), MySQL
- **Frontend:** React (Vite), React Router, Axios, Tailwind CSS
- **Auth:** JWT (signup/login, bcrypt password hashing)
- **CSV Import:** Multer (file upload) + CSV parsing with custom anomaly detection

## AI Tools Used

I used **Google Antigravity (Gemini 3.1 Pro)** as my coding assistant for implementation, and **Claude (Anthropic)** for planning the architecture, writing detailed specifications, and independently verifying the app's output (balance calculations, anomaly handling) against values I computed myself. Full details, including specific mistakes I caught and corrected, are in `AI_USAGE.md`.

## Project Structure

```
/backend
  /config       - DB connection, constants (CURRENCY_DECIMALS, exchange rate)
  /models       - Sequelize models
  /controllers
  /routes
  /services     - split calculation, balance calculation, CSV import, anomaly detection
  /middleware   - auth (JWT)
  /migrations   - SQL schema (001_initial_schema.sql)
  server.js
/frontend
  /src/pages
  /src/components
  /src/api
```

## Setup Instructions (Local Development)

### Prerequisites
- Node.js (v18+)
- MySQL Server (8.0) + MySQL Workbench (optional, for inspecting data)

### 1. Database Setup

Create the database and tables by running the migration script:

```bash
mysql -u root -p < backend/migrations/001_initial_schema.sql
```

Or open `backend/migrations/001_initial_schema.sql` in MySQL Workbench and execute it.

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `/backend` (see `.env.example`):

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=splitwise_db
DB_USER=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_jwt_secret_here
EXCHANGE_RATE_USD_TO_INR=83
PORT=5000
```

Start the backend:

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in `/frontend` (see `.env.example`):

```
VITE_API_BASE_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

For the deployed version, visit:
https://spreetail-shared-expense.vercel.app

### 4. Importing the CSV

1. Sign up / log in.
2. Create a group and add members.
3. Go to the group's **Import CSV** tab and upload `expenses_export.csv`.
4. Review the **Approval Queue** - this lists every detected data anomaly (see `SCOPE.md` for the full anomaly list and how each is handled), with options to approve or reject the suggested action.
5. Once resolved, view **Balances** for each member's net position, and click into any balance to see the underlying expenses that make it up.

## Key Design Decisions

See `DECISIONS.md` for the reasoning behind the database schema, the rounding rule, currency handling, settlement detection, and how membership date ranges work. See `SCOPE.md` for the full database schema and the anomaly-by-anomaly handling policy for `expenses_export.csv`.

## Deployment

- **Frontend:** https://spreetail-shared-expense.vercel.app
- **Backend:** https://spreetail-shared-expense.onrender.com
- **Database:** Managed MySQL database hosted on Render
