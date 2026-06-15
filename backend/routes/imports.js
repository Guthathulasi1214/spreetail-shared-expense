/**
 * routes/imports.js
 *
 * CSV import routes. Uses multer for file uploads.
 */

const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/importController');

// Use memory storage — Render's filesystem is ephemeral so we never write to disk
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.use(authenticate);

router.post('/:groupId/import', upload.single('file'), ctrl.uploadCsv);
router.get('/:groupId/import/anomalies', ctrl.getAnomalies);
router.post('/:groupId/import/anomalies/:anomalyId/resolve', ctrl.resolveAnomaly);

module.exports = router;
