// ============================================================================
// NEW FILE: src/controllers/gameDefinitionsController.js
// ============================================================================
// Copy this as a NEW file to src/controllers/gameDefinitionsController.js

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// GET /api/v1/games - List all game definitions
exports.listGameDefinitions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("game_definitions")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.status(200).json({ 
      success: true, 
      games: data 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// GET /api/v1/games/:id - Get single game definition
exports.getGameDefinition = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("game_definitions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: "Game not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      game: data 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// POST /api/v1/admin/games - Create new game definition (ADMIN)
exports.createGameDefinition = async (req, res) => {
  try {
    const { name, description, rules, difficulty_levels } = req.body;

    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: "Game name is required" 
      });
    }

    const { data, error } = await supabase
      .from("game_definitions")
      .insert([
        {
          name,
          description: description || null,
          rules: rules || null,
          difficulty_levels: difficulty_levels || ["easy", "medium", "hard"],
          status: "active"
        }
      ])
      .select();

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.status(201).json({ 
      success: true, 
      game: data[0] 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// PATCH /api/v1/admin/games/:id - Update game definition (ADMIN)
exports.updateGameDefinition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, rules, status } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (rules !== undefined) updateData.rules = rules;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from("game_definitions")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: "Game not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      game: data[0] 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// DELETE /api/v1/admin/games/:id - Delete game definition (ADMIN)
exports.deleteGameDefinition = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("game_definitions")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(404).json({ 
        success: false, 
        error: "Game not found" 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: "Game definition deleted" 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// GET /api/v1/games/:id/ad-slots - Get ad slots for a game
exports.getGameAdSlots = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("ad_slots")
      .select("*")
      .eq("game_definition_id", id);

    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }

    res.status(200).json({ 
      success: true, 
      slots: data 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// GET /api/v1/games/:id/stats - Get game statistics
exports.getGameStats = async (req, res) => {
  try {
    const { id } = req.params;

    // Get game info
    const { data: gameData, error: gameError } = await supabase
      .from("game_definitions")
      .select("*")
      .eq("id", id)
      .single();

    if (gameError) {
      return res.status(404).json({ 
        success: false, 
        error: "Game not found" 
      });
    }

    // Get ad impressions for this game
    const { data: impressions, error: impressionError } = await supabase
      .from("ad_impressions")
      .select("*", { count: "exact" })
      .eq("game_definition_id", id);

    if (impressionError) {
      return res.status(400).json({ 
        success: false, 
        error: impressionError.message 
      });
    }

    res.status(200).json({ 
      success: true, 
      game: gameData,
      stats: {
        total_impressions: impressions.length || 0,
        active: true
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

module.exports = exports;
