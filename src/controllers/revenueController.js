const { query } = require('../config/database');

// Record revenue (called internally when games complete, ads shown, etc.)
const recordRevenue = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { game_id, revenue_type, amount, currency, metadata } = req.body;

    const validTypes = ['game_completion', 'ad_impression', 'ad_click', 'subscription', 'other'];

    if (!revenue_type || !validTypes.includes(revenue_type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid revenue_type. Must be one of: ' + validTypes.join(', ')
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be positive' });
    }

    const sql = `INSERT INTO revenue_tracking
      (publisher_id, game_id, revenue_type, amount, currency, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`;

    const result = await query(sql, [
      publisherId,
      game_id || null,
      revenue_type,
      amount,
      currency || 'USD',
      metadata ? JSON.stringify(metadata) : '{}'
    ]);

    res.status(201).json({
      success: true,
      revenue: result.rows[0]
    });
  } catch (err) {
    console.error('Record revenue error:', err);
    res.status(500).json({ success: false, error: 'Failed to record revenue' });
  }
};

// Get revenue summary
const getRevenueSummary = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { start_date, end_date, revenue_type } = req.query;

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
    if (revenue_type) {
      dateFilter += ` AND revenue_type = $${paramIndex++}`;
      params.push(revenue_type);
    }

    // Total revenue
    const totalResult = await query(
      `SELECT SUM(amount) as total, COUNT(*) as count 
       FROM revenue_tracking 
       WHERE publisher_id = $1${dateFilter}`,
      params
    );

    // By type
    const byTypeResult = await query(
      `SELECT revenue_type, SUM(amount) as total, COUNT(*) as count
       FROM revenue_tracking
       WHERE publisher_id = $1${dateFilter}
       GROUP BY revenue_type`,
      params
    );

    // By currency
    const byCurrencyResult = await query(
      `SELECT currency, SUM(amount) as total
       FROM revenue_tracking
       WHERE publisher_id = $1${dateFilter}
       GROUP BY currency`,
      params
    );

    res.json({
      success: true,
      summary: {
        total_revenue: parseFloat(totalResult.rows[0].total || 0).toFixed(2),
        total_transactions: parseInt(totalResult.rows[0].count),
        by_type: byTypeResult.rows.reduce((acc, row) => {
          acc[row.revenue_type] = {
            total: parseFloat(row.total).toFixed(2),
            count: parseInt(row.count)
          };
          return acc;
        }, {}),
        by_currency: byCurrencyResult.rows.reduce((acc, row) => {
          acc[row.currency] = parseFloat(row.total).toFixed(2);
          return acc;
        }, {})
      }
    });
  } catch (err) {
    console.error('Get revenue summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to get revenue summary' });
  }
};

// List revenue transactions
const listRevenue = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { page = 1, limit = 20, revenue_type } = req.query;

    let sql = 'SELECT * FROM revenue_tracking WHERE publisher_id = $1';
    let params = [publisherId];
    let paramIndex = 2;

    if (revenue_type) {
      sql += ` AND revenue_type = $${paramIndex++}`;
      params.push(revenue_type);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Number(limit));
    params.push((Number(page) - 1) * Number(limit));

    const result = await query(sql, params);

    res.json({
      success: true,
      revenue: result.rows
    });
  } catch (err) {
    console.error('List revenue error:', err);
    res.status(500).json({ success: false, error: 'Failed to list revenue' });
  }
};

module.exports = {
  recordRevenue,
  getRevenueSummary,
  listRevenue
};
