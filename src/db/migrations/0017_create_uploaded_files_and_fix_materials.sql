-- 17. 创建上传文件存储表与补充关系图谱/素材表字段
CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size TEXT,
  data_base64 TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS character_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  source_char_id INTEGER,
  source_char_name TEXT,
  target_char_id INTEGER,
  target_char_name TEXT,
  relation_type TEXT,
  relation_tag TEXT DEFAULT 'friendly',
  description TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
