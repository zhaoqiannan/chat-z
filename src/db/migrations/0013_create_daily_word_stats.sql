-- Migration: 0013_create_daily_word_stats.sql
-- 创建每日写作字数统计表 (用于记录每日/每周/连续创作天数字数快照)
CREATE TABLE IF NOT EXISTS daily_word_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  stat_date TEXT NOT NULL, -- 格式: YYYY-MM-DD
  words_added INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_word_stats_user_date ON daily_word_stats (user_id, stat_date);
