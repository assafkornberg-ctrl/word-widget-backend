const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { pool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const wordsRoutes = require('./routes/words');
const gamesRoutes = require('./routes/games');
const analyticsRoutes = require('./routes/analytics');
const revenueRoutes = require('./routes/revenue');
const payoutsRoutes = require('./routes/payouts');

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Word Widget API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/v1/auth/register',
        login: 'POST /api/v1/auth/login',
        profile: 'GET /api/v1/auth/profile'
      },
      words: {
        list: 'GET /api/v1/words/',
        create: 'POST /api/v1/words/',
        approve: 'PATCH /api/v1/words/:id/approve',
        delete: 'DELETE /api/v1/words/:id',
        export: 'GET /api/v1/words/export',
        import: 'POST /api/v1/words/import',
        bulkApprove: 'POST /api/v1/words/bulk-approve',
        bulkDelete: 'POST /api/v1/words/bulk-delete'
      },
      games: {
        start: 'POST /api/v1/games/start',
        guess: 'POST /api/v1/games/:id/guess',
        complete: 'POST /api/v1/games/:id/complete',
        list: 'GET /api/v1/games',
        get: 'GET /api/v1/games/:id'
      },
      analytics: {
        trackEvent: 'POST /api/v1/analytics/event',
        summary: 'GET /api/v1/analytics/summary',
        daily: 'GET /api/v1/analytics/daily',
        words: 'GET /api/v1/analytics/words'
      },
      revenue: {
        record: 'POST /api/v1/revenue',
        summary: 'GET /api/v1/revenue/summary',
        list: 'GET /api/v1/revenue'
      },
      payouts: {
        request: 'POST /api/v1/payouts/request',
        balance: 'GET /api/v1/payouts/balance',
        list: 'GET /api/v1/payouts',
        get: 'GET /api/v1/payouts/:id',
        markPaid: 'PATCH /api/v1/payouts/:id/mark-paid'
      }
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/words', wordsRoutes);
app.use('/api/v1/games', gamesRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/revenue', revenueRoutes);
app.use('/api/v1/payouts', payoutsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Server running on http://localhost:' + PORT);
  console.log('📊 Health: http://localhost:' + PORT + '/health');
  console.log('');
  console.log('🔐 Auth | 💡 Words | 🎮 Games | 📈 Analytics | 💰 Revenue | 💳 Payouts');
  console.log('');
  console.log('Press Ctrl+C to stop');
});

module.exports = app;
