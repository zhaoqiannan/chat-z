-- Migration: 0009_update_characters_fields.sql
-- Description: 为角色表添加 个人介绍、人物背景、灵感片段 扩展字段

ALTER TABLE characters ADD COLUMN personal_intro TEXT;
ALTER TABLE characters ADD COLUMN background TEXT;
ALTER TABLE characters ADD COLUMN inspiration_fragments TEXT;
