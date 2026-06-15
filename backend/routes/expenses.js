/**
 * routes/expenses.js
 *
 * Expense management routes, mounted under /api/groups/:groupId/expenses
 * All routes require authentication.
 */

const router = require('express').Router();
const authenticate = require('../middleware/auth');
const ctrl = require('../controllers/expenseController');

router.use(authenticate);

router.get('/:groupId/expenses', ctrl.getExpenses);
router.post('/:groupId/expenses', ctrl.createExpense);
router.delete('/:groupId/expenses/:id', ctrl.deleteExpense);

module.exports = router;
