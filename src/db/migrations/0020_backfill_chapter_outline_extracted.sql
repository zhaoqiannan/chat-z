-- 一次性回填历史已有效提取过章节大纲的记录，使 chapters.outline_extracted 成为唯一权威状态来源
UPDATE chapters
SET outline_extracted = 1
WHERE is_volume = 0
  AND (outline_extracted IS NULL OR outline_extracted = 0)
  AND EXISTS (
    SELECT 1
    FROM outlines
    WHERE outlines.chapter_id = chapters.id
      AND outlines.work_id = chapters.work_id
      AND outlines.category = 'chapter'
      AND LENGTH(TRIM(COALESCE(NULLIF(outlines.event, ''), outlines.content, ''))) >= 15
      AND COALESCE(NULLIF(outlines.event, ''), outlines.content, '') NOT LIKE '%剧情稳步推进，角色展开行动%'
  );
