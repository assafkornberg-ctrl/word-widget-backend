const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// All endpoints require authentication
router.use(verifyToken);

router.post('/event', analyticsController.trackEvent);
router.get('/summary', analyticsController.getSummary);
router.get('/daily', analyticsController.getDailyStats);
router.get('/words', analyticsController.getWordPerformance);

module.exports = router;
