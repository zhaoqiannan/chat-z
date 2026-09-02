-- 1. 为 outlines 表补充内容字段
ALTER TABLE outlines ADD COLUMN content TEXT;
ALTER TABLE outlines ADD COLUMN volume_id TEXT;

-- 2. 创建剧情推演记录表 (plot_deductions)
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
