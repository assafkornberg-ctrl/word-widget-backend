const { query } = require('../config/database');

// Track an event
const trackEvent = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const {
      event_type,
      event_data,
      game_id,
      session_id,
      session_duration,
      page_url,
      user_agent,
      ip_address
    } = req.body;

    const validEventTypes = [
      'widget_loaded',
      'game_opened',
      'game_started',
      'game_complete',
      'game_closed',
      'ad_impression',
      'ad_click'
    ];

    if (!event_type || !validEventTypes.includes(event_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event_type. Must be one of: ' + validEventTypes.join(', ')
      });
    }

    const sql = `INSERT INTO analytics_events
      (publisher_id, game_id, event_type, event_data, session_id, session_duration, 
       page_url, user_agent, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`;

    const result = await query(sql, [
      publisherId,
      game_id || null,
      event_type,
      event_data ? JSON.stringify(event_data) : '{}',
      session_id || null,
      session_duration || null,
      page_url || null,
      user_agent || null,
      ip_address || null
    ]);

    res.status(201).json({
      success: true,
      event: result.rows[0]
    });
  } catch (err) {
    console.error('Track event error:', err);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
};

// Get analytics summary
const getSummary = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    let params = [publisherId];
    let paramIndex = 2;

    if (start_date) {
      dateFilter += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    // Total games
    const totalGames = await query(
      `SELECT COUNT(*) as count FROM games WHERE publisher_id = $1${dateFilter}`,
      params
    );

    // Completed games
    const completedGames = await query(
      `SELECT COUNT(*) as count FROM games WHERE publisher_id = $1 AND completed_at IS NOT NULL${dateFilter}`,
      params
    );

    // Won games
    const wonGames = await query(
      `SELECT COUNT(*) as count FROM games WHERE publisher_id = $1 AND won = true${dateFilter}`,
      params
    );

    // Average guesses
    const avgGuesses = await query(
      `SELECT AVG(num_guesses) as avg FROM games WHERE publisher_id = $1 AND completed_at IS NOT NULL${dateFilter}`,
      params
    );

    // Event counts by type
    const eventCounts = await query(
      `SELECT event_type, COUNT(*) as count 
       FROM analytics_events 
       WHERE publisher_id = $1${dateFilter}
       GROUP BY event_type`,
      params
    );

    const total = parseInt(totalGames.rows[0].count);
    const completed = parseInt(completedGames.rows[0].count);
    const won = parseInt(wonGames.rows[0].count);

    res.json({
      success: true,
      summary: {
        total_games: total,
        completed_games: completed,
        won_games: won,
        completion_rate: total > 0 ? ((completed / total) * 100).toFixed(2) + '%' : '0%',
        win_rate: completed > 0 ? ((won / completed) * 100).toFixed(2) + '%' : '0%',
        avg_guesses: avgGuesses.rows[0].avg ? parseFloat(avgGuesses.rows[0].avg).toFixed(2) : '0',
        events_by_type: eventCounts.rows.reduce((acc, row) => {
          acc[row.event_type] = parseInt(row.count);
          return acc;
        }, {})
      }
    });
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
};

// Get daily stats
const getDailyStats = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { days = 7 } = req.query;

    const sql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_games,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_games,
        COUNT(CASE WHEN won = true THEN 1 END) as won_games
      FROM games
      WHERE publisher_id = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const result = await query(sql, [publisherId]);

    res.json({
      success: true,
      daily_stats: result.rows
    });
  } catch (err) {
    console.error('Get daily stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to get daily stats' });
  }
};

// Get word performance
const getWordPerformance = async (req, res) => {
  try {
    const publisherId = req.publisher.id;

    const sql = `
      SELECT 
        w.word,
        w.difficulty_level,
        COUNT(g.id) as times_played,
        COUNT(CASE WHEN g.completed_at IS NOT NULL THEN 1 END) as times_completed,
        COUNT(CASE WHEN g.won = true THEN 1 END) as times_won,
        AVG(CASE WHEN g.num_guesses IS NOT NULL THEN g.num_guesses END) as avg_guesses
      FROM words w
      LEFT JOIN games g ON w.id = g.word_id
      WHERE w.publisher_id = $1
      GROUP BY w.id, w.word, w.difficulty_level
      HAVING COUNT(g.id) > 0
      ORDER BY times_played DESC
      LIMIT 50
    `;

    const result = await query(sql, [publisherId]);

    const formatted = result.rows.map(row => ({
      word: row.word,
      difficulty_level: row.difficulty_level,
      times_played: parseInt(row.times_played),
      times_completed: parseInt(row.times_completed),
      times_won: parseInt(row.times_won),
      win_rate: row.times_completed > 0 
        ? ((row.times_won / row.times_completed) * 100).toFixed(2) + '%' 
        : '0%',
      avg_guesses: row.avg_guesses ? parseFloat(row.avg_guesses).toFixed(2) : null
    }));

    res.json({
      success: true,
      word_performance: formatted
    });
  } catch (err) {
    console.error('Get word performance error:', err);
    res.status(500).json({ success: false, error: 'Failed to get word performance' });
  }
};

module.exports = {
  trackEvent,
  getSummary,
  getDailyStats,
  getWordPerformance
};
