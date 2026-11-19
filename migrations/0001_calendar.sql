PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('stake','ward')),
  password_hash TEXT,
  must_change INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO users(username,calendar_id,role) VALUES
 ('stake','stake','stake'),('table-rock','table-rock','ward'),
 ('north-linder','north-linder','ward'),('overland','overland','ward'),
 ('owyhee','owyhee','ward'),('eagle-island','eagle-island','ward'),
 ('river-valley','river-valley','ward');
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username), expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, calendarId TEXT NOT NULL REFERENCES users(calendar_id),
 title TEXT NOT NULL, date TEXT NOT NULL, startTime TEXT NOT NULL, endTime TEXT NOT NULL,
 place TEXT NOT NULL, description TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS event_date ON events(date);
