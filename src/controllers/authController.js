const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');

// Generate JWT token
const generateToken = (publisherId) => {
  return jwt.sign(
    { publisherId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

// Generate API key
const generateApiKey = () => {
  return 'pk_live_' + crypto.randomBytes(24).toString('hex');
};

// Register new publisher
const register = async (req, res) => {
  try {
    const { email, password, company_name, domain } = req.body;

    // Validation
    if (!email || !password || !company_name || !domain) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: email, password, company_name, domain'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Password strength check
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Check if email already exists
    const existingPublisher = await query(
      'SELECT id FROM publishers WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingPublisher.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate API key
    const apiKey = generateApiKey();

    // Insert publisher
    const result = await query(
      `INSERT INTO publishers (email, password_hash, company_name, domain, api_key, status, revenue_share)
       VALUES ($1, $2, $3, $4, $5, 'active', 70.00)
       RETURNING id, email, company_name, domain, api_key, status, revenue_share, created_at`,
      [email.toLowerCase(), passwordHash, company_name, domain, apiKey]
    );

    const publisher = result.rows[0];

    // Generate JWT token
    const token = generateToken(publisher.id);

    res.status(201).json({
      success: true,
      message: 'Publisher registered successfully',
      data: {
        publisher: {
          id: publisher.id,
          email: publisher.email,
          company_name: publisher.company_name,
          domain: publisher.domain,
          api_key: publisher.api_key,
          status: publisher.status,
          revenue_share: publisher.revenue_share,
          created_at: publisher.created_at
        },
        token
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
};

// Login publisher
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Get publisher by email
    const result = await query(
      'SELECT id, email, password_hash, company_name, domain, api_key, status, revenue_share FROM publishers WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const publisher = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, publisher.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (publisher.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active. Please contact support.'
      });
    }

    // Generate JWT token
    const token = generateToken(publisher.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        publisher: {
          id: publisher.id,
          email: publisher.email,
          company_name: publisher.company_name,
          domain: publisher.domain,
          api_key: publisher.api_key,
          status: publisher.status,
          revenue_share: publisher.revenue_share
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};

// Get current publisher profile
const getProfile = async (req, res) => {
  try {
    // Publisher is already attached to req by auth middleware
    const publisherId = req.publisher.id;

    const result = await query(
      `SELECT id, email, company_name, domain, api_key, status, revenue_share, created_at, updated_at
       FROM publishers WHERE id = $1`,
      [publisherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Publisher not found'
      });
    }

    res.json({
      success: true,
      data: {
        publisher: result.rows[0]
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile
};
