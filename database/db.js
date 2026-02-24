const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'game.db');
const db = new Database(dbPath);

// Initialize database schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      words_score INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      banned_count INTEGER NOT NULL,
      round_seconds INTEGER NOT NULL DEFAULT 25,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leaderboard_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      rounds_survived INTEGER NOT NULL,
      best_words INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_words_score ON leaderboard_words(words_score DESC);
    CREATE INDEX IF NOT EXISTS idx_rounds_survived ON leaderboard_rounds(rounds_survived DESC);
  `);
}

initDatabase();

module.exports = db;
