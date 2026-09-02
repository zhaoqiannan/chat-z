-- 1. 阵营 factions 字段扩充
ALTER TABLE factions ADD COLUMN leader_id INTEGER;
ALTER TABLE factions ADD COLUMN location_id INTEGER;
ALTER TABLE factions ADD COLUMN trend TEXT;

-- 2. 物品 items 字段扩充
ALTER TABLE items ADD COLUMN owner_id INTEGER;
ALTER TABLE items ADD COLUMN owner_name TEXT;

-- 3. 规则 world_rules 字段扩充与兼容
ALTER TABLE world_rules ADD COLUMN effects TEXT;
ALTER TABLE world_rules ADD COLUMN drawbacks TEXT;
