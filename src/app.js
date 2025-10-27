const express = require("express");
const cors = require("cors");
const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(express.json());
app.use(cors());

// ============================================================================
// IMPORT ALL ROUTES
// ============================================================================
const authRoutes = require("./routes/auth");
const publishersRoutes = require("./routes/publishers");
const wordsRoutes = require("./routes/words");
const gamesRoutes = require("./routes/games");
const analyticsRoutes = require("./routes/analytics");
const revenueRoutes = require("./routes/revenue");
const payoutsRoutes = require("./routes/payouts");
const gameDefinitionsRoutes = require("./routes/gameDefinitions");

// ============================================================================
// REGISTER ALL ROUTES
// ============================================================================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/publishers", publishersRoutes);
app.use("/api/v1/words", wordsRoutes);
app.use("/api/v1/games", gamesRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/revenue", revenueRoutes);
app.use("/api/v1/payouts", payoutsRoutes);
app.use("/api/v1/games", gameDefinitionsRoutes);
app.use("/api/v1/admin/games", gameDefinitionsRoutes);

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    database: "connected",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// START SERVER
// ============================================================================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
