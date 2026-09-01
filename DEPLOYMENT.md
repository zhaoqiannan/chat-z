# Chat-Z 项目部署与数据库同步指南

本项目基于 **Next.js 16 (App Router)** + **OpenNext (@opennextjs/cloudflare)** 构建，后端直接运行在 **Cloudflare Workers** 边缘运行时，数据库使用 **Cloudflare D1 (Serverless SQLite)**，AI 模块绑定 **Cloudflare Workers AI**。

---

## 线上访问地址

- **生产环境 URL**：[https://chat.chat-z.workers.dev](https://chat.chat-z.workers.dev)
- **绑定的资源**：
  - `env.DB` -> Cloudflare D1 Database (`chat_db`, ID: `69859367-bc53-4412-809c-811a24151ba6`)
  - `env.AI` -> Cloudflare Workers AI
  - `env.ASSETS` -> 静态资源分发网络

---

## 部署流程与常用命令

### 1. 本地开发与联调
```bash
# 启动本地 Next.js 开发服务器 (端口 3146)
npm run dev
```

### 2. 数据库迁移与同步 (Cloudflare D1)

所有数据库变更文件存放于 `src/db/migrations/`：
- `0000_init.sql`：基础作品、章节、世界观表
- `0001_create_outlines.sql`：大纲树与节点
- `0002_update_chapters.sql`：章节分卷属性
- `0003_update_expected_words.sql`：字数与统计格式
- `0004_create_chapter_ai_chats.sql`：AI 协同创作问答记录
- `0005_update_characters_notes_materials.sql`：角色扩展、三栏笔记、素材资料库、时间线与关系表
- `0006_create_versions_and_fragments.sql`：修改版本历史快照、记忆碎片灵感库表

**执行数据库同步到线上**：
```bash
# 查看并应用待执行的迁移到线上 D1 数据库
npx wrangler d1 migrations apply chat_db --remote

# 或直接执行 SQL 脚本到线上
npx wrangler d1 execute chat_db --remote --file=src/db/migrations/0005_update_characters_notes_materials.sql
```

### 3. 一键打包并部署到线上 (Cloudflare Workers)

```bash
# 执行完整打包 (OpenNext 构建 + 静态资源上传 + Worker 部署)
npm run deploy
```
该命令会自动执行：
1. `next build --webpack`：构建 Next.js 生产产物；
2. `opennextjs-cloudflare build`：适配 Worker 边缘运行时与静态资源收集；
3. `opennextjs-cloudflare deploy`：上传至 Cloudflare 边缘网络并完成路由生效。

---

## 架构与核心功能清单

| 功能模块 | 前端组件位置 | 后端 API 路由 | 数据库表 |
| :--- | :--- | :--- | :--- |
| **角色档案库** | `src/components/pages/project/world/characters/` | `/api/characters` | `characters` |
| **灵感笔记工作台** | `src/components/pages/project/notes/` | `/api/notes` | `notes` |
| **素材资料库** | `src/components/pages/project/materials/` | `/api/materials` & `/ai-summary` | `materials` |
| **章节协同写作** | `src/components/pages/project/chapters/` | `/api/chapters` & `/api/ai/chapter` | `chapters`, `chapter_ai_chats` |
| **版本修改历史** | `.../drawer-version-history/` | `/api/chapters/versions` | `chapter_versions` |
| **记忆碎片灵感库** | `.../drawer-memory-fragments/` | `/api/chapters/fragments` | `memory_fragments` |
| **大纲剧情树** | `src/components/pages/project/outline/` | `/api/outlines` | `outlines` |
