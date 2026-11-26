-- 补齐历史缺失/仅靠运行时 DDL 创建的表、全站高频查询索引，并修复 chapters.updated_at 毫秒时间戳异常

CREATE TABLE IF NOT EXISTS work_master_outlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  tree_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS master_node_deduction_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  master_node_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(work_id, master_node_id)
);

CREATE TABLE IF NOT EXISTS ai_analysis_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  scope_label TEXT NOT NULL,
  scope_params_json TEXT,
  overall_score INTEGER DEFAULT 0,
  report_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chapter_ai_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  mode TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_summary TEXT,
  content TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS outline_ai_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  node_id TEXT,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  result_payload TEXT,
  created_at INTEGER
);

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

CREATE TABLE IF NOT EXISTS plot_deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  start_point TEXT NOT NULL,
  target_point TEXT NOT NULL,
  involved_characters TEXT,
  pace_preference TEXT DEFAULT 'standard',
  step_count INTEGER DEFAULT 3,
  generated_paths TEXT,
  selected_path_index INTEGER,
  status TEXT DEFAULT 'completed',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size TEXT,
  data_base64 TEXT NOT NULL,
  created_at INTEGER
);

-- 全站高频外键与查询索引（大幅降低 D1 Rows Read）
CREATE INDEX IF NOT EXISTS idx_outlines_work_cat ON outlines(work_id, category, chapter_number);
CREATE INDEX IF NOT EXISTS idx_outlines_parent ON outlines(parent_id);
CREATE INDEX IF NOT EXISTS idx_outlines_chapter ON outlines(chapter_id);
CREATE INDEX IF NOT EXISTS idx_characters_work ON characters(work_id);
CREATE INDEX IF NOT EXISTS idx_locations_work ON locations(work_id);
CREATE INDEX IF NOT EXISTS idx_factions_work ON factions(work_id);
CREATE INDEX IF NOT EXISTS idx_items_work ON items(work_id);
CREATE INDEX IF NOT EXISTS idx_world_rules_work ON world_rules(work_id);
CREATE INDEX IF NOT EXISTS idx_notes_work ON notes(work_id);
CREATE INDEX IF NOT EXISTS idx_materials_work ON materials(work_id);
CREATE INDEX IF NOT EXISTS idx_timelines_work ON timelines(work_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_work ON timeline_events(work_id, timeline_id);
CREATE INDEX IF NOT EXISTS idx_character_relations_work ON character_relations(work_id);
CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter ON chapter_versions(chapter_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_ai_chats_chapter ON chapter_ai_chats(chapter_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_ai_history_chapter ON chapter_ai_history(chapter_id);
CREATE INDEX IF NOT EXISTS idx_memory_fragments_work ON memory_fragments(work_id, user_id);
CREATE INDEX IF NOT EXISTS idx_plot_deductions_work ON plot_deductions(work_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_reports_work ON ai_analysis_reports(work_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id);

-- 一次性修复此前误以毫秒写入的 chapters.updated_at（对齐 Drizzle Unix 秒）
UPDATE chapters SET updated_at = CAST(updated_at / 1000 AS INTEGER) WHERE updated_at > 100000000000;
