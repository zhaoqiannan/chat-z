-- 补齐 5 张核心世界观表的幂等建表声明（保障全新 D1 环境可完整回放）与 4 个高频复合索引

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  alias TEXT,
  gender TEXT DEFAULT '未知',
  age TEXT,
  identity TEXT,
  faction TEXT,
  role_type TEXT DEFAULT 'major',
  appearance TEXT,
  avatar_url TEXT,
  personality TEXT,
  personal_intro TEXT,
  description TEXT,
  experiences TEXT,
  background TEXT,
  inspiration_fragments TEXT,
  relationships TEXT,
  organizations TEXT,
  abilities TEXT,
  tags TEXT,
  appearance_chapters TEXT,
  character_arc TEXT,
  is_pinned INTEGER DEFAULT 0,
  pinned_at INTEGER,
  extra TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  alias TEXT,
  parent_id INTEGER,
  parent_name TEXT,
  region TEXT,
  pos_x INTEGER DEFAULT 50,
  pos_y INTEGER DEFAULT 50,
  type TEXT DEFAULT 'city',
  background TEXT,
  geography TEXT,
  customs TEXT,
  climate TEXT,
  terrain TEXT,
  features TEXT,
  specialties TEXT,
  governing_faction TEXT,
  plot_points TEXT,
  description TEXT,
  image_url TEXT,
  extra TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS factions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  leader TEXT,
  leader_id INTEGER,
  badge_url TEXT,
  scale TEXT DEFAULT 'p3',
  doctrine TEXT,
  controlled_locations TEXT,
  location_id INTEGER,
  alignment TEXT DEFAULT 'neutral',
  trend TEXT,
  relations TEXT,
  description TEXT,
  extra TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'treasure',
  tier TEXT,
  owner_id INTEGER,
  owner_name TEXT,
  appearance TEXT,
  effects TEXT NOT NULL DEFAULT '暂无描述',
  drawbacks TEXT,
  current_holder TEXT,
  history TEXT,
  description TEXT,
  image_url TEXT,
  extra TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS world_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'power_system',
  level_tree TEXT,
  mechanisms TEXT,
  effects TEXT,
  drawbacks TEXT,
  taboos TEXT,
  description TEXT,
  extra TEXT,
  is_pinned INTEGER DEFAULT 0,
  pinned_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- 高频查询复合索引（优化章节列表排序、工作台最近编辑、AI 素材注入与人物关系级联）
CREATE INDEX IF NOT EXISTS idx_chapters_work_vol_num ON chapters(work_id, is_volume, chapter_number);
CREATE INDEX IF NOT EXISTS idx_chapters_user_vol_updated ON chapters(user_id, is_volume, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_work_ai ON materials(work_id, include_in_ai_context);
CREATE INDEX IF NOT EXISTS idx_character_relations_chars ON character_relations(work_id, source_char_id, target_char_id);
