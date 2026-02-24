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

function validateWordsScore(score) {
  return typeof score === 'number' && score >= 0 && score <= 200;
}

function validateRoundsSurvived(rounds) {
  return typeof rounds === 'number' && rounds >= 0 && rounds <= 200;
}

function validateRoundSeconds(seconds) {
  return typeof seconds === 'number' && seconds >= 5 && seconds <= 60;
}

// POST /api/leaderboard/words - Submit words score
router.post('/words', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  const { playerName, wordsScore, roundNumber, bannedCount, roundSeconds } = req.body;

  if (!validatePlayerName(playerName)) {
    return res.status(400).json({ error: 'Invalid player name. Must be 2-16 alphanumeric characters or underscores.' });
  }

  if (!validateWordsScore(wordsScore)) {
    return res.status(400).json({ error: 'Invalid words score. Must be 0-200.' });
  }

  if (typeof roundNumber !== 'number' || roundNumber < 1 || roundNumber > 200) {
    return res.status(400).json({ error: 'Invalid round number.' });
  }

  if (typeof bannedCount !== 'number' || bannedCount < 1 || bannedCount > 25) {
    return res.status(400).json({ error: 'Invalid banned count.' });
  }

  if (!validateRoundSeconds(roundSeconds)) {
    return res.status(400).json({ error: 'Invalid round seconds. Must be 5-60.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO leaderboard_words (player_name, words_score, round_number, banned_count, round_seconds)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(playerName, wordsScore, roundNumber, bannedCount, roundSeconds || 25);
    
    res.status(201).json({ 
      id: result.lastInsertRowid, 
      success: true 
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to save score.' });
  }
});

// POST /api/leaderboard/rounds - Submit rounds score
router.post('/rounds', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  const { playerName, roundsSurvived, bestWords } = req.body;

  if (!validatePlayerName(playerName)) {
    return res.status(400).json({ error: 'Invalid player name. Must be 2-16 alphanumeric characters or underscores.' });
  }

  if (!validateRoundsSurvived(roundsSurvived)) {
    return res.status(400).json({ error: 'Invalid rounds survived. Must be 0-200.' });
  }

  if (!validateWordsScore(bestWords)) {
    return res.status(400).json({ error: 'Invalid best words. Must be 0-200.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO leaderboard_rounds (player_name, rounds_survived, best_words)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(playerName, roundsSurvived, bestWords);
    
    res.status(201).json({ 
      id: result.lastInsertRowid, 
      success: true 
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to save score.' });
  }
});

// GET /api/leaderboard/words - Get top 50 words scores
router.get('/words', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        player_name as name,
        words_score as wordsScore,
        round_number as roundNumber,
        banned_count as bannedCount,
        round_seconds as roundSeconds,
        created_at as date
      FROM leaderboard_words
      ORDER BY words_score DESC, banned_count DESC, created_at ASC
      LIMIT 50
    `);
    
    const scores = stmt.all();
    
    const result = scores.map((row, index) => ({
      rank: index + 1,
      ...row,
      date: new Date(row.date).toISOString().split('T')[0]
    }));
    
    res.json({ scores: result });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// GET /api/leaderboard/rounds - Get top 50 rounds scores
router.get('/rounds', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        player_name as name,
        rounds_survived as roundsSurvived,
        best_words as bestWords,
        created_at as date
      FROM leaderboard_rounds
      ORDER BY rounds_survived DESC, best_words DESC, created_at ASC
      LIMIT 50
    `);
    
    const scores = stmt.all();
    
    const result = scores.map((row, index) => ({
      rank: index + 1,
      ...row,
      date: new Date(row.date).toISOString().split('T')[0]
    }));
    
    res.json({ scores: result });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

module.exports = router;
