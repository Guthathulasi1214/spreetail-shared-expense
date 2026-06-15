/**
 * routes/balances.js
 */

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/balanceController');

router.use(authenticate);

router.get('/:groupId/balances', ctrl.getBalances);

module.exports = router;
