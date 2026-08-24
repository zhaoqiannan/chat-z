-- ============================================================================
-- Migration: 0002_update_chapters.sql
-- Description: 为 chapters 表增加卷所属、状态与摘要字段
-- ============================================================================

ALTER TABLE chapters ADD COLUMN volume_id TEXT;
ALTER TABLE chapters ADD COLUMN is_volume INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN status TEXT DEFAULT 'not_started';
ALTER TABLE chapters ADD COLUMN summary TEXT;
