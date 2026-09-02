# Chat-Z 项目部署与数据库同步指南

本项目基于 **Next.js 16 (App Router)** + **OpenNext (@opennextjs/cloudflare)** 构建，后端全量运行在 **Cloudflare Workers** 边缘运行时，数据库使用 **Cloudflare D1 (Serverless SQLite)**，AI 模块深度绑定 **Cloudflare Workers AI**。

---

## 一、线上访问地址

- **生产环境 URL**：[https://chat.chat-z.workers.dev](https://chat.chat-z.workers.dev)
- **绑定的云资源**：
  - `env.DB` -> Cloudflare D1 Database (`chat_db`, ID: `69859367-bc53-4412-809c-811a24151ba6`)
  - `env.AI` -> Cloudflare Workers AI
  - `env.ASSETS` -> 静态资源分发网络

---

## 二、标准构建与线上发布流程（推荐）

每次完成功能开发后，只需按顺序执行以下 **3 个标准步骤**：

### 第 1 步：代码提交并推送到 GitHub
```bash
git add .
git commit -m "feat: 更新功能描述"
git push
```

### 第 2 步：同步数据库结构与业务数据到线上

#### A. 结构迁移（新增表或新字段时）
```bash
npx wrangler d1 migrations apply chat_db --remote
```
> **⚠️ 提示**：此命令仅同步**表结构定义 (DDL)**。如果显示 `No migrations to apply!`，代表结构已是最新的。

#### B. 数据同步（将本地新增的作品、角色、章节等数据全量推送到线上）
```bash
# 1. 自动提取本地数据并与远程结构精准对齐
python3 scripts/sync_data_perfect.py

# 2. 一键导入到线上 D1 数据库
npx wrangler d1 execute chat_db --remote --file=sync_data_to_remote.sql --yes
```

### 第 3 步：一键打包并全量发布到 Cloudflare
```bash
npm run deploy
```
该命令会自动完成流水线式部署：
1. **Next.js 生产编译** (`next build --webpack`)：自动检查 TypeScript 类型与 React 组件并生成 Web 产物；
2. **OpenNext 边缘适配** (`opennextjs-cloudflare build`)：将 Next.js 路由与 API 转译为 Cloudflare Worker 标准格式，并提取静态资源；
3. **边缘发布与路由生效** (`opennextjs-cloudflare deploy`)：自动将静态资源上传至 Cloudflare CDN，同时将 Worker 代码发布上线，瞬时生效。

---

## 三、常用日常开发与排查命令速查

| 操作场景 | 执行命令 | 说明 |
| :--- | :--- | :--- |
| **本地开发联调** | `npm run dev` | 启动本地 Next.js 服务（端口 3146），支持本地 SQLite 与热重载 |
| **全量类型检查** | `npx tsc --noEmit` | 校验全项目 TypeScript 类型正确性，确保 0 报错 |
| **本地打包预检** | `npm run build` | 本地执行 Next.js 生产环境打包验证 |
| **线上全量发布** | `npm run deploy` | 一键打包并部署至 Cloudflare 生产环境 |
| **查询线上迁移** | `npx wrangler d1 migrations list chat_db --remote` | 查看线上数据库当前已应用的迁移版本列表 |
| **线上数据执行** | `npx wrangler d1 execute chat_db --remote --command="SELECT COUNT(*) FROM works;"` | 在终端直接对线上 D1 执行任意 SQL 查询 |

---

## 四、全系统核心功能与模块索引

| 功能模块 | 前端组件目录 | 后端 API 路由 | 数据库表 | 核心特性 |
| :--- | :--- | :--- | :--- | :--- |
| **角色档案库** | `src/components/pages/project/world/characters/` | `/api/characters` | `characters` | 角色置顶、头像上传、智能姓名生成器 |
| **阵营与势力** | `src/components/pages/project/world/factions/` | `/api/factions` | `factions` | P0-P10规模、正/反/中立立场、领袖与地点关联、发展走势 |
| **物品与法宝** | `src/components/pages/project/world/items/` | `/api/items` | `items` | 自由文本标签、所属角色与关联阵营、效果描述 |
| **世界规则设定** | `src/components/pages/project/world/rules/` | `/api/rules` | `world_rules` | 自由领域分类、关联角色与阵营、运转法则机理 |
| **大纲剧情树** | `src/components/pages/project/outline/` | `/api/outlines` | `outlines` | 分卷与情节点、简洁单层管理、节点拖拽排序 |
| **剧情转折推演** | `.../drawer-plot-deduction/` | `/api/ai/plot-deduction` | `plot_deductions` | 起止剧情点转折桥梁演进、双路径方案比对、一键采纳 |
| **章节协同创作** | `src/components/pages/project/chapters/` | `/api/chapters` | `chapters`, `chapter_ai_chats` | 沉浸式写作、分卷导航、AI 续写与上下文联想 |
| **版本历史快照** | `.../drawer-version-history/` | `/api/chapters/versions` | `chapter_versions` | 编辑历史回滚、快照对比 |
| **记忆碎片灵感** | `.../drawer-memory-fragments/` | `/api/chapters/fragments` | `memory_fragments` | 章节伏笔、灵感抓取、一键插入正文 |
| **素材资料库** | `src/components/pages/project/materials/` | `/api/materials` | `materials` | 资料沉淀、分类检索、AI 自动摘要与知识提取 |
| **灵感随手笔记** | `src/components/pages/project/notes/` | `/api/notes` | `notes` | 三栏卡片式极简笔记 |
