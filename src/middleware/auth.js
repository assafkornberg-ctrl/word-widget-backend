const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please include Authorization header with Bearer token.'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get publisher from database
    const result = await query(
      'SELECT id, email, company_name, domain, status FROM publishers WHERE id = $1',
      [decoded.publisherId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Publisher not found'
      });
    }

    const publisher = result.rows[0];

    // Check if publisher is active
    if (publisher.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Publisher account is not active'
      });
    }

    // Attach publisher to request
    req.publisher = publisher;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Verify API key middleware (for widget requests)
const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    // Get publisher by API key
    const result = await query(
      'SELECT id, email, company_name, domain, status FROM publishers WHERE api_key = $1',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const publisher = result.rows[0];

    if (publisher.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Publisher account is not active'
      });
    }

    req.publisher = publisher;
    next();

  } catch (error) {
    console.error('API key verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

module.exports = {
  verifyToken,
  verifyApiKey
};
