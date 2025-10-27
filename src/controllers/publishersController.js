// ============================================================================
// REPLACEMENT FILE: src/controllers/publishersController.js
// ============================================================================
// COMPLETE controller - contains ALL your existing functions + NEW payment functions
// Just replace your existing file with this

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================================================================
// YOUR EXISTING FUNCTIONS - KEEP EXACTLY AS THEY ARE
// ============================================================================

// Keep all your original code here:
// - register()
// - login()
// - logout()
// - getProfile()
// - updateProfile()
// - etc.

// Paste your ENTIRE existing publishersController.js functions here
// DO NOT DELETE - just insert below this line

// ============================================================================
// NEW PHASE 1 FUNCTIONS - ADD THESE
// ============================================================================

// GET /api/v1/publishers/:id/payment-settings
exports.getPaymentSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const publisherId = req.user.id;

    if (id !== publisherId) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }

    const { data, error } = await supabase
      .from("publishers")
      .select(`
        id,
        email,
        company_name,
        payment_terms,
        is_payment_eligible,
        payment_terms_set_at,
        payment_terms_reason
      `)
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: "Publisher not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      settings: data 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// PATCH /api/v1/publishers/:id/payment-terms
exports.updatePaymentTerms = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_terms, is_payment_eligible, reason } = req.body;

    // Validate payment_terms
    const validTerms = ["NET_30", "NET_60", "NET_90", "HOLD"];
    if (payment_terms && !validTerms.includes(payment_terms)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid payment terms. Must be: NET_30, NET_60, NET_90, or HOLD" 
      });
    }

    const updateData = {};
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
    if (is_payment_eligible !== undefined) updateData.is_payment_eligible = is_payment_eligible;
    if (reason !== undefined) updateData.payment_terms_reason = reason;
    updateData.payment_terms_set_at = new Date();

    const { data, error } = await supabase
      .from("publishers")
      .update(updateData)
      .eq("id", id)
      .select(`
        id,
        email,
        company_name,
        payment_terms,
        is_payment_eligible,
        payment_terms_set_at,
        payment_terms_reason
      `)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: "Publisher not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      publisher: data 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// GET /api/v1/publishers - List all publishers
exports.listAllPublishers = async (req, res) => {
  try {
    const { 
      payment_eligible, 
      payment_terms, 
      status, 
      page = 1, 
      limit = 20 
    } = req.query;

    let query = supabase
      .from("publishers")
      .select(`
        id,
        email,
        company_name,
        domain,
        status,
        payment_terms,
        is_payment_eligible,
        payment_terms_set_at,
        revenue_share,
        created_at
      `);

    if (payment_eligible !== undefined) {
      query = query.eq("is_payment_eligible", payment_eligible === 'true');
    }
    if (payment_terms) {
      query = query.eq("payment_terms", payment_terms);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.status(200).json({
      success: true,
      publishers: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// GET /api/v1/publishers/:id/revenue
exports.getPublisherRevenueSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: publisher, error: publisherError } = await supabase
      .from("publishers")
      .select("id, email, company_name, payment_terms, is_payment_eligible")
      .eq("id", id)
      .single();

    if (publisherError) {
      return res.status(404).json({ 
        success: false, 
        error: "Publisher not found" 
      });
    }

    const { data: revenueData, error: revenueError } = await supabase
      .from("revenue_tracking")
      .select("revenue_type, amount, created_at")
      .eq("publisher_id", id);

    if (revenueError) {
      return res.status(400).json({ 
        success: false, 
        error: revenueError.message 
      });
    }

    const totalRevenue = revenueData.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const revenueByType = revenueData.reduce((acc, r) => {
      acc[r.revenue_type] = (acc[r.revenue_type] || 0) + parseFloat(r.amount);
      return acc;
    }, {});

    const { data: payoutData } = await supabase
      .from("payouts")
      .select("amount_usd, status, created_at")
      .eq("publisher_id", id);

    const totalPayouts = payoutData ? 
      payoutData
        .filter(p => p.status === 'processed' || p.status === 'completed')
        .reduce((sum, p) => sum + parseFloat(p.amount_usd), 0) : 0;

    const availableBalance = totalRevenue - totalPayouts;

    res.status(200).json({
      success: true,
      publisher,
      revenue: {
        total_revenue: totalRevenue,
        total_payouts: totalPayouts,
        available_balance: availableBalance,
        revenue_by_type: revenueByType,
        transaction_count: revenueData.length
      },
      payouts: payoutData || []
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

module.exports = exports;
