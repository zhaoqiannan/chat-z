-- ============================================================================
-- Migration: 0000_init.sql
-- Description: 数据库基线初始化脚本，包含用户表、作品表、章节表、大纲表
-- Target DB: Cloudflare D1 (SQLite 语法)
--
-- 执行方式：
-- 本地: npx wrangler d1 execute chat_db --local --file=src/db/migrations/0000_init.sql
-- 远程: npx wrangler d1 execute chat_db --remote --file=src/db/migrations/0000_init.sql
-- ============================================================================

-- 1. 用户表 (users): 存放用户账号、密码哈希与个人信息
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- 用户 UUID
  username TEXT NOT NULL UNIQUE,       -- 登录用户名（全局唯一）
  password TEXT NOT NULL,              -- SHA-256 加密密码
  name TEXT,                           -- 用户昵称
  avatar TEXT,                         -- 头像 URL
  created_at INTEGER,                  -- 创建时间戳
  updated_at INTEGER                   -- 最后更新时间戳
);

-- 2. 作品表 (works): 存放小说作品基本信息与创作进度
CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,-- 作品自增数字 ID (每个人每本书唯一)
  user_id TEXT NOT NULL,               -- 关联作者 ID (users.id)
  title TEXT NOT NULL,                 -- 作品书名
  tag TEXT NOT NULL,                   -- 分类标签（科幻/悬疑等）
  expected_words INTEGER DEFAULT 50,   -- 目标字数 (INT 类型，单位：万字，默认 50)
  word_count INTEGER DEFAULT 0,        -- 当前总字数
  status TEXT DEFAULT 'ongoing',       -- 状态: ongoing(连载中)/completed(已完结)
  description TEXT,                    -- 作品简介
  cover TEXT,                          -- 封面图片
  is_pinned INTEGER DEFAULT 0,         -- 是否置顶 (1=置顶, 0=未置顶)
  pinned_at INTEGER,                   -- 置顶时间戳
  created_at INTEGER,                  -- 创建时间戳
  updated_at INTEGER                   -- 最后编辑时间戳
);

-- 3. 章节表 (chapters): 存放各小说分卷与正文章节
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,-- 章节自增数字 ID
  work_id INTEGER NOT NULL,            -- 关联小说 ID (works.id)
  user_id TEXT NOT NULL,               -- 关联作者 ID (users.id)
  volume_id INTEGER,                   -- 所属分卷 ID (chapters.id)
  is_volume INTEGER DEFAULT 0,         -- 是否是卷 (1=分卷, 0=正文章节)
  title TEXT NOT NULL,                 -- 章节/卷 标题
  content TEXT,                        -- 章节正文文本
  word_count INTEGER DEFAULT 0,        -- 本章字数
  chapter_number INTEGER DEFAULT 1,    -- 章节序号 (1, 2, 3...)
  status TEXT DEFAULT 'not_started',   -- 创作状态: not_started / revising / completed
  summary TEXT,                        -- 章节剧情摘要/备忘
  created_at INTEGER,                  -- 创建时间戳
  updated_at INTEGER                   -- 更新时间戳
);

-- 4. 故事大纲树结构表 (outlines)
CREATE TABLE IF NOT EXISTS outlines (
  id TEXT PRIMARY KEY,                 -- 大纲节点 UUID
  work_id INTEGER NOT NULL,            -- 关联的小说 ID (works.id)
  parent_id TEXT,                      -- 父节点 ID
  type TEXT NOT NULL,                  -- volume | act | scene | event
  title TEXT NOT NULL,                 -- 节点标题
  order_index INTEGER DEFAULT 0,       -- 排序序号
  goal TEXT NOT NULL,                  -- 节点目标 (*必填)
  conflict TEXT,                       -- 冲突点 / 阻碍
  characters TEXT,                     -- 涉及角色
  locations TEXT,                      -- 涉及地点
  expected_outcome TEXT,               -- 预期结果
  linked_chapters TEXT,                -- 关联章节
  created_at INTEGER,                  -- 创建时间戳
  updated_at INTEGER                   -- 更新时间戳
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_works_user_id ON works(user_id);
CREATE INDEX IF NOT EXISTS idx_chapters_work_id ON chapters(work_id);
CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_outlines_work_id ON outlines(work_id);
