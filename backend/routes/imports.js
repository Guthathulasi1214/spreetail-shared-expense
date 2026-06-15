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

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.csv');
  }
});
const upload = multer({ storage: storage });

router.use(authenticate);

router.post('/:groupId/import', upload.single('file'), ctrl.uploadCsv);
router.get('/:groupId/import/anomalies', ctrl.getAnomalies);
router.post('/:groupId/import/anomalies/:anomalyId/resolve', ctrl.resolveAnomaly);

module.exports = router;
