const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const payoutsController = require('../controllers/payoutsController');

// All endpoints require authentication
router.use(verifyToken);

router.post('/request', payoutsController.requestPayout);
router.get('/balance', payoutsController.getBalance);
router.get('/', payoutsController.listPayouts);
router.get('/:id', payoutsController.getPayout);
router.patch('/:id/mark-paid', payoutsController.markPaid);

module.exports = router;
