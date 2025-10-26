const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes (require JWT token)
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;
