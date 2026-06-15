/**
 * routes/settlements.js
 */

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/settlementController');

router.use(authenticate);

router.get('/:groupId/settlements', ctrl.getSettlements);
router.post('/:groupId/settlements', ctrl.createSettlement);

module.exports = router;
