const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const wordsController = require('../controllers/wordsController');

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// All endpoints require authentication
router.use(verifyToken);

// CRUD operations
router.get('/', wordsController.listWords);
router.post('/', wordsController.createWord);
router.patch('/:id/approve', wordsController.approveWord);
router.delete('/:id', wordsController.deleteWord);

// Import/Export operations
router.get('/export', wordsController.exportWords);
router.post('/import', upload.single('file'), wordsController.importWords);

// Bulk operations
router.post('/bulk-approve', wordsController.bulkApprove);
router.post('/bulk-delete', wordsController.bulkDelete);

module.exports = router;
