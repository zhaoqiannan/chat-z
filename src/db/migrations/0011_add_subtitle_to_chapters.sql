-- 0011_add_subtitle_to_chapters.sql
-- 为 chapters 表补充缺失的 subtitle 字段

ALTER TABLE chapters ADD COLUMN subtitle TEXT;
