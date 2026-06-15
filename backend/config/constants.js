/**
 * config/constants.js
 *
 * Single source of truth for all numeric constants used across
 * split calculation, currency conversion, and validation.
 *
 * LIVE SESSION NOTE: To change the rounding precision, update
 * CURRENCY_DECIMALS here — every split calculator reads this.
 * To update the exchange rate, change EXCHANGE_RATE_USD_TO_INR in .env.
 */

// Number of decimal places for all money amounts.
// Set to 2 for standard currency display (e.g., ₹33.33).
// Rounding rule: "round half away from zero" (Math standard round).
// The payer absorbs any leftover penny — see splitCalculator.js.
const CURRENCY_DECIMALS = 2;

// USD → INR exchange rate.
// Scope decision: this is a fixed config constant, NOT a live API rate.
// Rationale: live rates would introduce non-determinism — the same CSV
// imported twice on different days would produce different INR amounts.
// A fixed rate makes imports reproducible and auditable.
// See DECISIONS.md for the full tradeoff analysis.
const EXCHANGE_RATE_USD_TO_INR =
  parseFloat(process.env.EXCHANGE_RATE_USD_TO_INR) || 83;

// Supported input currencies (besides INR which is the base).
// Adding a new currency requires: adding it here + handling in csvImporter.js.
const SUPPORTED_CURRENCIES = ['INR', 'USD'];

// Epsilon for floating-point equality checks.
// Used when comparing percentage sums to 100 (avoid 99.9999... != 100 errors).
const FLOAT_EPSILON = 0.01;

// Anomaly type string constants — used in import_anomalies.anomaly_type column.
// Centralised here so both anomalyDetector.js and the frontend can import them.
const ANOMALY_TYPES = {
  NUMERIC_FORMAT:        'NUMERIC_FORMAT',        // "1,200" → 1200
  EXCESS_PRECISION:      'EXCESS_PRECISION',       // 899.995 → 900.00
  NAME_NORMALIZED:       'NAME_NORMALIZED',        // "priya" → "Priya"
  NAME_UNRESOLVED:       'NAME_UNRESOLVED',        // no match found
  DUPLICATE_EXACT:       'DUPLICATE_EXACT',        // same date/payer/amount
  DUPLICATE_FUZZY:       'DUPLICATE_FUZZY',        // similar but different amount/payer
  UNEQUAL_MISMATCH:      'UNEQUAL_MISMATCH',       // split_details don't sum to total
  MISSING_PAID_BY:       'MISSING_PAID_BY',        // payer field empty
  CONVERTED_SETTLEMENT:  'CONVERTED_SETTLEMENT',   // moved to settlements table
  PERCENTAGE_OVER_100:   'PERCENTAGE_OVER_100',    // % sum != 100
  FOREIGN_CURRENCY:      'FOREIGN_CURRENCY',       // USD → INR conversion
  NON_MEMBER_IN_SPLIT:   'NON_MEMBER_IN_SPLIT',    // unknown person in split_with
  REFUND:                'REFUND',                 // negative amount
  DATE_UNPARSEABLE:      'DATE_UNPARSEABLE',       // bad date format, inferred
  MISSING_CURRENCY:      'MISSING_CURRENCY',       // defaulted to INR
  ZERO_AMOUNT:           'ZERO_AMOUNT',            // amount = 0
  STALE_MEMBERSHIP:      'STALE_MEMBERSHIP',       // member not active on expense date
  AMBIGUOUS_DATE:        'AMBIGUOUS_DATE',         // DD-MM vs MM-DD unclear
  SPLIT_TYPE_MISMATCH:   'SPLIT_TYPE_MISMATCH',    // split_type conflicts with details
  GUEST_MEMBER_CREATED:  'GUEST_MEMBER_CREATED',   // auto-created guest user
  SHARE_SPLIT_MISSING:   'SHARE_SPLIT_MISSING',    // member in split_with lacks unit
  UNKNOWN:               'UNKNOWN',                // catch-all
};

module.exports = {
  CURRENCY_DECIMALS,
  EXCHANGE_RATE_USD_TO_INR,
  SUPPORTED_CURRENCIES,
  FLOAT_EPSILON,
  ANOMALY_TYPES,
};
