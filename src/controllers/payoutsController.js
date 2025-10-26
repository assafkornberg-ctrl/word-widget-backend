const { query } = require('../config/database');

// Request a payout
const requestPayout = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { amount_usd, payment_method } = req.body;

    if (!amount_usd || amount_usd <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be positive' });
    }

    // Check available balance from revenue
    const revenueResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenue_tracking WHERE publisher_id = $1',
      [publisherId]
    );
    
    const totalRevenue = parseFloat(revenueResult.rows[0].total || 0);

    if (amount_usd > totalRevenue) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Available: ${totalRevenue.toFixed(2)}`
      });
    }

    // Use current date for period_start, and end of current month for period_end
    const today = new Date();
    const period_start = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const period_end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const sql = `INSERT INTO payouts
      (publisher_id, amount_usd, payment_method, status, period_start, period_end)
      VALUES ($1, $2, $3, 'pending', $4, $5)
      RETURNING *`;

    const result = await query(sql, [
      publisherId,
      amount_usd,
      payment_method || 'bank_transfer',
      period_start,
      period_end
    ]);

    res.status(201).json({
      success: true,
      payout: result.rows[0]
    });
  } catch (err) {
    console.error('Request payout error:', err);
    res.status(500).json({ success: false, error: 'Failed to request payout' });
  }
};

// List payouts
const listPayouts = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { status, page = 1, limit = 20 } = req.query;

    let sql = 'SELECT * FROM payouts WHERE publisher_id = $1';
    let params = [publisherId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Number(limit));
    params.push((Number(page) - 1) * Number(limit));

    const result = await query(sql, params);

    res.json({
      success: true,
      payouts: result.rows
    });
  } catch (err) {
    console.error('List payouts error:', err);
    res.status(500).json({ success: false, error: 'Failed to list payouts' });
  }
};

// Get single payout
const getPayout = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM payouts WHERE id = $1 AND publisher_id = $2',
      [id, publisherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payout not found' });
    }

    res.json({
      success: true,
      payout: result.rows[0]
    });
  } catch (err) {
    console.error('Get payout error:', err);
    res.status(500).json({ success: false, error: 'Failed to get payout' });
  }
};

// Get balance (available to withdraw)
const getBalance = async (req, res) => {
  try {
    const publisherId = req.publisher.id;

    const revenueResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenue_tracking WHERE publisher_id = $1',
      [publisherId]
    );
    
    const payoutsResult = await query(
      `SELECT COALESCE(SUM(amount_usd), 0) as total FROM payouts WHERE publisher_id = $1 AND status IN ('pending', 'processed')`,
      [publisherId]
    );

    const totalRevenue = parseFloat(revenueResult.rows[0].total || 0);
    const totalPayouts = parseFloat(payoutsResult.rows[0].total || 0);
    const availableBalance = totalRevenue - totalPayouts;

    res.json({
      success: true,
      balance: {
        total_revenue: totalRevenue.toFixed(2),
        total_paid_out: totalPayouts.toFixed(2),
        available_balance: availableBalance.toFixed(2),
        currency: 'USD'
      }
    });
  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ success: false, error: 'Failed to get balance' });
  }
};

// Mark payout as paid (admin function - for now publisher can test)
const markPaid = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;

    const sql = `UPDATE payouts 
      SET status = 'processed', processed_at = NOW()
      WHERE id = $1 AND publisher_id = $2 AND status = 'pending'
      RETURNING *`;

    const result = await query(sql, [id, publisherId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Payout not found or already processed' 
      });
    }

    res.json({
      success: true,
      payout: result.rows[0]
    });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark payout as paid' });
  }
};

module.exports = {
  requestPayout,
  listPayouts,
  getPayout,
  getBalance,
  markPaid
};
