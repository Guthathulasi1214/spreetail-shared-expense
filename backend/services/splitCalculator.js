/**
 * services/splitCalculator.js
 *
 * Pure split calculation functions — no database, no Express, fully testable.
 * Each function returns an array of expense_split rows ready for DB insert.
 *
 * ─── ROUNDING RULE ───────────────────────────────────────────────────────────
 * When equal division leaves a remainder (₹100 ÷ 3 = 33.333...):
 *   • Every non-payer gets Math.floor(share)   → guaranteed rounded-down
 *   • Payer's share = total - sum(others)       → absorbs any remainder
 *
 * This guarantees: sum(all shareAmounts) === totalAmount EXACTLY.
 * The payer is chosen because they already fronted the full amount, so
 * absorbing ₹0.01 is fair. Consistent with how Splitwise handles this.
 *
 * CONSTANT: CURRENCY_DECIMALS = 2 (in config/constants.js).
 * Changing it to 3 here propagates everywhere automatically.
 *
 * ─── IMPLEMENTATION TECHNIQUE ────────────────────────────────────────────────
 * We convert to integer "cents" before dividing to avoid floating-point
 * arithmetic errors (e.g., 0.1 + 0.2 !== 0.3 in IEEE 754).
 * All division happens on integers; result is converted back at the end.
 */

const { CURRENCY_DECIMALS, FLOAT_EPSILON } = require('../config/constants');

// e.g. CURRENCY_DECIMALS=2 → MULTIPLIER=100 (work in paise/cents)
const MULTIPLIER = Math.pow(10, CURRENCY_DECIMALS);

/** Convert rupee amount → integer cents (avoids float division errors) */
function toCents(amount) {
  return Math.round(parseFloat(amount) * MULTIPLIER);
}

/** Convert cents back to rupees with exactly CURRENCY_DECIMALS decimal places */
function fromCents(cents) {
  return parseFloat((cents / MULTIPLIER).toFixed(CURRENCY_DECIMALS));
}

// ─── 1. Equal Split ───────────────────────────────────────────────────────────

/**
 * calculateEqualSplit
 *
 * Divides the expense equally among all listed members.
 * Payer absorbs any remainder from integer floor division.
 *
 * Example: ₹100 among [Rohan, Priya, Aisha], Aisha pays:
 *   totalCents = 10000
 *   baseCents  = floor(10000/3) = 3333
 *   Rohan      → 3333 cents = ₹33.33
 *   Priya      → 3333 cents = ₹33.33
 *   Aisha      → 10000 - 3333 - 3333 = 3334 cents = ₹33.34  ← absorbs ₹0.01
 *   Sum        → 10000 cents = ₹100.00 ✓
 *
 * @param {number}   amountInInr  Total expense in INR (already converted from USD if needed)
 * @param {number[]} userIds      Array of user IDs in the split (MUST include payer)
 * @param {number}   payerUserId  Who paid — receives the remainder
 * @returns {Array<{userId, shareAmount, sharePercentage, shareUnits}>}
 */
function calculateEqualSplit(amountInInr, userIds, payerUserId) {
  if (!userIds || userIds.length === 0) {
    throw new Error('Cannot calculate equal split: no members provided');
  }

  const totalCents = toCents(amountInInr);
  const n          = userIds.length;
  // ROUNDING: floor each non-payer's base share
  const baseCents  = Math.floor(totalCents / n);

  // Payer gets the remainder so the sum is always exact
  // If totalCents=10000, n=3: baseCents=3333, payerCents=3334
  const nonPayerCount = n - 1;
  const payerCents    = totalCents - (baseCents * nonPayerCount);

  return userIds.map((userId) => ({
    userId,
    shareAmount:     fromCents(userId === payerUserId ? payerCents : baseCents),
    sharePercentage: parseFloat((100 / n).toFixed(4)), // e.g. 33.3333
    shareUnits:      null,
  }));
}

// ─── 2. Unequal Split ─────────────────────────────────────────────────────────

/**
 * calculateUnequalSplit
 *
 * Exact amounts per person, specified by the user.
 * Validates that amounts sum to the total expense (±FLOAT_EPSILON).
 * NEVER guesses missing amounts — throws if sum doesn't match.
 *
 * Example: ₹1500 cake: Rohan ₹700 + Priya ₹400 + Meera ₹400 = ₹1500 ✓
 *
 * @param {number} amountInInr
 * @param {Array<{userId: number, amount: number}>} splits
 */
function calculateUnequalSplit(amountInInr, splits) {
  if (!splits || splits.length === 0) {
    throw new Error('No split details provided for unequal split');
  }

  const totalCents = toCents(amountInInr);
  const sumCents   = splits.reduce((acc, s) => acc + toCents(s.amount), 0);
  const epsilonCts = Math.round(FLOAT_EPSILON * MULTIPLIER); // e.g. 1 cent

  if (Math.abs(sumCents - totalCents) > epsilonCts) {
    // Show the discrepancy clearly — this is what appears in the error message
    // and in the import anomaly description for UNEQUAL_MISMATCH
    const sumAmt   = fromCents(sumCents);
    const totalAmt = fromCents(totalCents);
    throw new Error(
      `Split amounts (₹${sumAmt}) do not match expense total (₹${totalAmt}). ` +
      `Difference: ₹${Math.abs(sumAmt - totalAmt).toFixed(CURRENCY_DECIMALS)}`
    );
  }

  return splits.map((s) => ({
    userId:          s.userId,
    shareAmount:     fromCents(toCents(s.amount)), // normalise to exact 2dp
    sharePercentage: null,
    shareUnits:      null,
  }));
}

