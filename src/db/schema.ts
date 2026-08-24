import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(), // SHA-256 加密存储
  name: text('name'),
  avatar: text('avatar'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const works = sqliteTable('works', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  tag: text('tag').notNull(),
  expectedWords: text('expected_words').default('50,000'),
  wordCount: integer('word_count').default(0),
  status: text('status').default('ongoing'),
  description: text('description'),
  cover: text('cover'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  workId: text('work_id').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  wordCount: integer('word_count').default(0),
  chapterNumber: integer('chapter_number').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;

