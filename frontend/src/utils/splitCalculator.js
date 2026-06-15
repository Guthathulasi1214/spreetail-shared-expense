/**
 * src/utils/splitCalculator.js
 *
 * Frontend mirror of the backend split calculation logic.
 * Used exclusively for the "Live Preview" in the Add Expense form so the user
 * can see exactly who pays what, including how the rounding remainder is applied,
 * before submitting the expense to the server.
 */

const CURRENCY_DECIMALS = 2;
const MULTIPLIER = Math.pow(10, CURRENCY_DECIMALS);

function toCents(amount) {
  return Math.round(parseFloat(amount) * MULTIPLIER);
}

function fromCents(cents) {
  return parseFloat((cents / MULTIPLIER).toFixed(CURRENCY_DECIMALS));
}

export function calculateEqualSplit(amountInInr, userIds, payerUserId) {
  if (!userIds || userIds.length === 0) return [];
  const totalCents = toCents(amountInInr || 0);
  const n = userIds.length;
  const baseCents = Math.floor(totalCents / n);
  const nonPayerCount = n - 1;
  const payerCents = totalCents - (baseCents * nonPayerCount);

  return userIds.map((userId) => ({
    userId,
    shareAmount: fromCents(userId === payerUserId ? payerCents : baseCents),
  }));
}

export function calculatePercentageSplit(amountInInr, splits, payerUserId) {
  if (!splits || splits.length === 0) return [];
  const totalCents = toCents(amountInInr || 0);
  
  const nonPayers = splits.filter((s) => s.userId !== payerUserId);
  const payer = splits.find((s) => s.userId === payerUserId);
  
  if (!payer) return splits.map(s => ({ userId: s.userId, shareAmount: 0 }));

  const nonPayerResults = nonPayers.map((s) => ({
    userId: s.userId,
    shareAmount: fromCents(Math.floor((totalCents * (s.percentage || 0)) / 100)),
  }));

  const nonPayerCents = nonPayerResults.reduce((acc, r) => acc + toCents(r.shareAmount), 0);

  return [
    ...nonPayerResults,
    {
      userId: payerUserId,
      shareAmount: fromCents(totalCents - nonPayerCents),
    },
  ];
}

export function calculateShareSplit(amountInInr, splits, payerUserId) {
  if (!splits || splits.length === 0) return [];
  const totalUnits = splits.reduce((acc, s) => acc + (s.units || 0), 0);
  if (totalUnits <= 0) return splits.map(s => ({ userId: s.userId, shareAmount: 0 }));

  const totalCents = toCents(amountInInr || 0);
  const nonPayers = splits.filter((s) => s.userId !== payerUserId);
  const payer = splits.find((s) => s.userId === payerUserId);
  
  if (!payer) return splits.map(s => ({ userId: s.userId, shareAmount: 0 }));

  const nonPayerResults = nonPayers.map((s) => ({
    userId: s.userId,
    shareAmount: fromCents(Math.floor((totalCents * (s.units || 0)) / totalUnits)),
  }));

  const nonPayerCents = nonPayerResults.reduce((acc, r) => acc + toCents(r.shareAmount), 0);

  return [
    ...nonPayerResults,
    {
      userId: payerUserId,
      shareAmount: fromCents(totalCents - nonPayerCents),
    },
  ];
}
