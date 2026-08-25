import { OutlineNodeType, PlotPointType } from "@/rest/outline";

/**
 * 大纲节点层级类型配置
 */
export const OUTLINE_NODE_TYPE_OPTIONS: { value: OutlineNodeType; label: string }[] = [
  { value: "story", label: "故事主线" },
  { value: "volume", label: "卷 / 篇章" },
  { value: "act", label: "幕 / 阶段" },
  { value: "scene", label: "情节点" },
  { value: "branch", label: "支线 / 副本" },
];

/**
 * 情节点细分类型配置
 */
export const PLOT_POINT_TYPE_OPTIONS: { value: PlotPointType; label: string }[] = [
  { value: "conflict", label: "核心冲突" },
  { value: "twist", label: "剧情转折" },
  { value: "foreshadow", label: "伏笔铺垫" },
  { value: "climax", label: "情绪高潮" },
  { value: "transition", label: "日常过渡" },
  { value: "reveal", label: "悬念揭示" },
];
