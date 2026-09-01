-- 1. Characters 表字段扩充
ALTER TABLE characters ADD COLUMN tags TEXT;
ALTER TABLE characters ADD COLUMN appearance_chapters TEXT;
ALTER TABLE characters ADD COLUMN character_arc TEXT;
ALTER TABLE characters ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN pinned_at INTEGER;

-- 2. Notes 表完整创建
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'idea',
  is_pinned INTEGER DEFAULT 0,
  pinned_at INTEGER,
  is_archived INTEGER DEFAULT 0,
  linked_chapter_ids TEXT,
  linked_entity_ids TEXT,
  is_todo INTEGER DEFAULT 0,
  is_completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium',
  created_at INTEGER,
  updated_at INTEGER
);

-- 3. Materials 表完整创建
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'knowledge',
  status TEXT DEFAULT 'processed',
  content TEXT,
  file_url TEXT,
  file_type TEXT DEFAULT 'document',
  file_name TEXT,
  file_size TEXT,
  ai_summary TEXT,
  source_url TEXT,
  extracted_lore TEXT,
  include_in_ai_context INTEGER DEFAULT 1,
  linked_target TEXT,
  tags TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- 4. Timelines & Events 表
CREATE TABLE IF NOT EXISTS timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_main INTEGER DEFAULT 0,
  color TEXT DEFAULT '#00c9ff',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeline_id INTEGER NOT NULL,
  work_id INTEGER NOT NULL,
  time_point TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  location TEXT,
  characters TEXT,
  impact_level TEXT DEFAULT 'major',
  description TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

-- 5. Character Relations 表
CREATE TABLE IF NOT EXISTS character_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_character_id INTEGER NOT NULL,
  target_character_id INTEGER NOT NULL,
  relation_name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
