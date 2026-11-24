# 团队开发规范与规则指南

本项目基于 Next.js、React 19 以及 Mantine UI (v7+) 构建。所有 AI 辅助编程及代码实现均须严格遵循以下规范。

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

- **尺寸控制**：
    - 宽度：`w={44}`、`w="100%"` 代替 `style={{ width: ... }}`
    - 高度：`h={44}`、`h="100%"` 代替 `style={{ height: ... }}`
    - 极值尺寸：`miw`, `maw`, `mih={280}`, `mah` 代替 `minWidth`, `maxHeight` 等
- **背景与边框**：
    - 背景色：`bg="#fafbfc"` 代替 `style={{ backgroundColor: ... }}`
    - 边框：`bd="1px solid #f0f0f0"`、`bd="1px dashed #e5e6eb"` 代替 `style={{ border: ... }}`
    - 圆角：`bdrs={10}`、`bdrs="50%"` 或在支持的组件上使用 `radius="md"` 代替 `style={{ borderRadius: ... }}`
- **排版与文字**：
    - 文本对齐：`ta="center"` 代替 `style={{ textAlign: "center" }}`
    - 行高：`lh={1.6}` 代替 `style={{ lineHeight: 1.6 }}`
    - 字体粗细与颜色：`fw={600}`、`c="#1d1d1f"` 代替内联 `color`、`fontWeight`
- **弹性盒属性**：
    - `flex={1}` 代替 `style={{ flex: 1 }}`

> **注**：仅对 Mantine Style Props 不支持的高级 CSS 属性（如 `boxShadow`、复杂的 `linear-gradient`、`fontVariantNumeric`、`borderBottom` 单边特殊样式等）保留在 `style={{ ... }}` 中。

### 1.3 组件标签排版规范（单行优先）

- 对于仅包含常规 Mantine Style Props（未包含复杂 `style` 对象、复杂事件回调或长配置项）的组件标签，**不折行**，保持单行紧凑书写：
    ```tsx
    // 推荐
    <Box p={12} bdrs={12} pos="relative" flex={2} miw={0} bg="#F8FAFC" bd="1px solid #E2E8F0">
    ```

### 1.4 动态样式与 SCSS 模块化规范

- **复杂条件样式抽离**：页面中通过变量切换的动态样式，若涉及**超过 2 个样式属性**，严禁在 JSX 中用三目运算符拼接内联样式或多属性 Props，必须创建同级 `style.module.scss` 并通过 `className` / `classNames` 控制。
- **SCSS 语法与模块分离**：样式文件统一使用 `.scss`（`style.module.scss`），充分利用 SCSS 嵌套、变量与局部模块化组织，保持组件结构与样式职责分离。

### 1.5 Loading 状态组件规范