// ─── 3. Percentage Split ──────────────────────────────────────────────────────

/**
 * calculatePercentageSplit
 *
 * Percentages per person (must sum ≈ 100, epsilon 0.01%).
 * NEVER auto-rescales — silently changing agreed percentages is a data
 * integrity error (people agreed to 30%, not 27.27%).
 * Payer absorbs remainder from percentage → amount rounding.
 *
 * Example: ₹2200 among three people at 30%, 30%, 40%:
 *   Non-payers: floor(220000 * 30 / 100) = 66000 → ₹660.00 each
 *   Payer:      220000 - 66000 - 66000   = 88000 → ₹880.00
 *   Sum:        660 + 660 + 880 = 2200 ✓
 *
 * @param {number} amountInInr
 * @param {Array<{userId: number, percentage: number}>} splits
 * @param {number} payerUserId
 */
function calculatePercentageSplit(amountInInr, splits, payerUserId) {
  if (!splits || splits.length === 0) {
    throw new Error('No split details provided for percentage split');
  }

  const sumPct = splits.reduce((acc, s) => acc + s.percentage, 0);
  // POLICY: reject percentages that don't sum to 100 — never auto-rescale
  if (Math.abs(sumPct - 100) > FLOAT_EPSILON) {
    throw new Error(
      `Percentages sum to ${sumPct.toFixed(2)}% — must equal 100% ` +
      `(tolerance ±${FLOAT_EPSILON}%). Got: [${splits.map(s => s.percentage).join(', ')}]`
    );
  }

  if (!splits.find((s) => s.userId === payerUserId)) {
    throw new Error('Payer must be included in the split details');
  }

  const totalCents = toCents(amountInInr);
  const nonPayers  = splits.filter((s) => s.userId !== payerUserId);
  const payer      = splits.find((s) => s.userId === payerUserId);

  // Compute non-payer shares (floor → payer absorbs remainder)
  const nonPayerResults = nonPayers.map((s) => ({
    userId:          s.userId,
    shareAmount:     fromCents(Math.floor((totalCents * s.percentage) / 100)),
    sharePercentage: s.percentage,
    shareUnits:      null,
  }));

  const nonPayerCents = nonPayerResults.reduce(
    (acc, r) => acc + toCents(r.shareAmount), 0
  );

  return [
    ...nonPayerResults,
    {
      userId:          payerUserId,
      shareAmount:     fromCents(totalCents - nonPayerCents), // ROUNDING: absorbs remainder
      sharePercentage: payer.percentage,
      shareUnits:      null,
    },
  ];
}

// ─── 4. Share/Unit Split ──────────────────────────────────────────────────────

/**
 * calculateShareSplit
 *
 * Relative unit weights per person (e.g., 1;2;1;2 → person B and D get twice as much).
 * Each person's share = (theirUnits / totalUnits) * totalAmount.
 * Payer absorbs remainder from rounding.
 *
 * Example: ₹600 scooter rental, 4 people [Aisha:1, Rohan:2, Priya:1, Dev:2]
 *   totalUnits = 6
 *   Aisha: floor(60000 * 1/6) = 10000 → ₹100.00
 *   Rohan: floor(60000 * 2/6) = 20000 → ₹200.00
 *   Priya: floor(60000 * 1/6) = 10000 → ₹100.00
 *   Dev:   60000 - 10000 - 20000 - 10000 = 20000 → ₹200.00 (payer, absorbs 0)
 *   Sum: 100+200+100+200 = 600 ✓
 *
 * @param {number} amountInInr
 * @param {Array<{userId: number, units: number}>} splits
 * @param {number} payerUserId
 */
function calculateShareSplit(amountInInr, splits, payerUserId) {
  if (!splits || splits.length === 0) {
    throw new Error('No split details provided for share split');
  }

  const totalUnits = splits.reduce((acc, s) => acc + s.units, 0);
  if (totalUnits <= 0) {
    throw new Error('Total share units must be greater than zero');
  }

  if (!splits.find((s) => s.userId === payerUserId)) {
    throw new Error('Payer must be included in the split details');
  }

  const totalCents = toCents(amountInInr);
  const nonPayers  = splits.filter((s) => s.userId !== payerUserId);
  const payer      = splits.find((s) => s.userId === payerUserId);

  const nonPayerResults = nonPayers.map((s) => ({
    userId:          s.userId,
    shareAmount:     fromCents(Math.floor((totalCents * s.units) / totalUnits)),
    sharePercentage: parseFloat(((s.units / totalUnits) * 100).toFixed(4)),
    shareUnits:      s.units,
  }));

  const nonPayerCents = nonPayerResults.reduce(
    (acc, r) => acc + toCents(r.shareAmount), 0
  );

  return [
    ...nonPayerResults,
    {
      userId:          payerUserId,
      shareAmount:     fromCents(totalCents - nonPayerCents),
      sharePercentage: parseFloat(((payer.units / totalUnits) * 100).toFixed(4)),
      shareUnits:      payer.units,
    },
  ];
}

module.exports = {
  calculateEqualSplit,
  calculateUnequalSplit,
  calculatePercentageSplit,
  calculateShareSplit,
};
