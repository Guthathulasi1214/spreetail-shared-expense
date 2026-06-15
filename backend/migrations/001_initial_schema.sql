-- ============================================================
-- migrations/001_initial_schema.sql
--
-- Run this ONCE against a fresh MySQL server to bootstrap the database.
-- This is the canonical schema definition — Sequelize models mirror it.
--
-- Usage:
--   mysql -u root -p < backend/migrations/001_initial_schema.sql
--
-- Or paste into MySQL Workbench / DBeaver.
-- ============================================================

-- Create database if it doesn't exist.
-- CHARACTER SET utf8mb4: supports full Unicode (emojis, Indian scripts, etc.)
CREATE DATABASE IF NOT EXISTS splitwise_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE splitwise_db;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color  VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS `groups` (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  created_by  INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_groups_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- GROUP MEMBERSHIPS
-- Date-range model: joined_at + left_at (NULL = still active).
-- UNIQUE KEY on (group_id, user_id, joined_at) supports re-joining:
-- a user can leave and rejoin, producing two rows with different joined_at.
-- ============================================================
CREATE TABLE IF NOT EXISTS group_memberships (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id  INT UNSIGNED NOT NULL,
  user_id   INT UNSIGNED NOT NULL,
  joined_at DATE         NOT NULL,
  left_at   DATE         NULL DEFAULT NULL,
  UNIQUE KEY uq_membership (group_id, user_id, joined_at),
  CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_user  FOREIGN KEY (user_id)  REFERENCES users(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- EXPENSES
-- amount stored as DECIMAL(12,4): 4dp prevents float precision loss
-- during USD→INR multiplication before rounding to 2dp.
-- exchange_rate_to_inr stored PER ROW: historical rates are immutable.
-- is_active=FALSE → soft-deleted (preserves duplicates for review).
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id                   INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  group_id             INT UNSIGNED    NOT NULL,
  description          VARCHAR(255)    NOT NULL,
  amount               DECIMAL(12, 4)  NOT NULL,
  currency             CHAR(3)         NOT NULL DEFAULT 'INR',
  exchange_rate_to_inr DECIMAL(10, 6)  NOT NULL DEFAULT 1.000000,
  amount_in_inr        DECIMAL(12, 2)  NOT NULL,
  paid_by_user_id      INT UNSIGNED    NOT NULL,
  split_type           ENUM('equal','unequal','percentage','share','settlement') NOT NULL,
  expense_date         DATE            NOT NULL,
  notes                TEXT,
  is_active            BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exp_group   FOREIGN KEY (group_id)        REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_paid_by FOREIGN KEY (paid_by_user_id) REFERENCES users(id)    ON DELETE RESTRICT,
  -- Index on group_id + expense_date: the balance calculator's main filter
  INDEX idx_expenses_group_date (group_id, expense_date),
  -- Index on is_active: balance queries always filter WHERE is_active = TRUE
  INDEX idx_expenses_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- EXPENSE SPLITS
-- One row per (expense, user) pair.
-- share_amount: ALWAYS set — the INR value used in balance calculations.
-- share_percentage / share_units: set only for those split types,
--   stored for traceability ("you had a 30% share = ₹660").
-- UNIQUE KEY on (expense_id, user_id): prevents double-counting.
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_splits (
  id               INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  expense_id       INT UNSIGNED   NOT NULL,
  user_id          INT UNSIGNED   NOT NULL,
  share_amount     DECIMAL(12, 2) NOT NULL,
  share_percentage DECIMAL(7, 4)  NULL DEFAULT NULL,
  share_units      DECIMAL(10, 4) NULL DEFAULT NULL,
  UNIQUE KEY uq_split (expense_id, user_id),
  CONSTRAINT fk_split_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_split_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE RESTRICT,
  -- Index on user_id: the balance "what does user X owe?" query
  INDEX idx_splits_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SETTLEMENTS
-- Direct person-to-person payments, separate from expenses.
-- related_expense_id: links back to a CSV row that was converted
--   to a settlement (anomaly #7/#19). ON DELETE SET NULL preserves
--   the settlement even if the source expense row is deleted.
-- ============================================================
CREATE TABLE IF NOT EXISTS settlements (
  id                  INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  group_id            INT UNSIGNED   NOT NULL,
  paid_by_user_id     INT UNSIGNED   NOT NULL,
  paid_to_user_id     INT UNSIGNED   NOT NULL,
  amount              DECIMAL(12, 2) NOT NULL,
  currency            CHAR(3)        NOT NULL DEFAULT 'INR',
  settled_date        DATE           NOT NULL,
  notes               TEXT,
  related_expense_id  INT UNSIGNED   NULL DEFAULT NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sett_group    FOREIGN KEY (group_id)           REFERENCES `groups`(id)  ON DELETE CASCADE,
  CONSTRAINT fk_sett_paid_by  FOREIGN KEY (paid_by_user_id)    REFERENCES users(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_sett_paid_to  FOREIGN KEY (paid_to_user_id)    REFERENCES users(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_sett_rel_exp  FOREIGN KEY (related_expense_id) REFERENCES expenses(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- IMPORT LOGS
-- One row per CSV upload. Aggregates for the report summary cards.
-- ============================================================
CREATE TABLE IF NOT EXISTS import_logs (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id          INT UNSIGNED NOT NULL,
  imported_by       INT UNSIGNED NOT NULL,
  imported_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_rows        INT          NOT NULL,
  rows_imported     INT          NOT NULL DEFAULT 0,
  rows_skipped      INT          NOT NULL DEFAULT 0,
  rows_flagged      INT          NOT NULL DEFAULT 0,
  original_filename VARCHAR(255),
  CONSTRAINT fk_log_group FOREIGN KEY (group_id)    REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_user  FOREIGN KEY (imported_by) REFERENCES users(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- IMPORT ANOMALIES
-- One row per flagged CSV row. This table IS the approval queue.
-- raw_row_data JSON: original CSV data, never modified.
-- anomaly_type VARCHAR (not ENUM): easier to extend without ALTER TABLE.
-- approved: NULL=pending, TRUE=approved, FALSE=rejected.
-- ============================================================
CREATE TABLE IF NOT EXISTS import_anomalies (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  import_log_id     INT UNSIGNED NOT NULL,
  `row_number`      INT          NOT NULL,
  raw_row_data      JSON         NOT NULL,
  anomaly_type      VARCHAR(50)  NOT NULL,
  description       TEXT         NOT NULL,
  action_taken      TEXT,
  requires_approval BOOLEAN      NOT NULL DEFAULT FALSE,
  approved          BOOLEAN      NULL DEFAULT NULL,
  resolved_at       TIMESTAMP    NULL DEFAULT NULL,
  resolved_by       INT UNSIGNED NULL DEFAULT NULL,
  CONSTRAINT fk_anom_log      FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE,
  CONSTRAINT fk_anom_resolver FOREIGN KEY (resolved_by)   REFERENCES users(id)       ON DELETE SET NULL,
  -- Index for the approval queue query: WHERE requires_approval=TRUE AND approved IS NULL
  INDEX idx_anomalies_queue (requires_approval, approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
