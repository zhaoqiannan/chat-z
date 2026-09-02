-- Migration: 0010_update_locations_fields.sql
-- Description: 为地点表添加 关联上级地点、背景、地貌描述、风土设定 扩展字段

ALTER TABLE locations ADD COLUMN parent_id INTEGER;
ALTER TABLE locations ADD COLUMN parent_name TEXT;
ALTER TABLE locations ADD COLUMN background TEXT;
ALTER TABLE locations ADD COLUMN geography TEXT;
ALTER TABLE locations ADD COLUMN customs TEXT;
