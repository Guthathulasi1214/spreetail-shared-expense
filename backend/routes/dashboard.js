/**
 * routes/dashboard.js
 */

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/', ctrl.getDashboardData);

module.exports = router;
