-- Migration: 0012_create_activity_logs.sql
-- 创建用户操作与活动动态日志表 (用于记录近24小时作品/章节的新增、修改、删除事件)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  work_id INTEGER,
  work_title TEXT,
  target_type TEXT NOT NULL, -- 'work' | 'chapter'
  target_id INTEGER,
  target_title TEXT,
  action TEXT NOT NULL,      -- 'create' | 'update' | 'delete'
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_time ON activity_logs (user_id, created_at DESC);
