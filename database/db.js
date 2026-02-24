const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'game.db');
const db = new Database(dbPath);

// Initialize database schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      rounds_survived INTEGER NOT NULL,
      best_words INTEGER NOT NULL,
      total_time_seconds INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rounds_survived ON leaderboard_rounds(rounds_survived DESC);
    CREATE INDEX IF NOT EXISTS idx_total_time ON leaderboard_rounds(total_time_seconds ASC);
  `);
}

initDatabase();

module.exports = db;
