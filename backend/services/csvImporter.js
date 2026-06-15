/**
 * services/csvImporter.js
 *
 * Handles parsing, validating, and importing expenses from CSV.
 * Auto-creates missing users.
 */

const { Readable, PassThrough } = require('stream');
const csv = require('csv-parser');
const { sequelize, User, GroupMembership, Expense, ExpenseSplit, Settlement, ImportLog, ImportAnomaly } = require('../models');
const anomalyDetector = require('./anomalyDetector');
const authService = require('./authService');
const splitCalculator = require('./splitCalculator');

function findUserFuzzy(existingUsers, nameStr) {
  if (!nameStr) return null;
  const clean = nameStr.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  return existingUsers.find(u => {
    const uClean = u.name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    return clean === uClean || clean.startsWith(uClean + ' ') || uClean.startsWith(clean + ' ');
  });
}

async function importCsv(fileBuffer, groupId, importedBy) {
  const results = [];
  
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    stream.end(fileBuffer);
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const t = await sequelize.transaction();
        try {
          // 1. Fetch existing users in group
          const existingMemberships = await GroupMembership.findAll({
            where: { group_id: groupId },
            include: [{ model: User, as: 'User' }],
            transaction: t
          });
          const existingUsers = existingMemberships.map(m => m.User);

          // 2. Fetch existing expenses to check for duplicates
          const existingExpenses = await Expense.findAll({
            where: { group_id: groupId },
            transaction: t
          });

          // Create ImportLog
          const importLog = await ImportLog.create({
            group_id: groupId,
            imported_by: importedBy,
            total_rows: results.length,
            original_filename: 'expenses_export.csv'
          }, { transaction: t });

          let rowsImported = 0;
          let rowsFlagged = 0;
          let rowsSkipped = 0;

          // 3. Process each row
          for (let i = 0; i < results.length; i++) {
            const row = results[i];

            // Auto-onboard missing payer BEFORE anomaly detection so they exist
            if (row.paid_by && row.paid_by.trim() !== '') {
              let payerUser = findUserFuzzy(existingUsers, row.paid_by);
              if (!payerUser) {
                payerUser = await User.create({
                  name: row.paid_by.trim(),
                  email: `${row.paid_by.trim().toLowerCase().replace(/\s+/g, '')}@auto-created.com`,
                  password_hash: await authService.hashPassword('Password123!'),
                  avatar_color: authService.generateAvatarColor(row.paid_by.trim())
                }, { transaction: t });
                
                const newMembership = await GroupMembership.create({
                  group_id: groupId,
                  user_id: payerUser.id,
                  joined_at: new Date()
                }, { transaction: t });

                existingUsers.push(payerUser);
                // Also add to existingMemberships so anomalyDetector can check stale status
                existingMemberships.push({ ...newMembership.toJSON(), User: payerUser });
              }
            }
            
            // Detect Anomalies
            const anomalies = anomalyDetector.detectAnomalies(row, i + 1, existingMemberships, existingExpenses);
            
            if (anomalies.length > 0) {
              rowsFlagged++;
              for (const anomaly of anomalies) {
                await ImportAnomaly.create({
                  import_log_id: importLog.id,
                  row_number: i + 1,
                  raw_row_data: row,
                  anomaly_type: anomaly.type,
                  description: anomaly.description,
                  requires_approval: anomaly.requires_approval,
                  action_taken: anomaly.action_taken
                }, { transaction: t });
              }
              continue; // Skip importing this row directly, waits for approval
            }

            // Auto-onboard missing payer
            let payerUser = findUserFuzzy(existingUsers, row.paid_by);
            if (!payerUser) {
              payerUser = await User.create({
                name: row.paid_by.trim(),
                email: `${row.paid_by.trim().toLowerCase().replace(/\s+/g, '')}@auto-created.com`,
                password_hash: await authService.hashPassword('Password123!'),
                avatar_color: authService.generateAvatarColor(row.paid_by.trim())
              }, { transaction: t });
              
              await GroupMembership.create({
                group_id: groupId,
                user_id: payerUser.id,
                joined_at: new Date()
              }, { transaction: t });

              existingUsers.push(payerUser);
            }

            const amount = parseFloat(row.amount ? row.amount.replace(/,/g, '') : 0);
            let date = new Date(row.date);
            if (isNaN(date.getTime())) {
              // Try parsing DD-MM-YYYY
              const parts = String(row.date).split('-');
              if (parts.length === 3) {
                 date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              } else {
                 date = new Date();
              }
            }

            // Currency conversion
            const isUSD = row.currency && row.currency.trim().toUpperCase() === 'USD';
            const amountInInr = isUSD ? amount * 83 : amount;
            const currency = isUSD ? 'USD' : 'INR';

            // Extract split users
            let splitUserIds = [];
            let splitUsers = [];
            if (row.split_with) {
              const names = row.split_with.split(';');
              for (const name of names) {
                const u = findUserFuzzy(existingUsers, name);
                if (u) {
                  splitUserIds.push(u.id);
                  splitUsers.push(u);
                }
              }
            } else {
              splitUserIds = existingUsers.map(u => u.id);
            }

            // Ensure payer is in splitUserIds for expense calculations
            if (!splitUserIds.includes(payerUser.id)) {
              splitUserIds.push(payerUser.id);
            }

            // Settlement Detection: If only 1 person is listed in split_with and they are NOT the payer
            const splitNamesRaw = row.split_with ? row.split_with.split(';') : [];
            if (splitNamesRaw.length === 1 && splitUserIds.length > 0 && splitUserIds[0] !== payerUser.id && amount > 0 && (!row.split_type || row.split_type.trim() === 'equal' || row.split_type.trim() === '')) {
              // This is a settlement
              await Settlement.create({
                group_id: groupId,
                paid_by_user_id: payerUser.id,
                paid_to_user_id: splitUserIds[0],
                amount: amountInInr, // Settlements are usually in INR, or convert it
                settled_date: date,
                notes: row.description || 'Imported Settlement'
              }, { transaction: t });
              rowsImported++;
              continue;
            }

            // Expense Processing
            const expense = await Expense.create({
              group_id: groupId,
              description: row.description || 'Imported Expense',
              amount: amount,
              currency: currency,
              amount_in_inr: amountInInr,
              paid_by_user_id: payerUser.id,
              split_type: (row.split_type || 'equal').trim().toLowerCase(),
              expense_date: date,
              notes: row.notes || ''
            }, { transaction: t });

            const splitType = (row.split_type || 'equal').trim().toLowerCase();
            let splitsData = [];

            try {
              if (splitType === 'equal') {
                splitsData = splitCalculator.calculateEqualSplit(amountInInr, splitUserIds, payerUser.id);
              } else if (splitType === 'unequal') {
                const details = row.split_details.split(';');
                const unequalInput = details.map(d => {
                  const parts = d.trim().split(' ');
                  const amt = parseFloat(parts.pop());
                  const name = parts.join(' ');
                  const u = findUserFuzzy(existingUsers, name);
                  return u ? { userId: u.id, amount: amt * (isUSD ? 83 : 1) } : null;
                }).filter(Boolean);
                splitsData = splitCalculator.calculateUnequalSplit(amountInInr, unequalInput);
              } else if (splitType === 'percentage') {
                const details = row.split_details.split(';');
                const pctInput = details.map(d => {
                  const parts = d.trim().split(' ');
                  const pct = parseFloat(parts.pop().replace('%', ''));
                  const name = parts.join(' ');
                  const u = findUserFuzzy(existingUsers, name);
                  return u ? { userId: u.id, percentage: pct } : null;
                }).filter(Boolean);
                splitsData = splitCalculator.calculatePercentageSplit(amountInInr, pctInput, payerUser.id);
              } else if (splitType === 'share') {
                const details = row.split_details.split(';');
                const shareInput = details.map(d => {
                  const parts = d.trim().split(' ');
                  const units = parseFloat(parts.pop());
                  const name = parts.join(' ');
                  const u = findUserFuzzy(existingUsers, name);
                  return u ? { userId: u.id, units: units } : null;
                }).filter(Boolean);
                splitsData = splitCalculator.calculateShareSplit(amountInInr, shareInput, payerUser.id);
              } else {
                splitsData = splitCalculator.calculateEqualSplit(amountInInr, splitUserIds, payerUser.id);
              }
            } catch (calcErr) {
              console.warn(`Fallback to equal split for row ${i+1} due to calculation error:`, calcErr.message);
              splitsData = splitCalculator.calculateEqualSplit(amountInInr, splitUserIds, payerUser.id);
            }

            const splitsToInsert = splitsData.map(s => ({
              expense_id: expense.id,
              user_id: s.userId,
              share_amount: s.shareAmount,
              share_percentage: s.sharePercentage,
              share_units: s.shareUnits
            }));

            await ExpenseSplit.bulkCreate(splitsToInsert, { transaction: t });
            existingExpenses.push(expense);
            rowsImported++;
          }

          // Update ImportLog
          importLog.rows_imported = rowsImported;
          importLog.rows_flagged = rowsFlagged;
          importLog.rows_skipped = rowsSkipped;
          await importLog.save({ transaction: t });

          await t.commit();
          resolve(importLog);
        } catch (err) {
          await t.rollback();
          reject(err);
        }
      })
      .on('error', (err) => reject(err));
  });
}

module.exports = {
  importCsv
};
