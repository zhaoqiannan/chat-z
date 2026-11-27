# 团队开发规范与规则指南（chat-z）

## 本项目基于 Next.js 16、React 19、Mantine UI v9、Drizzle ORM 与 Cloudflare Workers / D1 构建。所有 AI 辅助编程及代码实现均须严格遵循以下规范。

## 0. 核心编码红线（最高优先级）

- **切实优化修复，严禁堆叠代码打补丁**：定位并解决根因，追求更简洁、直接的实现；严禁为了绕过报错、Lint 规则或边界问题而层层叠加包装函数、自定义状态同步样板、防御性补丁或项目中并不存在的配置/环境变量。
- **优先复用框架与已有库能力**：优先使用项目已安装的成熟原语（如 Mantine Style Props、`@mantine/form`、`dayjs`、Drizzle ORM、`env.DB.batch`、`@/utils/text`、`@/utils/ownership`、Next.js App Router / React 19 原生特性），禁止在多处重复手写等价工具或订阅样板代码。
- **随手删除无用代码**：改动涉及的文件中，若存在冗余逻辑、失效兼容分支、未使用的导入/变量/参数/无效请求或已废弃的过渡代码，必须同步清理删除，让改动后的代码整体更精简、更清晰。

---

## 1. Mantine UI 组件与样式属性规范 (Style Props)

### 1.1 布局组件优先，严禁手写 Flex Box

- **禁止**使用 `<Box style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>`。
- **必须**直接使用 Mantine 原生的布局组件：
    - 居中对齐：`<Center>` 或 `<Flex align="center" justify="center">`。
    - 弹性布局：`<Flex>` 并结合 `direction`, `gap`, `justify`, `align`, `wrap` 等原生属性。
    - 垂直排列：优先使用 `<Flex direction="column">` 或 `<Stack>`。

### 1.2 优先使用 Mantine 原生 Style Props，禁止冗余内联样式

只要 Mantine 原生支持对应样式属性，**一律不得**写入 `style={{ ... }}`：

- **尺寸控制**：`w`、`h`、`miw`、`maw`、`mih`、`mah` 代替内联宽高。
- **背景与边框**：`bg`、`bd`、`bdrs`（或组件 `radius`）代替 `backgroundColor`、`border`、`borderRadius`。
- **排版与文字**：`ta`、`lh`、`fw`、`fz`、`c` 代替内联排版属性。
- **弹性盒属性**：`flex={1}` 代替 `style={{ flex: 1 }}`。

> **注**：仅对 Mantine Style Props 不支持的高级 CSS 属性（如 `boxShadow`、复杂 `linear-gradient`、`borderBottom` 单边特殊样式等）保留在 `style={{ ... }}` 中。

### 1.3 组件标签排版规范（单行优先）

- 对于仅包含常规 Mantine Style Props（未包含复杂 `style` 对象、复杂事件回调或长配置项）的组件标签，**不折行**，保持单行紧凑书写：
    ```tsx
    <Box p={12} bdrs={12} pos="relative" flex={2} miw={0} bg="#F8FAFC" bd="1px solid #E2E8F0">
    ```

### 1.4 动态样式与 SCSS 模块化规范

- **复杂条件样式抽离**：页面中通过变量切换的动态样式，若涉及**超过 2 个样式属性**，严禁在 JSX 中用三目运算符拼接内联样式或多属性 Props，应抽离至同级 `style.module.scss` 并通过 `className` / `classNames` 控制。

### 1.5 Loading 状态组件规范

- **严禁**在业务组件中直接使用并重复配置 Mantine 的 `<LoadingOverlay />`。
- 统一使用公共组件 [`@/components/common/loading`](src/components/common/loading/index.tsx)（空容器态切换加载）或 [`@/components/common/loading-mask`](src/components/common/loading-mask/index.tsx)（遮罩态加载，保留已有 DOM 内容并覆盖半透明加载层）。

### 1.6 视觉与主色调规范

- **项目全局主色调**：`#00c9ff`（对应 Mantine 主题默认 `primaryColor`，半透明背景/边框可使用 `rgba(0, 201, 255, 0.1)` / `rgba(0, 201, 255, 0.4)`）。
- 页面中的主按钮、选中高亮边框、激活态图标、Tab 指示条等品牌强调色统一使用 `#00c9ff`（Mantine 组件如 `Button`、`Tabs`、`ActionIcon` 默认即继承该主色调）。

### 1.7 表单状态与校验规范

