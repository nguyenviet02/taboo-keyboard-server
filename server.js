const express = require("express");
const cors = require("cors");
const leaderboardRoutes = require("./routes/leaderboard");

const app = express();
const PORT = 7001;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://taboo-keyboard.vercel.app",
      "https://taboo-keyboard.vietnx.io.vn",
    ],
    credentials: true,
  }),
);
app.use(express.json());

// Routes
app.use("/api/leaderboard", leaderboardRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Taboo Keyboard server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});
