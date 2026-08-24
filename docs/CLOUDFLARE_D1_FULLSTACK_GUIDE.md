# Next.js + Cloudflare D1 全栈开发与部署完整实战指南

> 本教程记录了从零搭建 **Next.js 16 + @opennextjs/cloudflare + Cloudflare D1 (SQLite) + Drizzle ORM** 全栈一体化应用的完整过程、避坑指南以及常见场景操作 SOP。

---

## 目录
- [一、技术架构与核心概念](#一技术架构与核心概念)
- [二、准备工作与环境配置](#二准备工作与环境配置)
- [三、数据库 Schema 与 D1 本地建表](#三数据库-schema-与-d1-本地建表)
- [四、在 DBeaver-CE 中可视化查看本地数据库](#四在-dbeaver-ce-中可视化查看本地数据库)
- [五、全栈一体化鉴权与 API 路由开发](#五全栈一体化鉴权与-api-路由开发)
- [六、踩坑记录与避坑指南 (重点)](#六踩坑记录与避坑指南-重点)
- [七、常见开发与运维场景操作指南 (SOP)](#七常见开发与运维场景操作指南-sop)

---

## 一、技术架构与核心概念

本项目采用 **Next.js 全栈一体化架构**：
- **前端页面**：Next.js App Router (SSR / Client Components / Mantine UI)
- **后端 API**：`src/app/api/*` Route Handlers
- **数据库**：Cloudflare D1（基于 SQLite 的全球分布式边缘数据库）
- **ORM**：Drizzle ORM（轻量、无冷启动开销、原生 TypeScript 支持）
- **部署模式**：通过 `@opennextjs/cloudflare` 将前端页面、后端接口统一编译打包为单个 Cloudflare Worker。

---

## 二、准备工作与环境配置

### 1. 安装核心依赖
```bash
npm install drizzle-orm
npm install -D drizzle-kit @cloudflare/workers-types
```

### 2. 配置 `wrangler.jsonc` 中的 D1 绑定
在 `wrangler.jsonc` 中声明 D1 数据库资源：
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "chat",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",                                      // 代码内访问的环境变量名 (env.DB)
      "database_name": "chat_db",                           // Cloudflare 控制台数据库名称
      "database_id": "69859367-bc53-4412-809c-811a24151ba6" // Cloudflare 分配的唯一 UUID
    }
  ]
}
```

> **字段释义**：
> - `binding`：服务端代码通过 `getCloudflareContext()` 拿到 `env.DB` 实例的变量名；
> - `database_name`：数据库名称（命令行或后台展示用）；
> - `database_id`：远程云端数据库全局唯一 ID（本地开发若无亦可先填占位字符）。

### 3. 全局类型声明 (`global.d.ts`)
在 `global.d.ts` 中补全 Cloudflare 环境变量声明：
```typescript
interface CloudflareEnv {
  DB: import('@cloudflare/workers-types').D1Database;
  ASSETS?: import('@cloudflare/workers-types').Fetcher;
}

type D1Database = import('@cloudflare/workers-types').D1Database;
```

---

## 三、数据库 Schema 与 D1 本地建表

### 1. 编写 Schema 定义 (`src/db/schema.ts`)
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(), // SHA-256 哈希
  name: text('name'),
  avatar: text('avatar'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// 作品表
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
```

### 2. 编写 SQL 迁移脚本 (`src/db/migrations/0000_init.sql`)
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  expected_words TEXT DEFAULT '50,000',
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ongoing',
  description TEXT,
  cover TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

### 3. 本地执行建表
```bash
npx wrangler d1 execute chat_db --local --file=src/db/migrations/0000_init.sql
```

---

## 四、在 DBeaver-CE 中可视化查看本地数据库

Cloudflare D1 本地开发底层完全是 **SQLite** 文件。

1. 打开 **DBeaver-CE**，点击 **新建数据库连接** -> 选择 **SQLite**；
2. 在「数据库文件」路径中选择项目根目录下的生成文件：
   ```text
   <项目根目录>/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/xxxx.sqlite
   ```
3. 点击 **测试连接** -> **完成**，即可在 DBeaver 里随意查看表结构、修改数据和执行 SQL 查询。

---

## 五、全栈一体化鉴权与 API 路由开发

### 1. 原生 Edge 加密与 JWT 工具 (`src/utils/auth.ts`)
基于 Web Crypto API 实现，零外部 C 库依赖，完全兼容 Cloudflare 边缘计算：
- `hashPassword(password)`：SHA-256 密码加盐哈希；
- `verifyPassword(password, hash)`：密码一致性校验；
- `signToken(payload, expiresInSeconds)`：签发 7 天长效 JWT；
- `verifyToken(token)`：校验并解密 Token。

### 2. 统一服务端鉴权高阶中间件 (`src/utils/serverAuth.ts`)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload } from "@/utils/auth";

export interface CurrentUser {
  userId: string;
  username: string;
  name?: string;
  rawToken?: string;
}

export function withAuth(
  handler: (req: NextRequest, user: CurrentUser) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "").trim();

      if (!token) {
        return NextResponse.json(
          { success: false, message: "未提供访问凭证或登录已过期" },
          { status: 401 }
        );
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return NextResponse.json(
          { success: false, message: "登录凭证无效或已过期" },
          { status: 401 }
        );
      }

      return await handler(req, {
        userId: payload.userId,
        username: payload.username,
        name: payload.name || payload.username,
        rawToken: token,
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, message: error?.message || "鉴权异常" },
        { status: 500 }
      );
    }
  };
}
```

### 3. API 业务接口开发规范 (`src/app/api/works/route.ts`)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works } from "@/db";
import { desc, eq } from "drizzle-orm";

// 获取当前用户作品列表
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);

  const list = await db
    .select()
    .from(works)
    .where(eq(works.userId, user.userId))
    .orderBy(desc(works.createdAt));

  return NextResponse.json({ success: true, result: list });
});

// 新建作品
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const body = await req.json();

  const newWork = {
    id: crypto.randomUUID(),
    userId: user.userId,
    title: body.title,
    tag: body.tag,
    expectedWords: body.expectedWords || "50,000",
    wordCount: 0,
    status: "ongoing",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(works).values(newWork);
  return NextResponse.json({ success: true, result: newWork });
});
```

---

## 六、踩坑记录与避坑指南 (重点 ⚠️)

### ⚠️ 坑点 1：JS 模块循环依赖导致 `ReferenceError: Cannot access 'X' before initialization`
- **现象**：`rest.ts` 导入了 `src/rest/user.ts`，同时 `user.ts` 导入了 `rest.ts`。在打包初始化时，顶层作用域读取 `UserApi.register` 直接报错崩溃。
- **避坑方案**：底层基础工具（如 `rest.ts`）**严禁**反向导入上层业务 API 对象。路由常量使用纯字符串或提取到独立常量文件中。

### ⚠️ 坑点 2：Token 仅存内存变量，页面刷新 / 几分钟自动登出
- **现象**：`let accessToken = ''` 存放在 JS 模块内存中，F5 刷新页面后内存重置为 `""`，再次发请求报 401 并强制触发 `handleLogout()` 清空 Cookie。
- **避坑方案**：
  1. `updateSession` 时将 Token 存入 `localStorage.setItem('access_token', token)`；
  2. 模块初始化时从 `localStorage` 回填；
  3. 服务端 JWT 签发设置更合理的生命周期（如 7 天免登）。

### ⚠️ 坑点 3：`.env.local` 跨域与 404 路由丢失
- **现象**：本地 `.env.local` 配置了外部 Worker 地址（`NEXT_PUBLIC_API_BASE_URL='https://test.xxx.workers.dev'`），导致所有新建的本地 Next.js API（如 `/api/works`）全被错误转发到远程 Worker 报 404。
- **避坑方案**：收拢到本地一体化全栈后，清空 `.env.local` 中的外部前缀（`NEXT_PUBLIC_API_BASE_URL=''`），全部请求同源相对路径。

### ⚠️ 坑点 4：Next.js `trailingSlash: true` 导致接口 308 重定向
- **现象**：在 `next.config.ts` 中开启了 `trailingSlash: true`，前端请求 `/api/works`（无末尾斜杠）时，服务端会先响应 `308 Permanent Redirect` 要求重定向到 `/api/works/`，多出一次网络往返，甚至可能丢失 POST 的请求 Body。
- **避坑方案**：在 `src/utils/rest.ts` 的请求拦截器中封装 `ensureTrailingSlash`，自动将 `/api/*` 请求补齐末尾斜杠（如 `/api/works` -> `/api/works/`），直接 200 命中目标路由，彻底消除 308。

### ⚠️ 坑点 5：本地与线上数据库环境隔离认知偏差
- **现象**：在本地注册账号/建作品后，线上访问无法登录，误以为数据同步失效。
- **避坑方案**：明确本地开发（SQLite 文件）与线上生产（Cloudflare D1 分布式集群）天然物理隔离，保证本地测试不污染生产环境。

---

## 七、常见开发与运维场景操作指南 (SOP)

### 场景 1：日常代码迭代与部署
- **日常修改**：修改前端页面、组件样式、调整已有 API 逻辑。
- **部署步骤**：
  ```bash
  npm run deploy
  ```
  *(注：不需要执行任何数据库同步，云端数据与表结构保持不变)*

### 场景 2：新增数据表或修改表字段
- **操作步骤**：
  1. 在 `src/db/schema.ts` 中新增或修改表结构；
  2. 在 `src/db/migrations/` 中编写更新 SQL 脚本（如 `CREATE TABLE ...` 或 `ALTER TABLE ...`）；
  3. 本地执行：`npx wrangler d1 execute chat_db --local --file=...`；
  4. 远程执行：`npx wrangler d1 execute chat_db --remote --file=...`；
  5. 部署上线：`npm run deploy`。

### 场景 3：本地与云端数据备份与导入导出
- **导出本地数据为 SQL**：
  ```bash
  npx wrangler d1 export chat_db --local --output=./local_backup.sql
  ```
- **导出云端线上数据为 SQL 备份**：
  ```bash
  npx wrangler d1 export chat_db --remote --output=./remote_backup.sql
  ```
- **将数据导入到云端 D1**：
  ```bash
  npx wrangler d1 execute chat_db --remote --file=./local_backup.sql
  ```
