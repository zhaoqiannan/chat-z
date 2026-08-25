-- ============================================================================
-- Migration: 0001_create_outlines.sql
-- Description: 故事大纲树结构表（卷、幕、情景点、事件）
-- ============================================================================

CREATE TABLE IF NOT EXISTS outlines (
  id TEXT PRIMARY KEY,                       -- 大纲节点 UUID
  work_id TEXT NOT NULL,                     -- 关联的小说作品 ID
  parent_id TEXT,                            -- 父节点 ID（可为空，表示根节点）
  type TEXT NOT NULL,                        -- 节点类型: 'volume' | 'act' | 'scene' | 'event'
  title TEXT NOT NULL,                       -- 节点标题
  order_index INTEGER DEFAULT 0,             -- 排序序号
  goal TEXT NOT NULL,                        -- 节点目标 (*必填)
  conflict TEXT,                             -- 冲突点 / 阻碍
  characters TEXT,                           -- 涉及角色（JSON 或字符串）
  locations TEXT,                            -- 涉及地点
  expected_outcome TEXT,                     -- 预期结果 / 伏笔
  linked_chapters TEXT,                      -- 关联章节 (JSON 数字数组，如 [1,2,3])
  created_at INTEGER,                        -- 创建时间戳
  updated_at INTEGER                         -- 最后更新时间戳
);

-- 建立索引加速小说大纲查询与层级检索
CREATE INDEX IF NOT EXISTS idx_outlines_work_id ON outlines(work_id);
CREATE INDEX IF NOT EXISTS idx_outlines_parent_id ON outlines(parent_id);
