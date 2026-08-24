/**
 * @file schema.ts
 * @description Drizzle ORM 数据库表结构定义（针对 Cloudflare D1 / SQLite）
 * 包含用户表 (users)、小说作品表 (works)、章节表 (chapters) 及其对应的 TypeScript 类型定义。
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
  /** 作品唯一标识 (UUID) */
  id: text('id').primaryKey(),
  /** 关联创建者 ID (对应 users.id) */
  userId: text('user_id').notNull(),
  /** 作品名称/书名 */
  title: text('title').notNull(),
  /** 作品分类标签（如：科幻、悬疑、都市、奇幻等） */
  tag: text('tag').notNull(),
  /** 预计字数目标（默认：50,000） */
  expectedWords: text('expected_words').default('50,000'),
  /** 当前作品实际总字数 */
  wordCount: integer('word_count').default(0),
  /** 创作状态：'ongoing'（连载中）/ 'completed'（已完结）/ 'draft'（草稿） */
  status: text('status').default('ongoing'),
  /** 作品简介/大纲概要 */
  description: text('description'),
  /** 封面图片 URL */
  cover: text('cover'),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后编辑更新时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 3. 章节表 (chapters)
// ============================================================================
export const chapters = sqliteTable('chapters', {
  /** 章节唯一标识 (UUID) */
  id: text('id').primaryKey(),
  /** 所属作品 ID (对应 works.id) */
  workId: text('work_id').notNull(),
  /** 章节标题（如：第一章 启程） */
  title: text('title').notNull(),
  /** 章节正文内容 */
  content: text('content'),
  /** 本章节实际字数统计 */
  wordCount: integer('word_count').default(0),
  /** 章节序号（用于按顺序排列章节：1, 2, 3...） */
  chapterNumber: integer('chapter_number').default(1),
  /** 创建时间 */
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  /** 最后修改时间 */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ============================================================================
// 4. TypeScript 类型导出 (用于业务代码中的强类型提示)
// ============================================================================

/** 用户查询类型 (SELECT) */
export type User = typeof users.$inferSelect;
/** 用户新增插入类型 (INSERT) */
export type NewUser = typeof users.$inferInsert;

/** 作品查询类型 (SELECT) */
export type Work = typeof works.$inferSelect;
/** 作品新增插入类型 (INSERT) */
export type NewWork = typeof works.$inferInsert;

/** 章节查询类型 (SELECT) */
export type Chapter = typeof chapters.$inferSelect;
/** 章节新增插入类型 (INSERT) */
export type NewChapter = typeof chapters.$inferInsert;
