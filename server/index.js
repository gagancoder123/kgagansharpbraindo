const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// POST /api/scores - add a score
app.post('/api/scores', (req, res) => {
  const { name, seconds, moves, difficulty } = req.body || {};
  if (!name || typeof seconds !== 'number' || typeof moves !== 'number' || !difficulty) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // simple validation ranges
  if (seconds < 0 || seconds > 86400 || moves < 0 || moves > 10000) {
    return res.status(400).json({ error: 'Invalid values' });
  }

  const created_at = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO scores (name, seconds, moves, difficulty, created_at) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(name, seconds, moves, difficulty, created_at);
  res.json({ id: info.lastInsertRowid, name, seconds, moves, difficulty, created_at });
});

// GET /api/leaderboard?difficulty=medium&limit=20 - get recent leaderboard (last 24 hours)
app.get('/api/leaderboard', (req, res) => {
  const difficulty = req.query.difficulty || null;
  const limit = parseInt(req.query.limit) || 20;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let rows;
  if (difficulty) {
    const stmt = db.prepare('SELECT name, seconds, moves, difficulty, created_at FROM scores WHERE difficulty = ? AND created_at >= ? ORDER BY seconds ASC, moves ASC LIMIT ?');
    rows = stmt.all(difficulty, since, limit);
  } else {
    const stmt = db.prepare('SELECT name, seconds, moves, difficulty, created_at FROM scores WHERE created_at >= ? ORDER BY seconds ASC, moves ASC LIMIT ?');
    rows = stmt.all(since, limit);
  }

  res.json(rows);
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log('Leaderboard server listening on port', port));
