const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const revenueController = require('../controllers/revenueController');

// All endpoints require authentication
router.use(verifyToken);

router.post('/', revenueController.recordRevenue);
router.get('/summary', revenueController.getRevenueSummary);
router.get('/', revenueController.listRevenue);

module.exports = router;
