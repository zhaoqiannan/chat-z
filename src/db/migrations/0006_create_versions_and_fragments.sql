-- 创建章节修改历史版本快照表与记忆碎片灵感库表
CREATE TABLE IF NOT EXISTS chapter_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  version_tag TEXT DEFAULT '手动保存快照',
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS memory_fragments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  chapter_id INTEGER,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT DEFAULT 'ai_chat',
  tags TEXT,
  created_at INTEGER
);
