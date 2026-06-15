/**
 * controllers/importController.js
 *
 * Handles CSV file uploads and import anomaly resolution.
 */

const csvImporter = require('../services/csvImporter');
const { ImportLog, ImportAnomaly, GroupMembership } = require('../models');

// Helper to check membership
async function requireMembership(groupId, userId) {
  const membership = await GroupMembership.findOne({
    where: { group_id: groupId, user_id: userId, left_at: null }
  });
  if (!membership) {
    const err = new Error('You must be an active member of this group.');
    err.status = 403;
    throw err;
  }
}

exports.uploadCsv = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    await requireMembership(groupId, req.user.id);

    if (!req.file) {
      throw Object.assign(new Error('No CSV file uploaded.'), { status: 400 });
    }

    const importLog = await csvImporter.importCsv(req.file.path, groupId, req.user.id);

    res.status(201).json({ importLog });
  } catch (err) {
    next(err);
  }
};

exports.getAnomalies = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    await requireMembership(groupId, req.user.id);

    // Get all anomalies that require approval and are pending
    const anomalies = await ImportAnomaly.findAll({
      include: [{
        model: ImportLog,
        as: 'ImportLog',
        where: { group_id: groupId }
      }],
      where: {
        requires_approval: true,
        approved: null
      }
    });

    res.json({ anomalies });
  } catch (err) {
    next(err);
  }
};

exports.resolveAnomaly = async (req, res, next) => {
  try {
    const { groupId, anomalyId } = req.params;
    await requireMembership(groupId, req.user.id);

    const { approved } = req.body;

    const anomaly = await ImportAnomaly.findByPk(anomalyId, {
      include: [{ model: ImportLog, as: 'ImportLog', where: { group_id: groupId } }]
    });

    if (!anomaly) {
      throw Object.assign(new Error('Anomaly not found'), { status: 404 });
    }

    anomaly.approved = approved;
    anomaly.resolved_by = req.user.id;
    anomaly.resolved_at = new Date();
    await anomaly.save();

    // If approved, we would typically apply the row data here.
    // For now, just mark it resolved.

    res.json({ message: 'Anomaly resolved successfully' });
  } catch (err) {
    next(err);
  }
};
