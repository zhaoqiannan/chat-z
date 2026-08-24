-- ============================================================================
-- Migration: 0000_init.sql
-- Description: 数据库基线初始化脚本，包含用户表、作品表、章节表
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
  id TEXT PRIMARY KEY,                 -- 作品 UUID
  user_id TEXT NOT NULL,               -- 关联作者 ID (users.id)
  title TEXT NOT NULL,                 -- 作品书名
  tag TEXT NOT NULL,                   -- 分类标签（科幻/悬疑等）
  expected_words TEXT DEFAULT '50,000',-- 目标字数
  word_count INTEGER DEFAULT 0,        -- 当前总字数
  status TEXT DEFAULT 'ongoing',       -- 状态: ongoing(连载中)/completed(已完结)
  description TEXT,                    -- 作品简介
  cover TEXT,                          -- 封面图片
  created_at INTEGER,                  -- 创建时间戳
  updated_at INTEGER                   -- 最后编辑时间戳
);

-- 3. 章节表 (chapters): 存放各小说章节正文与排序
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,                 -- 章节 UUID
  work_id TEXT NOT NULL,               -- 关联小说 ID (works.id)
  title TEXT NOT NULL,                 -- 章节标题
  content TEXT,                        -- 章节正文文本
  word_count INTEGER DEFAULT 0,        -- 本章字数
  chapter_number INTEGER DEFAULT 1,    -- 章节排序号 (1, 2, 3...)
  created_at INTEGER,                  -- 创建时间戳
  updated_at INTEGER                   -- 更新时间戳
);
