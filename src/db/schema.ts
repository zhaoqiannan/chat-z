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
  /** 节点类型: 'volume'(卷/篇章) | 'act'(幕/阶段) | 'scene'(情景点) | 'event'(事件) */
  type: text('type').notNull(),
  /** 节点标题/名称 */
  title: text('title').notNull(),
  /** 同级排序索引 */
  orderIndex: integer('order_index').default(0),
  /** 节点目标 (*必填项) */
  goal: text('goal').notNull(),
  /** 冲突点 / 危机与阻碍 */
  conflict: text('conflict'),
  /** 涉及角色（多个角色可用逗号分隔或 JSON） */
  characters: text('characters'),
  /** 涉及地点 / 场景 */
  locations: text('locations'),
  /** 预期结果 / 伏笔反转 */
  expectedOutcome: text('expected_outcome'),
  /** 关联章节（如：第 1~3 章） */
  linkedChapters: text('linked_chapters'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 5. TypeScript 类型导出 (强类型提示)
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
