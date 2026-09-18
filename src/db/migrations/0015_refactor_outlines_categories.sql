-- Migration: 0015_refactor_outlines_categories.sql
-- 为 outlines 表添加 category 与剧情推演溯源字段

ALTER TABLE outlines ADD COLUMN category text NOT NULL DEFAULT 'chapter';
ALTER TABLE outlines ADD COLUMN deduction_id integer;
ALTER TABLE outlines ADD COLUMN deduction_origin text;
ALTER TABLE outlines ADD COLUMN deduction_premise text;
ALTER TABLE outlines ADD COLUMN deduction_target text;
ALTER TABLE outlines ADD COLUMN deduction_path_title text;
ALTER TABLE outlines ADD COLUMN deduction_step_index integer;

-- 兼容存量数据分类标记
UPDATE outlines SET category = 'chapter' WHERE is_from_chapter = 1 OR chapter_id IS NOT NULL;
