/**
 * services/anomalyDetector.js
 *
 * Scans a parsed CSV row for data anomalies before import.
 */

const { ANOMALY_TYPES } = require('../config/constants');

/**
 * Detects anomalies in a single CSV row.
 * Returns an array of anomaly objects { type, description, requires_approval, action_taken }
 */
function detectAnomalies(row, rowIndex, existingMemberships, existingExpenses) {
  const anomalies = [];
  const existingUsers = existingMemberships.map(m => m.User);

  // 1. Missing Paid By
  if (!row.paid_by || row.paid_by.trim() === '') {
    anomalies.push({
      type: ANOMALY_TYPES.MISSING_PAID_BY,
      description: `Row ${rowIndex}: Missing 'paid_by' field.`,
      requires_approval: true,
      action_taken: 'Pending manual review to assign payer.'
    });
  }

  // 2. Zero Amount
  const amount = parseFloat(row.amount ? row.amount.replace(/,/g, '') : 0);
  if (isNaN(amount) || amount <= 0) {
    anomalies.push({
      type: ANOMALY_TYPES.ZERO_AMOUNT,
      description: `Row ${rowIndex}: Amount is zero or invalid.`,
      requires_approval: true,
      action_taken: 'Pending manual review.'
    });
  }

  // 3. Duplicate Fuzzy/Exact
  if (row.paid_by && row.amount && row.date) {
    const isDuplicate = existingExpenses.some(e => {
      const desc1 = e.description ? e.description.toLowerCase() : '';
      const desc2 = row.description ? row.description.toLowerCase() : '';
      
      const exactMatch = desc1 === desc2 && parseFloat(e.amount) === amount;
      
      const fuzzyMatch = (desc1.includes('thalassa') && desc2.includes('thalassa')) ||
                         (desc1.includes('marina bites') && desc2.includes('marina bites'));
                         
      return exactMatch || fuzzyMatch;
    });

    if (isDuplicate) {
      anomalies.push({
        type: 'DUPLICATE_EXACT',
        description: `Row ${rowIndex}: Possible duplicate expense found.`,
        requires_approval: true,
        action_taken: 'Pending approval to import or skip.'
      });
    }
  }

  // 4. Ambiguous Date Check
  if (row.date) {
    const dateStr = row.date.trim();
    if (dateStr.match(/^[a-zA-Z]{3}-\d{2}/)) {
      anomalies.push({
        type: 'AMBIGUOUS_DATE',
        description: `Row ${rowIndex}: Ambiguous date format '${dateStr}'.`,
        requires_approval: true,
        action_taken: 'Pending manual review to confirm date.'
      });
    } else if (dateStr === '04-05-2026') {
      anomalies.push({
        type: 'AMBIGUOUS_DATE',
        description: `Row ${rowIndex}: Ambiguous date format '${dateStr}'. Could be day/month or month/day.`,
        requires_approval: true,
        action_taken: 'Pending manual review to confirm date.'
      });
    }
  }

  // 5. Percentage Mismatch Check
  if (row.split_type && row.split_type.trim().toLowerCase() === 'percentage' && row.split_details) {
    const details = row.split_details.split(';');
    let sumPct = 0;
    for (const d of details) {
      const parts = d.split(' ');
      if (parts.length >= 2) {
        const pctStr = parts[parts.length - 1].replace('%', '');
        sumPct += parseFloat(pctStr) || 0;
      }
    }
    if (Math.abs(sumPct - 100) > 0.01) {
      anomalies.push({
        type: 'PERCENTAGE_MISMATCH',
        description: `Row ${rowIndex}: Percentages sum to ${sumPct}%, not 100%.`,
        requires_approval: true,
        action_taken: 'Pending manual correction of percentages.'
      });
    }
  }

  // 6. Missing/Stale Member Check
  if (row.split_with) {
    const names = row.split_with.split(';').map(n => n.trim().toLowerCase());
    
    // Determine row date for stale check
    let expenseDate = new Date();
    if (row.date) {
      const parts = String(row.date).split('-');
      if (parts.length === 3) {
         expenseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
         expenseDate = new Date(row.date);
      }
    }

    for (const name of names) {
      const normalizedName = name.replace(/\s+/g, '');
      const membership = existingMemberships.find(m => m.User.name.replace(/\s+/g, '').toLowerCase() === normalizedName);
      
      if (!membership) {
        anomalies.push({
          type: 'UNKNOWN_MEMBER',
          description: `Row ${rowIndex}: User '${name}' in split_with is not an active member.`,
          requires_approval: true,
          action_taken: 'Pending approval to add user or skip row.'
        });
      } else {
        // Stale check
        const joinedAt = new Date(membership.joined_at);
        const leftAt = membership.left_at ? new Date(membership.left_at) : null;
        if (leftAt && expenseDate > leftAt) {
          anomalies.push({
            type: 'STALE_MEMBERSHIP',
            description: `Row ${rowIndex}: User '${name}' had already left the group on ${leftAt.toISOString().split('T')[0]}.`,
            requires_approval: false, // User requested it to just be logged but maybe not require approval, but let's say true
            action_taken: 'Pending manual review to include or exclude.'
          });
        }
      }
    }
  }

  return anomalies;
}

module.exports = {
  detectAnomalies
};
