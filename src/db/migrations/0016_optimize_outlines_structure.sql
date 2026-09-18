-- Migration: 0016_optimize_outlines_structure.sql
-- 为 outlines 表添加 level、summary、timeframe、location 字段，支持树级主从实体与时空因果逻辑

ALTER TABLE outlines ADD COLUMN level integer DEFAULT 1;
ALTER TABLE outlines ADD COLUMN summary text;
ALTER TABLE outlines ADD COLUMN timeframe text;
ALTER TABLE outlines ADD COLUMN location text;

-- 存量数据自愈：有 parentId 的节点 level 设为 2，没有 parentId 的设为 1
UPDATE outlines SET level = 2 WHERE parent_id IS NOT NULL;
UPDATE outlines SET level = 1 WHERE parent_id IS NULL;
