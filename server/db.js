const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'leaderboard.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  seconds INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

module.exports = db;
