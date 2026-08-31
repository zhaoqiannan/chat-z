/**
 * @file schema.ts
 * @description Drizzle ORM 数据库表结构定义（针对 Cloudflare D1 / SQLite）
 * 包含用户表 (users)、小说作品表 (works)、章节表 (chapters)、故事大纲表 (outlines) 及其 TypeScript 类型。
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ============================================================================
// 1. 用户表 (users)
// ============================================================================
export const users = sqliteTable('users', {
  /** 用户唯一标识 (UUID) */
  id: text('id').primaryKey(),
  /** 用户名 / 登录账号（唯一） */
  username: text('username').notNull().unique(),
  /** 密码哈希值（SHA-256 加密存储，不存明文） */
  password: text('password').notNull(),
  /** 用户昵称 / 显示名称 */
  name: text('name'),
  /** 头像 URL */
  avatar: text('avatar'),
  /** 创建时间（毫秒级时间戳） */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 2. 作品表 (works)
// ============================================================================
export const works = sqliteTable('works', {
  /** 作品唯一标识 (自增数字 ID) */
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  /** 关联创建者 ID (对应 users.id) */
  userId: text('user_id').notNull(),
  /** 作品名称/书名 */
  title: text('title').notNull(),
  /** 作品分类标签（如：科幻、悬疑、都市、奇幻等） */
  tag: text('tag').notNull(),
  /** 预计目标字数（INT 类型，单位：字，默认：500000 字即 50 万字） */
  expectedWords: integer('expected_words').default(500000),
  /** 预计总章节数（INT 类型，默认：100 章） */
  expectedChapters: integer('expected_chapters').default(100),
  /** 当前作品实际总字数 */
  wordCount: integer('word_count').default(0),
  /** 当前作品实际已有章节数 */
  chapterCount: integer('chapter_count').default(0),
  /** 创作状态：'ongoing'（连载中）/ 'completed'（已完结）/ 'draft'（草稿） */
  status: text('status').default('ongoing'),
  /** 作品简介/大纲概要 */
  description: text('description'),
  /** 封面图片 URL */
  cover: text('cover'),
  /** 是否置顶 (1=置顶, 0=未置顶) */
  isPinned: integer('is_pinned').default(0),
  /** 置顶操作时间戳 (用于多个置顶项按置顶时间倒序) */
  pinnedAt: integer('pinned_at', { mode: 'timestamp' }),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后编辑更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 3. 章节表 (chapters)
// ============================================================================
export const chapters = sqliteTable('chapters', {
  /** 章节唯一标识 (自增数字 ID) */
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  /** 所属作品 ID (对应 works.id 自增数字) */
  workId: integer('work_id').notNull(),
  /** 关联用户 ID (对应 users.id) */
  userId: text('user_id').notNull(),
  /** 所属卷 ID（对应 chapters.id 自增数字，为空表示根卷/未分卷） */
  volumeId: integer('volume_id'),
  /** 是否是卷（1=卷文件夹，0=具体正文章节） */
  isVolume: integer('is_volume').default(0),
  /** 章节/卷 标题（如：第一卷 崛起之路 / 第一章 少年与剑） */
  title: text('title').notNull(),
  /** 章节小标题 / 副标题 (选填) */
  subtitle: text('subtitle'),
  /** 章节正文内容 */
  content: text('content'),
  /** 本章节实际字数统计 */
  wordCount: integer('word_count').default(0),
  /** 章节序号（用于自动递增与排序：1, 2, 3...） */
  chapterNumber: integer('chapter_number').default(1),
  /** 创作状态: 'not_started'(未开始) | 'revising'(修改中) | 'completed'(已完成) */
  status: text('status').default('not_started'),
  /** 章节剧情摘要 / 写作备忘 */
  summary: text('summary'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 4. 故事大纲树结构表 (outlines)
// ============================================================================
export const outlines = sqliteTable('outlines', {
  /** 节点唯一标识 (UUID) */
  id: text('id').primaryKey(),
  /** 所属小说作品 ID (对应 works.id 自增数字) */
  workId: integer('work_id').notNull(),
  /** 父级节点 ID（为空表示根节点） */
  parentId: text('parent_id'),
  /** 节点类型: 'story'(故事主线) | 'volume'(卷) | 'act'(幕) | 'scene'(情节点) | 'branch'(支线) */
  type: text('type').notNull(),
  /** 情节点细分类型: 'conflict'(冲突) | 'twist'(转折) | 'foreshadow'(铺垫) | 'climax'(高潮) | 'transition'(过渡) | 'reveal'(揭示) */
  pointType: text('point_type'),
  /** 节点标题/名称 */
  title: text('title').notNull(),
  /** 同级排序索引 */
  orderIndex: integer('order_index').default(0),
  /** 节点目标 (*必填项，解决什么问题) */
  goal: text('goal').notNull(),
  /** 主要冲突（人物或力量之间的矛盾） */
  conflict: text('conflict'),
  /** 事件描述（发生什么） */
  eventDescription: text('event_description'),
  /** 结果 / 状态变化（事件结束后状态如何变化） */
  expectedOutcome: text('expected_outcome'),
  /** 涉及角色（关联人物） */
  characters: text('characters'),
  /** 涉及地点（关联地点） */
  locations: text('locations'),
  /** 伏笔（新增或回收的伏笔） */
  foreshadowing: text('foreshadowing'),
  /** 对应章节（JSON 数字数组格式，如：[1, 2, 3]） */
  linkedChapters: text('linked_chapters', { mode: 'json' }).$type<number[]>(),
  /** 作者临时说明 / 备注 */
  remarks: text('remarks'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 5. 大纲 AI 推演历史记录表 (outline_ai_history)
// ============================================================================
export const outlineAiHistory = sqliteTable('outline_ai_history', {
  /** 历史记录主键 (自增数字 ID) */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 关联大纲节点 ID（可为空） */
  nodeId: text('node_id'),
  /** AI 动作类型 (如 generate_from_premise, split_scenes, expand_node, diagnose 等) */
  action: text('action').notNull(),
  /** 历史版本标题/摘要说明 */
  title: text('title').notNull(),
  /** 生成时的原始提示词/故事梗概 */
  prompt: text('prompt'),
  /** AI 生成的完整结构化结果 payload (JSON 格式) */
  resultPayload: text('result_payload', { mode: 'json' }).notNull(),
  /** 创建生成时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 6. 角色卡片表 (characters)
// ============================================================================
export const characters = sqliteTable('characters', {
  /** 角色唯一自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 角色姓名 */
  name: text('name').notNull(),
  /** 角色别名/称号 */
  alias: text('alias'),
  /** 性别: 男 | 女 | 非二元 | 其他/未知 */
  gender: text('gender').default('未知'),
  /** 年龄/外观年龄 */
  age: text('age'),
  /** 身份地位/职业标签 */
  identity: text('identity'),
  /** 阵营归属 (关联 factions.id 或文本名称) */
  faction: text('faction'),
  /** 重要程度: protagonist(主角) | major(重要配角) | supporting(普通配角) | antagonist(反派) | mob(龙套) */
  roleType: text('role_type').default('major'),
  /** 外貌肖像/长相描写 */
  appearance: text('appearance'),
  /** 头像或立绘图 URL */
  avatarUrl: text('avatar_url'),
  /** 性格侧写/心理动机/行为准则 */
  personality: text('personality'),
  /** 人物详细介绍/背景生平 */
  description: text('description'),
  /** 人物经历/重大人生事件 */
  experiences: text('experiences'),
  /** 关联人物网 (JSON 数组格式: [{ targetName: "张三", relation: "生死之交" }]) */
  relationships: text('relationships', { mode: 'json' }).$type<{ targetName: string; relation: string; description?: string }[]>(),
  /** 关联组织与社会网络 */
  organizations: text('organizations'),
  /** 拥有的能力/功法/专属装备 */
  abilities: text('abilities'),
  /** 其它补充设定 / 备忘扩展 (JSON 键值对) */
  extra: text('extra', { mode: 'json' }).$type<Record<string, any>>(),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 7. 地点与地图地标表 (locations)
// ============================================================================
export const locations = sqliteTable('locations', {
  /** 地点自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 地点名称 */
  name: text('name').notNull(),
  /** 地点别名/古称 */
  alias: text('alias'),
  /** 所属大区域/大洲/星系/势力范围 */
  region: text('region'),
  /** 地图画布 X 轴相对坐标 (0 ~ 100 之间百分比或绝对像素) */
  posX: integer('pos_x').default(50),
  /** 地图画布 Y 轴相对坐标 (0 ~ 100 之间百分比或绝对像素) */
  posY: integer('pos_y').default(50),
  /** 地点类型: city(城池/都市) | sect(宗门/基地) | dungeon(秘境/遗迹) | natural(山川荒野) | landmark(特殊地标) */
  type: text('type').default('city'),
  /** 气候环境 */
  climate: text('climate'),
  /** 地形地貌 */
  terrain: text('terrain'),
  /** 标志性风俗与特点 */
  features: text('features'),
  /** 特产物产与矿产资源 */
  specialties: text('specialties'),
  /** 统治/占领势力 (关联 factions.name) */
  governingFaction: text('governing_faction'),
  /** 涉及的核心剧情事件点 */
  plotPoints: text('plot_points'),
  /** 详细介绍 */
  description: text('description'),
  /** 地点插画/实景图 URL */
  imageUrl: text('image_url'),
  /** 其它扩展元数据 (JSON) */
  extra: text('extra', { mode: 'json' }).$type<Record<string, any>>(),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 8. 势力与阵营表 (factions)
// ============================================================================
export const factions = sqliteTable('factions', {
  /** 阵营自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 阵营/势力名称 */
  name: text('name').notNull(),
  /** 势力领袖 / 掌门人 */
  leader: text('leader'),
  /** 势力徽章/旗帜图 URL */
  badgeUrl: text('badge_url'),
  /** 势力等级/规模: 超级巨头 | 一流大派 | 中小势力 | 隐世密教 */
  scale: text('scale'),
  /** 势力宗旨/纲领/立派信条 */
  doctrine: text('doctrine'),
  /** 控制区域与根据地 */
  controlledLocations: text('controlled_locations'),
  /** 阵营立场: 正道 | 魔道 | 中立 | 混乱邪恶 | 科技保守 */
  alignment: text('alignment'),
  /** 外交关系网 (JSON: [{ targetFaction: "青云门", type: "ally" | "enemy" | "neutral", desc: "世仇" }]) */
  relations: text('relations', { mode: 'json' }).$type<{ targetFaction: string; type: string; desc?: string }[]>(),
  /** 详细背景与历史 */
  description: text('description'),
  /** 其它扩展信息 (JSON) */
  extra: text('extra', { mode: 'json' }).$type<Record<string, any>>(),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 9. 物品道具法宝表 (items)
// ============================================================================
export const items = sqliteTable('items', {
  /** 物品自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 物品名称 */
  name: text('name').notNull(),
  /** 类别: weapon(神兵武器) | treasure(法宝圣物) | consumable(丹药耗材) | tech(科技装置) | forbidden(禁忌邪物) | token(信物关键道具) */
  category: text('category').default('treasure'),
  /** 品阶等级 (如: 天阶极品 | 稀有级 | 奇点级) */
  tier: text('tier'),
  /** 外形描写 */
  appearance: text('appearance'),
  /** 核心异能与功能机理 */
  effects: text('effects').notNull(),
  /** 代价、副作用与使用限制 (*防战力崩塌关键) */
  drawbacks: text('drawbacks'),
  /** 当前持有角色 (关联 characters.name) */
  currentHolder: text('current_holder'),
  /** 历史渊源与流转 */
  history: text('history'),
  /** 详细设定与使用条件 */
  description: text('description'),
  /** 物品插画 URL */
  imageUrl: text('image_url'),
  /** 其它扩展信息 (JSON) */
  extra: text('extra', { mode: 'json' }).$type<Record<string, any>>(),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 10. 世界规则与力量体系表 (world_rules)
// ============================================================================
export const worldRules = sqliteTable('world_rules', {
  /** 规则自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 体系/法则名称 (如: 仙道修炼境界体系 | 纳米基因跃迁法) */
  name: text('name').notNull(),
  /** 规则分类: power_system(力量/战力体系) | physics_magic(物理/魔法运行机理) | society_law(社会律法/公约) | taboo(世界禁忌/天道因果) */
  category: text('category').default('power_system'),
  /** 境界等级阶梯结构 (JSON 数组: [{ order: 1, name: "练气期", lifespan: "120年", breakthrough: "引气入体", bottleneck: "经脉阻塞", powers: "基础五行术法" }]) */
  levelTree: text('level_tree', { mode: 'json' }).$type<{ order: number; name: string; lifespan?: string; breakthrough?: string; bottleneck?: string; powers?: string }[]>(),
  /** 底层运转机制与公式 */
  mechanisms: text('mechanisms'),
  /** 禁忌法则与走火入魔风险 */
  taboos: text('taboos'),
  /** 详细文字说明 */
  description: text('description'),
  /** 其它扩展信息 (JSON) */
  extra: text('extra', { mode: 'json' }).$type<Record<string, any>>(),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 11. 章节 AI 创作历史记录表 (chapter_ai_history)
// ============================================================================
export const chapterAiHistory = sqliteTable('chapter_ai_history', {
  /** 历史记录自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 关联章节 ID */
  chapterId: integer('chapter_id').notNull(),
  /** AI 动作类型: draft(初稿) | optimize(全文润色) | selection_ai(局部改写) */
  mode: text('mode').notNull(),
  /** 历史版本标题/摘要 */
  title: text('title').notNull(),
  /** 生成时的原始大纲/创作诉求摘要 */
  promptSummary: text('prompt_summary'),
  /** AI 生成的完整正文内容 (长文本) */
  content: text('content').notNull(),
  /** 正文字数统计 */
  wordCount: integer('word_count').default(0),
  /** 生成时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 12. TypeScript 类型导出 (强类型提示)
// ============================================================================

/** 用户查询类型 (SELECT) */
// ============================================================================
// 12. 随笔与待办笔记表 (notes)
// ============================================================================
export const notes = sqliteTable('notes', {
  /** 笔记自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 笔记标题 */
  title: text('title').notNull(),
  /** 笔记正文内容 */
  content: text('content').notNull(),
  /** 分类: memo(随笔备忘) | idea(灵感火花) | todo(任务待办) | outline_ref(剧情备忘) */
  category: text('category').default('memo'),
  /** 是否为待办项 (1=是, 0=否) */
  isTodo: integer('is_todo').default(0),
  /** 是否已完成/已办 (1=已办, 0=待办) */
  isCompleted: integer('is_completed').default(0),
  /** 优先级: low(低) | medium(中) | high(高) */
  priority: text('priority').default('medium'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 13. 素材资料库表 (materials)
// ============================================================================
export const materials = sqliteTable('materials', {
  /** 素材自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 素材标题 */
  title: text('title').notNull(),
  /** 分类: knowledge(专业知识) | reference(设定参考) | photo(图片图鉴) | doc(文献资料) */
  category: text('category').default('knowledge'),
  /** 详细知识/文字资料 */
  content: text('content'),
  /** 上传的附件/图片/文档 URL */
  fileUrl: text('file_url'),
  /** 附件类型: image | document | other */
  fileType: text('file_type'),
  /** 原始文件名 */
  fileName: text('file_name'),
  /** 标签 (逗号分隔) */
  tags: text('tags'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 14. 时间线与事件节点表 (timelines & timeline_events)
// ============================================================================
export const timelines = sqliteTable('timelines', {
  /** 时间线自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 时间线名称 (如: 主线编年史、上古神魔纪元、主角成长线) */
  title: text('title').notNull(),
  /** 时间线描述 */
  description: text('description'),
  /** 是否为主时间线 (1=是, 0=否) */
  isMain: integer('is_main').default(0),
  /** 主题色 */
  color: text('color').default('#00c9ff'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const timelineEvents = sqliteTable('timeline_events', {
  /** 事件节点自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属时间线 ID */
  timelineId: integer('timeline_id').notNull(),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 时间点描述 (如: 天元历 320 年、第 3 天清晨、纪元前十万年) */
  timePoint: text('time_point').notNull(),
  /** 排序权重 */
  sortOrder: integer('sort_order').default(0),
  /** 事件标题 */
  title: text('title').notNull(),
  /** 发生地点 */
  location: text('location'),
  /** 涉及人物 (逗号分隔) */
  characters: text('characters'),
  /** 影响等级: climax(高潮转折) | major(重大事件) | normal(日常推进) | minor(背景小事) */
  impactLevel: text('impact_level').default('major'),
  /** 详细事件经过描述 */
  description: text('description'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 15. 角色关系网络表 (character_relations)
// ============================================================================
export const characterRelations = sqliteTable('character_relations', {
  /** 关系记录自增 ID */
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属作品 ID */
  workId: integer('work_id').notNull(),
  /** 角色 A ID (关联 characters.id) */
  sourceCharId: integer('source_char_id').notNull(),
  /** 角色 A 姓名 */
  sourceCharName: text('source_char_name').notNull(),
  /** 角色 B ID (关联 characters.id) */
  targetCharId: integer('target_char_id').notNull(),
  /** 角色 B 姓名 */
  targetCharName: text('target_char_name').notNull(),
  /** 关系类型名称 (如: 生死之交、同门师兄妹、杀父仇敌、暗恋、上下级) */
  relationType: text('relation_type').notNull(),
  /** 关系性质标签: friendly(同盟友好) | hostile(敌对仇恨) | romantic(恋爱羁绊) | family(血亲同门) | neutral(利益中立) */
  relationTag: text('relation_tag').default('friendly'),
  /** 关系背景渊源 */
  description: text('description'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 16. TypeScript 类型导出 (强类型提示)
// ============================================================================

/** 用户查询类型 (SELECT) */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** 作品查询类型 (SELECT) */
export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;

/** 章节查询类型 (SELECT) */
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;

/** 大纲节点查询类型 (SELECT) */
export type Outline = typeof outlines.$inferSelect;
export type NewOutline = typeof outlines.$inferInsert;

/** 大纲 AI 历史记录查询类型 (SELECT) */
export type OutlineAiHistory = typeof outlineAiHistory.$inferSelect;
export type NewOutlineAiHistory = typeof outlineAiHistory.$inferInsert;

/** 角色卡片类型 */
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

/** 地点地标类型 */
export type LocationItem = typeof locations.$inferSelect;
export type NewLocationItem = typeof locations.$inferInsert;

/** 阵营势力类型 */
export type Faction = typeof factions.$inferSelect;
export type NewFaction = typeof factions.$inferInsert;

/** 物品道具类型 */
export type ItemRecord = typeof items.$inferSelect;
export type NewItemRecord = typeof items.$inferInsert;

/** 世界规则体系类型 */
export type WorldRule = typeof worldRules.$inferSelect;
export type NewWorldRule = typeof worldRules.$inferInsert;

/** 章节 AI 历史记录类型 */
export type ChapterAiHistory = typeof chapterAiHistory.$inferSelect;
export type NewChapterAiHistory = typeof chapterAiHistory.$inferInsert;

/** 笔记记录类型 */
export type NoteItem = typeof notes.$inferSelect;
export type NewNoteItem = typeof notes.$inferInsert;

/** 素材资料类型 */
export type MaterialItem = typeof materials.$inferSelect;
export type NewMaterialItem = typeof materials.$inferInsert;

/** 时间线类型 */
export type Timeline = typeof timelines.$inferSelect;
export type NewTimeline = typeof timelines.$inferInsert;

/** 时间线节点类型 */
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type NewTimelineEvent = typeof timelineEvents.$inferInsert;

/** 角色关系记录类型 */
export type CharacterRelation = typeof characterRelations.$inferSelect;
export type NewCharacterRelation = typeof characterRelations.$inferInsert;




