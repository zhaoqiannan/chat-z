-- 1. 彻底移除旧 A->B 剧情推演记录表与旧推演卡片数据
DROP TABLE IF EXISTS plot_deductions;
DELETE FROM outlines WHERE category = 'deduction';

-- 2. 移除 outlines 表上 6 个旧推演专属列
ALTER TABLE outlines DROP COLUMN deduction_id;
ALTER TABLE outlines DROP COLUMN deduction_origin;
ALTER TABLE outlines DROP COLUMN deduction_premise;
ALTER TABLE outlines DROP COLUMN deduction_target;
ALTER TABLE outlines DROP COLUMN deduction_path_title;
ALTER TABLE outlines DROP COLUMN deduction_step_index;

-- 3. 为章节表新增世界观增量扫描状态标记（0=未扫描/正文已变更, 1=已同步扫描）
ALTER TABLE chapters ADD COLUMN world_extracted INTEGER DEFAULT 0;