- **严禁**在业务组件中直接使用并重复配置 Mantine 的 `<LoadingOverlay />`。
- 统一使用公共组件 [`@/components/common/loading`](file:///home/zhaoqiannan/sage-frontend/src/components/common/loading/index.tsx)（空容器态切换加载）或 [`@/components/common/loading-mask`](file:///home/zhaoqiannan/sage-frontend/src/components/common/loading-mask/index.tsx)（遮罩态加载，保留已有 DOM 内容并覆盖半透明加载层）。

### 1.6 视觉与主色调规范

- **项目全局主色调**：`#00c9ff`（对应 Mantine 主题默认 `primaryColor`，半透明背景/边框可使用 `rgba(0, 201, 255, 0.1)` / `rgba(0, 201, 255, 0.4)`）。
- 页面中的主按钮、选中高亮边框、激活态图标、Tab 指示条等品牌强调色统一使用 `#00c9ff`（Mantine 组件如 `Button`、`Tabs`、`ActionIcon` 默认即继承该主色调，禁止随意指定 `color="teal"` 等非规范主色）。

### 1.7 表单状态与校验规范

- **优先使用表单内置校验**：在没有特殊强调的情况下，表单的状态管理与验证校验**一律以 `@mantine/form`（`useForm`、`validate`、`isNotEmpty`、`form.getInputProps`、`form.onSubmit`、`form.errors`）内置机制为主**。
- **禁止手写冗余 Error State**：严禁使用多个独立的 `useState` 配合手动拼装 `errors` / `nextErrors` 对象来进行常规表单校验。
- **必填星号使用 `withAsterisk` 而非 `required`**：在 `<form>` 内使用 Mantine 输入组件（如 `TextInput`、`Select`）时，仅使用 `withAsterisk` 展示必填红星（或配合 `<form noValidate>`），**禁止**直接传入原生 `required` 属性，以免触发浏览器自带的原生气泡提示拦截 `form.onSubmit`。

---

## 2. 图表 (Highcharts) 开发与视觉标准规范

### 2.1 原生图表元素优先，禁止手写外部图例/柱条

- 除非需求明确要求自定义外部图例或外部 HTML 柱条，否则**严禁**在图表外部手写 DOM 图例（Legend）或用 `<Box>` / `<Progress>` 模拟柱状图；**必须**默认开启并使用 Highcharts 原生 `legend` 与 `bar` / `column` 序列。

### 2.2 图表统一视觉标准（全局配置于 `src/contexts/highchart.tsx`）

所有 Highcharts 图表的默认基础视觉规范已统一配置在 [`src/contexts/highchart.tsx`](file:///home/zhaoqiannan/sage-frontend/src/contexts/highchart.tsx) 的 `Highcharts.setOptions({...})` 中。**业务组件中严禁重复声明与全局默认一致的 `backgroundColor: 'transparent'`、`title: { text: '' }`、`subtitle: { text: '' }`、`credits: { enabled: false }`、`exporting: { enabled: false }`、轴线/网格线色号或基础 `tooltip` 样式**，仅需传入当前图表特有的业务数据与差异化覆盖项：

- **图表画布 (`chart`)**：默认 `backgroundColor: "transparent"`，`title: { text: "" }`，`subtitle: { text: "" }`，`credits: { enabled: false }`，`exporting: { enabled: false }`。
- **坐标轴 (`xAxis` / `yAxis`)**：
    - 轴线与刻度线色值：默认 `#e8e8e8`（无轴线场景传 `lineWidth: 0, tickLength: 0` 覆盖）。
    - 网格线（`yAxis`）：默认 `gridLineColor: "#f0f0f0"`，`gridLineDashStyle: "Dash"`，`gridLineWidth: 1`。
    - 轴标签文字：X 轴主标签默认 `color: "#666"`、`fontSize: "12px"`；Y 轴标签默认 `color: "#999"`、`fontSize: "11px"`。
- **图例 (`legend`)**：默认开启原生图例（`enabled: true, align: "left", verticalAlign: "top"`），`itemStyle: { color: "#666", fontSize: "12px", fontWeight: "normal" }`，`symbolRadius: 2`，`symbolWidth: 10`，`symbolHeight: 10`；单序列无需图例时传 `legend: { enabled: false }` 覆盖。
- **柱体样式 (`plotOptions.bar` / `column`)**：默认 `borderWidth: 0`，`borderRadius: 4`，数据标签默认 `style: { fontSize: "12px", fontWeight: "600", color: "#333", textOutline: "none" }`。
- **提示框 (`tooltip`)**：默认 `backgroundColor: "rgba(255, 255, 255, 0.98)"`，`borderColor: "#e8e8e8"`，`borderRadius: 6`，`shadow: true`，文字主色 `#333`、字号 `12px`。

---

## 3. JS / TS 逻辑与数据处理规范

### 3.1 低复杂度算法优先

- 数据聚合、排序、筛选、映射等逻辑优先采用低时间/空间复杂度算法（如单趟遍历 $O(N)$、`Map`/`Set` 索引查找 $O(1)$），避免多重嵌套循环或重复遍历同一数组。

### 3.2 禁止冗余过渡变量与严禁伪造默认值

- **禁止定义大量一次性容错过渡变量**：对于接口返回后无需复杂二次计算的展示字段，严禁在组件顶部声明大量如 `esgScoreText`、`lowRatingPctText` 等仅用于判空/格式化的中间变量。可在组件内定义简短复用函数（如 `const toPct = (v: unknown) => formatToPercentageUnit(v, 2, false)`）或直接在 JSX 中调用公共格式化工具（`fix`、`thousand`、`formatToPercentageUnit`）并传入原始字段。
- **严禁伪造冗余默认值（严格）**：接口未返回数据或字段为空时，**就是没有数据**（直接展示空状态组件或由格式化函数输出 `'--'`）。**严禁**在前端捏造虚假默认结构（如 `createEmptyEsgData`）、默认假年份、或将缺失指标硬编码回退为 `0`。

### 3.3 接口请求与表格配置规范

- **请求参数前置处理**：所有列表与分析接口请求参数，**必须**统一使用 [`getReqFormateParams`](file:///home/zhaoqiannan/sage-frontend/src/utils/params-format.ts) 进行前置格式化处理。
- **`TableLoader` 配置抽离**：所有 [`TableLoader`](file:///home/zhaoqiannan/sage-frontend/src/components/common/table-load/index.tsx) 组件的列定义（`dynamicTh` / `dynamicTb`）及相关静态配置项，**必须**抽离至 `src/config/` 对应的模块配置文件中，严禁直接写在业务组件内部。

---

## 4. 数据分类与配置字典规范 (Key 驱动原则)

### 4.1 严禁按展示文本（Label）维护平行字典

- **严禁**维护多份以中/英文字符串（如 `"烟尘"`、`"Smoke"`、`"气体"`）为 key 的独立映射表。
- 必须基于语义化 **Canonical Key**（例如：`smoke`, `gas`, `liquid`, `organic` 等，与后端及数据字典定义对齐）建立**单一集中配置项**：

    ```ts
    export interface PropertyItemConfig {
        labelKey: string; // 对应 locales 中的 i18n key
        color: string; // 图表/徽标色值
    }

    export const PROPERTY_CONFIG: Record<string, PropertyItemConfig> = {
        gas: { labelKey: "stock.pollution.statsType.gas", color: "#00C9FF" },
        smoke: { labelKey: "stock.pollution.statsType.smoke", color: "#FAC344" },
    };
    ```

### 4.2 直接 Key 取值与默认降级规范

- **禁止**添加冗余的 `aliases` 别名配置或多重循环兜底。
- 直接通过 Key 获取配置；若传入数据未在配置项中定义，直接展示其传入内容，颜色统一回退至默认灰色（如 `#86909c`）：
    ```ts
    const meta = PROPERTY_CONFIG[rawKey];
    const displayName = meta?.labelKey ? i18n(meta.labelKey) : rawKey;
    const color = meta?.color || "#86909c";
    ```

---

## 5. 国际化与空状态交互规范

### 5.1 词条管理

- 页面所有展示文案必须通过 `useI18nHook` 国际化，严禁在业务组件中直接写死中文/英文硬编码文本。
- 优先复用已有词条，新增词条必须在 `src/i18n/locales/zh/` 和 `src/i18n/locales/en/` 中保持双语同步。

### 5.2 图表与板块空数据状态

- 当图表无数据或未满足筛选条件时，使用统一规范的空状态容器展示：
    - 占位文案必须与产品设计一致（例如：提示选择单个污染物或特定提示语）。
    - 空状态容器统一使用 `flex={1} mih={280} c="#86909c"` 或公共 `<NoData />` 组件，避免硬编码乱象。

---

## 6. 代码格式与模块导入规范

### 6.1 Import 语句单行书写规范

- 同一个模块/包下的具名导入（如 `@mantine/core`、`react-icons/*` 等）**一律保持在单行内书写，禁止拆分为多行换行**：
    ```ts
    // 正确示例
    import {
        ActionIcon,
        Box,
        Button,
        Center,
        Flex,
        Group,
        SimpleGrid,
        Stack,
        Tabs,
        Text,
        TextInput,
        Tooltip,
    } from "@mantine/core";
    import {
        LuCheckCircle2,
        LuCircle,
        LuFileSpreadsheet,
        LuMapPin,
        LuPanelLeftClose,
        LuPanelLeftOpen,
        LuShield,
        LuTrendingDown,
        LuWaves,
    } from "react-icons/lu";
    ```

### 6.2 JSX 组件样式与布局属性单行书写规范

- JSX 组件标签上的样式、布局及常规配置属性（如 `align`、`justify`、`mt`、`pt`、`w`、`h`、`bg`、`bd`、`bdrs`、`style` 等，**除事件绑定属性外**）**一律合并在同一行内书写，禁止将各个样式属性拆分为多行**：

    ```tsx
    // 正确示例（无事件时全部单行）
    <Flex align="center" justify="space-between" mt={10} pt={8} style={{ borderTop: "1px solid #f0f0f0" }}>

    // 正确示例（含事件时，样式配置保持在一行，事件可独立或紧随）
    <ActionIcon variant="default" size={30} radius={8} onClick={() => setCollapsed(true)}>
    ```

### 6.3 尊重并保留用户手动修改规范（增量修改原则）

- **严禁覆盖或回退用户的手动修改**：在对任何已有文件进行调整前，**必须先读取文件的最新内容**，以用户当前的手动修改与代码状态为唯一基准。
- **优先使用局部增量编辑（`edit_file`）**：修改现有文件时，仅针对需要变更的目标代码行进行精准替换，**严禁**使用全量覆写（`write_file`）将用户已删减的样式、注释掉的代码或手动调整的结构改回旧版本。