- **优先使用表单内置校验**：常规表单的状态管理与校验优先使用 `@mantine/form`（`useForm`、`validate`、`form.getInputProps`、`form.onSubmit`），避免手写多组冗余 `error` 状态。
- **必填星号使用 `withAsterisk` 而非原生 `required`**：在 `<form>` 内使用 Mantine 输入组件时，使用 `withAsterisk` 展示必填红星，避免原生气泡拦截 `form.onSubmit`。

---

## 2. JS / TS 逻辑与数据处理规范

### 2.1 低复杂度算法与状态管理优先

- 数据聚合、排序、筛选、查找优先采用 $O(N)$ 单趟遍历与 `Map`/`Set` 索引查找（$O(1)$），避免在循环或高频渲染中嵌套 `.find()` / `.some()`。
- Tab 切换页面必须按需加载当前激活 Tab 的最新数据；涉及跨组件状态共享时使用局部 React Context 或 Redux，禁止在父页面挂载时一次性预加载所有 Tab 的全量数据。
- 拖拽、缩放、滚轮等高频交互事件必须缓存容器 `getBoundingClientRect()` 并使用 `requestAnimationFrame` 节流，严禁每次 `mousemove` 触发同步重排或全量重新创建 `ResizeObserver` 回调。

### 2.2 禁止冗余过渡变量与严禁伪造默认值

- 接口未返回数据或字段为空时，直接展示空状态组件或占位符，严禁在前端捏造虚假默认统计数据或将缺失指标伪造为假值。
- 通用纯文本工具（去 HTML `stripHtml`、字数统计 `countWords`、时间格式化 `formatDateTime`、章节区间解析 `parseChapterRange`、安全剪贴板 `copyToClipboard`）统一复用 [`@/utils/text`](src/utils/text.ts)。

---

## 3. 后端 API、鉴权安全与 Cloudflare Workers / D1 规范

- **鉴权与多租户隔离**：所有业务 API 必须包裹 `withAuth`，并复用 [`@/utils/ownership`](src/utils/ownership.ts) 中的 `assertWorkOwnership` / `assertChapterOwnership` / `parseJsonBody` / `isSafeUrl` 进行所有权校验、JSON 安全解析与外链协议校验。
- **Cookie-only 鉴权**：登录与刷新接口仅通过 `HttpOnly` Cookie 维护会话，禁止向前端 JSON 返回 `accessToken` 或写入 `localStorage`。
- **数据库迁移与性能红线**：
  - 表结构与索引变更必须通过 `src/db/migrations/*.sql` 落地并同步更新 `src/db/schema.ts`，严禁在业务请求路径中执行运行时 `CREATE TABLE` / `ALTER TABLE` DDL。
  - 多表级联清理/更新优先使用 `env.DB.batch([...])` 保证原子性与最小往返；查询长文表时按需列投影，严禁将全书正文字段整表拉入 Worker 内存。
  - 密码哈希迭代次数需兼顾 Cloudflare Workers Free 计划 CPU 时间预算（当前 PBKDF2 15,000 次），严禁盲目调高导致登录超时。
- **AI 提示词与清洗红线**：所有富文本字段（如 `world_rules.mechanisms`、`materials.content`）注入 AI Prompt 前必须经 `stripHtml()` 清洗；结构化 JSON 输出使用 `parseStructuredJson`，小说正文输出使用 `cleanNovelStoryText`，分析问答输出使用 `cleanAnalysisText`。

---

## 4. 代码格式与增量修改规范

### 4.1 Import 语句单行书写规范

- 同一个模块/包下的具名导入（如 `@mantine/core`、`react-icons/*` 等）保持在单行内书写：
    ```ts
    import { ActionIcon, Box, Button, Center, Flex, Group, Stack, Tabs, Text, Tooltip } from "@mantine/core";
    import { FiCheck, FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
    ```

### 4.2 JSX 组件样式与布局属性单行书写规范

- JSX 组件标签上的样式、布局及常规配置属性（除复杂回调与事件绑定外）优先合并在单行内书写，保持结构清晰紧凑：
    ```tsx
    <Flex align="center" justify="space-between" mt={10} pt={8} style={{ borderTop: "1px solid #f0f0f0" }}>
    <ActionIcon variant="default" size={30} radius={8} onClick={() => setCollapsed(true)}>
    ```

### 4.3 尊重并保留用户手动修改规范（增量修改原则）

- **严禁覆盖或回退用户的手动修改**：在对任何已有文件进行调整前，**必须先读取文件的最新内容**，以用户当前的手动修改与代码状态为唯一基准。
- **优先使用局部增量编辑（`edit_file`）**：修改现有文件时，仅针对需要变更的目标代码行进行精准替换，避免无故覆盖用户已有结构与样式调整。
