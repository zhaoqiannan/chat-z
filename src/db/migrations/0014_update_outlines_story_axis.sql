-- Migration: 0014_update_outlines_story_axis.sql
-- 升级大纲表为自增数字主键 (INTEGER PRIMARY KEY AUTOINCREMENT) 并支持章节故事轴与关联实体

DROP TABLE IF EXISTS outlines_new;

CREATE TABLE outlines_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  parent_id INTEGER,
  volume_id INTEGER,
  chapter_id INTEGER,
  chapter_number INTEGER,
  type TEXT NOT NULL DEFAULT 'scene',
  point_type TEXT,
  status TEXT DEFAULT 'planned',
  is_from_chapter INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  event TEXT,
  twist TEXT,
  next_goal TEXT,
  suspense TEXT,
  content TEXT,
  word_count_estimate INTEGER DEFAULT 3000,
  linked_character_ids TEXT,
  linked_note_ids TEXT,
  goal TEXT,
  conflict TEXT,
  event_description TEXT,
  expected_outcome TEXT,
  characters TEXT,
  locations TEXT,
  foreshadowing TEXT,
  linked_chapters TEXT,
  remarks TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

DROP TABLE IF EXISTS outlines;
ALTER TABLE outlines_new RENAME TO outlines;
