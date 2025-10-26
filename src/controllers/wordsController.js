const { query } = require('../config/database');
const csv = require('csv-parser');
const { Readable } = require('stream');

// List words (with optional filters, pagination)
const listWords = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { status, difficulty_level, page = 1, limit = 10 } = req.query;
    let sql = 'SELECT * FROM words WHERE publisher_id = $1';
    let params = [publisherId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (difficulty_level) {
      sql += ` AND difficulty_level = $${paramIndex++}`;
      params.push(difficulty_level);
    }
    sql += ' ORDER BY created_at DESC LIMIT $' + paramIndex++;
    params.push(Number(limit));
    sql += ' OFFSET $' + paramIndex++;
    params.push((Number(page) - 1) * Number(limit));

    const result = await query(sql, params);
    res.json({ success: true, words: result.rows });
  } catch (err) {
    console.error('List words error:', err);
    res.status(500).json({ success: false, error: 'Failed to list words' });
  }
};

// Create new word
const createWord = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { word, difficulty_level, source, metadata } = req.body;
    if (!word) {
      return res.status(400).json({ success: false, error: 'Word is required' });
    }
    if (!/^[A-Z]{5}$/.test(word)) {
      return res.status(400).json({ success: false, error: 'Word must be 5 uppercase English letters' });
    }
    if (difficulty_level && !['easy','medium','hard'].includes(difficulty_level)) {
      return res.status(400).json({ success: false, error: 'Invalid difficulty_level' });
    }

    let sql = `INSERT INTO words
      (publisher_id, word, difficulty_level, source, metadata, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`;
    const values = [
      publisherId,
      word,
      difficulty_level || null,
      source || null,
      metadata ? JSON.stringify(metadata) : '{}'
    ];
    const result = await query(sql, values);
    res.status(201).json({ success: true, word: result.rows[0] });
  } catch(err) {
    console.error('Create word error:', err);
    if (String(err).includes('unique_word_per_publisher')) {
      return res.status(400).json({ success: false, error: 'Word already exists for your publisher' });
    }
    res.status(500).json({ success: false, error: 'Failed to create word' });
  }
};

// Approve word
const approveWord = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;
    const result = await query(
      "UPDATE words SET status = 'approved', approved_at = NOW() WHERE id = $1 AND publisher_id = $2 RETURNING *",
      [id, publisherId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Word not found / unauthorized' });
    }
    res.json({ success: true, word: result.rows[0] });
  } catch (err) {
    console.error('Approve word error:', err);
    res.status(500).json({ success: false, error: 'Failed to approve word' });
  }
};

// Delete word
const deleteWord = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { id } = req.params;
    const result = await query(
      'DELETE FROM words WHERE id = $1 AND publisher_id = $2 RETURNING *',
      [id, publisherId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Word not found / unauthorized' });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete word error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete word' });
  }
};

// Export words as CSV
const exportWords = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { status, difficulty_level } = req.query;

    let sql = 'SELECT word, difficulty_level, status, source, created_at FROM words WHERE publisher_id = $1';
    let params = [publisherId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (difficulty_level) {
      sql += ` AND difficulty_level = $${paramIndex++}`;
      params.push(difficulty_level);
    }
    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);

    // Convert to CSV
    let csvContent = 'word,difficulty_level,status,source,created_at\n';
    result.rows.forEach(row => {
      csvContent += `${row.word},${row.difficulty_level || ''},${row.status},${row.source || ''},${row.created_at}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=words-export.csv');
    res.send(csvContent);
  } catch (err) {
    console.error('Export words error:', err);
    res.status(500).json({ success: false, error: 'Failed to export words' });
  }
};

// Import words from CSV
const importWords = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const publisherId = req.publisher.id;
    const results = [];
    const errors = [];
    let imported = 0;
    let skipped = 0;

    // Parse CSV
    const stream = Readable.from(req.file.buffer.toString());

    const parsePromise = new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    await parsePromise;

    // Process each row
    for (const row of results) {
      const word = row.word?.trim().toUpperCase();
      const difficulty_level = row.difficulty_level?.trim().toLowerCase();
      const source = row.source?.trim() || 'csv_import';

      // Validate
      if (!word || !/^[A-Z]{5}$/.test(word)) {
        errors.push({ row, error: 'Invalid word format (must be 5 uppercase letters)' });
        skipped++;
        continue;
      }

      if (difficulty_level && !['easy', 'medium', 'hard'].includes(difficulty_level)) {
        errors.push({ row, error: 'Invalid difficulty_level' });
        skipped++;
        continue;
      }

      // Insert
      try {
        await query(
          `INSERT INTO words (publisher_id, word, difficulty_level, source, status)
           VALUES ($1, $2, $3, $4, 'pending')
           ON CONFLICT (publisher_id, word) DO NOTHING`,
          [publisherId, word, difficulty_level || null, source]
        );
        imported++;
      } catch (err) {
        errors.push({ row, error: err.message });
        skipped++;
      }
    }

    res.json({
      success: true,
      summary: {
        total: results.length,
        imported,
        skipped,
        errors: errors.length
      },
      errors: errors.slice(0, 10) // Return first 10 errors
    });

  } catch (err) {
    console.error('Import words error:', err);
    res.status(500).json({ success: false, error: 'Failed to import words' });
  }
};

// Bulk approve words
const bulkApprove = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const sql = `UPDATE words SET status = 'approved', approved_at = NOW() 
                 WHERE publisher_id = $1 AND id IN (${placeholders}) 
                 RETURNING id`;

    const result = await query(sql, [publisherId, ...ids]);

    res.json({
      success: true,
      approved: result.rows.length,
      ids: result.rows.map(r => r.id)
    });
  } catch (err) {
    console.error('Bulk approve error:', err);
    res.status(500).json({ success: false, error: 'Failed to bulk approve' });
  }
};

// Bulk delete words
const bulkDelete = async (req, res) => {
  try {
    const publisherId = req.publisher.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const sql = `DELETE FROM words 
                 WHERE publisher_id = $1 AND id IN (${placeholders}) 
                 RETURNING id`;

    const result = await query(sql, [publisherId, ...ids]);

    res.json({
      success: true,
      deleted: result.rows.length,
      ids: result.rows.map(r => r.id)
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to bulk delete' });
  }
};

module.exports = {
  listWords,
  createWord,
  approveWord,
  deleteWord,
  exportWords,
  importWords,
  bulkApprove,
  bulkDelete
};
