const { query } = require('../config/database');

// Start a new game
const startGame = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { word_id, session_id, user_fingerprint, user_agent, ip_address, referrer } = req.body;

    if (!word_id) {
      return res.status(400).json({ success: false, error: 'word_id is required' });
    }

    // Verify word belongs to publisher
    const wordCheck = await query(
      'SELECT id FROM words WHERE id = $1 AND publisher_id = $2 AND status = \'approved\'',
      [word_id, publisherId]
    );

    if (wordCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Word not found or not approved' });
    }

    const sql = `INSERT INTO games 
      (publisher_id, word_id, session_id, user_fingerprint, user_agent, ip_address, referrer, guesses)
      VALUES ($1, $2, $3, $4, $5, $6, $7, '[]')
      RETURNING *`;

    const result = await query(sql, [
      publisherId,
      word_id,
      session_id || null,
      user_fingerprint || null,
      user_agent || null,
      ip_address || null,
      referrer || null
    ]);

    res.status(201).json({
      success: true,
      game: result.rows[0]
    });
  } catch (err) {
    console.error('Start game error:', err);
    res.status(500).json({ success: false, error: 'Failed to start game' });
  }
};

// Submit a guess
const submitGuess = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;
    const { guess } = req.body;

    if (!guess || !/^[A-Z]{5}$/.test(guess)) {
      return res.status(400).json({ success: false, error: 'Invalid guess format (must be 5 uppercase letters)' });
    }

    // Get current game
    const gameResult = await query(
      'SELECT * FROM games WHERE id = $1 AND publisher_id = $2',
      [id, publisherId]
    );

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    if (game.completed_at) {
      return res.status(400).json({ success: false, error: 'Game already completed' });
    }

    // Add guess to array
    const guesses = game.guesses || [];
    guesses.push({
      guess,
      timestamp: new Date().toISOString()
    });

    // Update game
    const updateSql = `UPDATE games 
      SET guesses = $1, num_guesses = $2
      WHERE id = $3 AND publisher_id = $4
      RETURNING *`;

    const result = await query(updateSql, [
      JSON.stringify(guesses),
      guesses.length,
      id,
      publisherId
    ]);

    res.json({
      success: true,
      game: result.rows[0]
    });
  } catch (err) {
    console.error('Submit guess error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit guess' });
  }
};

// Complete a game
const completeGame = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;
    const { won } = req.body;

    if (typeof won !== 'boolean') {
      return res.status(400).json({ success: false, error: 'won (boolean) is required' });
    }

    const sql = `UPDATE games 
      SET won = $1, completed_at = NOW()
      WHERE id = $2 AND publisher_id = $3 AND completed_at IS NULL
      RETURNING *`;

    const result = await query(sql, [won, id, publisherId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found or already completed' });
    }

    res.json({
      success: true,
      game: result.rows[0]
    });
  } catch (err) {
    console.error('Complete game error:', err);
    res.status(500).json({ success: false, error: 'Failed to complete game' });
  }
};

// List games
const listGames = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { page = 1, limit = 20, completed } = req.query;

    let sql = 'SELECT * FROM games WHERE publisher_id = $1';
    let params = [publisherId];
    let paramIndex = 2;

    if (completed !== undefined) {
      sql += ` AND completed_at IS ${completed === 'true' ? 'NOT' : ''} NULL`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Number(limit));
    params.push((Number(page) - 1) * Number(limit));

    const result = await query(sql, params);

    res.json({
      success: true,
      games: result.rows
    });
  } catch (err) {
    console.error('List games error:', err);
    res.status(500).json({ success: false, error: 'Failed to list games' });
  }
};

// Get single game
const getGame = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM games WHERE id = $1 AND publisher_id = $2',
      [id, publisherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Game not found' });
    }

    res.json({
      success: true,
      game: result.rows[0]
    });
  } catch (err) {
    console.error('Get game error:', err);
    res.status(500).json({ success: false, error: 'Failed to get game' });
  }
};

module.exports = {
  startGame,
  submitGuess,
  completeGame,
  listGames,
  getGame
};
