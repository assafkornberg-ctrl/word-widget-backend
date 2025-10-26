const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const gamesController = require('../controllers/gamesController');

// All endpoints require authentication
router.use(verifyToken);

router.post('/start', gamesController.startGame);
router.post('/:id/guess', gamesController.submitGuess);
router.post('/:id/complete', gamesController.completeGame);
router.get('/', gamesController.listGames);
router.get('/:id', gamesController.getGame);

module.exports = router;
