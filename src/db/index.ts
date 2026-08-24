/**
 * @file index.ts
 * @description 数据库客户端入口与工厂函数
 * 通过 Drizzle ORM 包装 Cloudflare D1 数据库实例，提供全套类型支持与 schema 绑定。
 *
 * @example
 * // 在 Next.js 路由或 Serverless 函数中使用：
 * const { env } = await getCloudflareContext({ async: true });
 * const db = getDb(env.DB);
 * const userList = await db.select().from(users);
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * 获取 Drizzle 数据库客户端实例
 * @param d1Database Cloudflare D1 原生数据库绑定实例 (env.DB)
 * @returns 绑定了完整 schema 的 Drizzle 数据库操作对象
 */
export function getDb(d1Database: D1Database) {
  return drizzle(d1Database, { schema });
}

// 统一导出所有数据表结构和 TypeScript 类型
export * from './schema';
