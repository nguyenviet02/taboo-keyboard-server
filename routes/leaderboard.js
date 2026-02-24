const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Rate limiting: 10 submissions per IP per hour
const submissionLimits = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const hourAgo = now - 3600000;
  
  const submissions = submissionLimits.get(ip) || [];
  const recentSubmissions = submissions.filter(time => time > hourAgo);
  
  if (recentSubmissions.length >= 10) {
    return false;
  }
  
  recentSubmissions.push(now);
  submissionLimits.set(ip, recentSubmissions);
  return true;
}

// Validation helpers
function validatePlayerName(name) {
  if (!name || typeof name !== 'string') return false;
  return /^[a-zA-Z0-9_]{2,16}$/.test(name);
}

function validateRoundsSurvived(rounds) {
  return typeof rounds === 'number' && rounds >= 0 && rounds <= 200;
}

function validateTime(seconds) {
  return typeof seconds === 'number' && seconds >= 0 && seconds <= 3600;
}

// POST /api/leaderboard/rounds - Submit rounds score
router.post('/rounds', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  const { playerName, roundsSurvived, bestWords, totalTimeSeconds } = req.body;

  if (!validatePlayerName(playerName)) {
    return res.status(400).json({ error: 'Invalid player name. Must be 2-16 alphanumeric characters or underscores.' });
  }

  if (!validateRoundsSurvived(roundsSurvived)) {
    return res.status(400).json({ error: 'Invalid rounds survived. Must be 0-200.' });
  }

  if (typeof bestWords !== 'number' || bestWords < 0 || bestWords > 200) {
    return res.status(400).json({ error: 'Invalid best words. Must be 0-200.' });
  }

  if (!validateTime(totalTimeSeconds)) {
    return res.status(400).json({ error: 'Invalid total time.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO leaderboard_rounds (player_name, rounds_survived, best_words, total_time_seconds)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(playerName, roundsSurvived, bestWords, totalTimeSeconds || 0);
    
    res.status(201).json({ 
      id: result.lastInsertRowid, 
      success: true 
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to save score.' });
  }
});

// GET /api/leaderboard/rounds - Get paginated leaderboard
router.get('/rounds', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;
  
  try {
    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM leaderboard_rounds');
    const countResult = countStmt.get();
    const total = countResult.total;
    const totalPages = Math.min(5, Math.ceil(total / limit));
    
    // Get paginated results - sort by rounds DESC, then time ASC (lower time = better)
    const stmt = db.prepare(`
      SELECT 
        player_name as name,
        rounds_survived as roundsSurvived,
        best_words as bestWords,
        total_time_seconds as totalTimeSeconds,
        created_at as date
      FROM leaderboard_rounds
      ORDER BY rounds_survived DESC, total_time_seconds ASC, created_at ASC
      LIMIT ? OFFSET ?
    `);
    
    const scores = stmt.all(limit, offset);
    
    // Calculate rank for each entry
    const result = scores.map((row, index) => ({
      rank: offset + index + 1,
      ...row,
      totalTime: formatTime(row.totalTimeSeconds),
      date: new Date(row.date).toISOString().split('T')[0]
    }));
    
    res.json({ 
      scores: result, 
      pagination: {
        page,
        totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// GET /api/leaderboard/rank - Get rank for a specific score
router.get('/rank', (req, res) => {
  const { roundsSurvived, totalTimeSeconds } = req.query;
  
  if (roundsSurvived === undefined || totalTimeSeconds === undefined) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  
  try {
    const rounds = parseInt(roundsSurvived);
    const time = parseInt(totalTimeSeconds);
    
    // Count how many entries would rank higher
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM leaderboard_rounds
      WHERE rounds_survived > ? 
         OR (rounds_survived = ? AND total_time_seconds < ?)
    `);
    
    const result = stmt.get(rounds, rounds, time);
    const rank = result.count + 1;
    const qualifies = rank <= 50;
    
    res.json({ rank, qualifies });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to calculate rank.' });
  }
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

module.exports = router;
