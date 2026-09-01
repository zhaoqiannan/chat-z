CREATE TABLE IF NOT EXISTS chapter_ai_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  action_type TEXT DEFAULT 'chat',
  selected_text TEXT,
  context_tags TEXT,
  applied INTEGER DEFAULT 0,
  created_at INTEGER
);
