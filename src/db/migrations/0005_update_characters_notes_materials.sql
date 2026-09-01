-- Characters 表字段扩充
ALTER TABLE characters ADD COLUMN tags TEXT;
ALTER TABLE characters ADD COLUMN appearance_chapters TEXT;
ALTER TABLE characters ADD COLUMN character_arc TEXT;
ALTER TABLE characters ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN pinned_at INTEGER;

-- Notes 表字段扩充
ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN pinned_at INTEGER;
ALTER TABLE notes ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN linked_chapter_ids TEXT;
ALTER TABLE notes ADD COLUMN linked_entity_ids TEXT;

-- Materials 表字段扩充
ALTER TABLE materials ADD COLUMN status TEXT DEFAULT 'processed';
ALTER TABLE materials ADD COLUMN file_size TEXT;
ALTER TABLE materials ADD COLUMN ai_summary TEXT;
ALTER TABLE materials ADD COLUMN source_url TEXT;
ALTER TABLE materials ADD COLUMN extracted_lore TEXT;
ALTER TABLE materials ADD COLUMN include_in_ai_context INTEGER DEFAULT 1;
ALTER TABLE materials ADD COLUMN linked_target TEXT;
