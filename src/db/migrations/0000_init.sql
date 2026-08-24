-- 用户表 (users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- 作品表 (works)
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  expected_words TEXT DEFAULT '50,000',
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ongoing',
  description TEXT,
  cover TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- 章节表 (chapters)
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  word_count INTEGER DEFAULT 0,
  chapter_number INTEGER DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);
