import { get, post, put, del } from "@/utils/rest";

export const OutlineApi = {
  list: "/api/outlines",
  create: "/api/outlines",
  update: "/api/outlines",
  delete: "/api/outlines",
  aiAssistant: "/api/ai/outline",
  history: "/api/ai/outline/history",
};

/** 大纲节点层级类型：故事主线 | 卷 | 幕 | 情节点 | 支线 | 事件 */
export type OutlineNodeType = "story" | "volume" | "act" | "scene" | "branch" | "event";

/** 情节点细分类型：冲突 | 转折 | 铺垫 | 高潮 | 过渡 | 揭示 */
export type PlotPointType =
  | "conflict"
  | "twist"
  | "foreshadow"
  | "climax"
  | "transition"
  | "reveal";

export interface OutlineNode {
  id: string;
  workId: number | string;
  parentId?: string | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | null;
  title: string;
  orderIndex: number;
  goal: string;
  conflict?: string | null;
  eventDescription?: string | null;
  expectedOutcome?: string | null;
  characters?: string | null;
  locations?: string | null;
  foreshadowing?: string | null;
  linkedChapters?: number[] | null;
  remarks?: string | null;
  createdAt?: string | number;
  updatedAt?: string | number;
  children?: OutlineNode[];
}

export interface CreateOutlinePayload {
  workId: number | string;
  parentId?: string | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | null;
  title: string;
  orderIndex?: number;
  goal: string;
  conflict?: string;
  eventDescription?: string;
  expectedOutcome?: string;
  characters?: string;
  locations?: string;
  foreshadowing?: string;
  linkedChapters?: number[];
  remarks?: string;
}

export interface UpdateOutlinePayload extends Partial<CreateOutlinePayload> {
  id: string;
}

export type OutlineAiAction =
  | "generate_from_premise"
  | "plan_chapters"
  | "expand_node"
  | "split_node"
  | "find_plot_holes"
  | "polish_rhythm"
  | "generate_alternatives"
  | "alternative_plots"
  | "check_mainline"
  | "check_conflict"
  | "check_pacing"
  | "diagnose";

export interface OutlineAiPayload {
  workId: number | string;
  action: OutlineAiAction;
  premise?: string;
  targetNodeId?: string;
  targetNode?: Partial<OutlineNode>;
  additionalPrompt?: string;
}

export interface OutlineAiHistoryRecord {
  id: number;
  workId: number;
  nodeId?: string | null;
  action: string;
  title: string;
  prompt?: string | null;
  resultPayload: any;
  createdAt: string | number;
}

/**
 * 获取指定作品的大纲节点列表
 */
export const getOutlineList = async (workId: string | number) => {
  return get(OutlineApi.list, { workId });
};

/**
 * 创建新大纲节点
 */
export const createOutlineNode = async (data: CreateOutlinePayload) => {
  return post(OutlineApi.create, data);
};

/**
 * 批量创建大纲节点（用于 AI 采纳时一键写入多节点）
 */
export const batchCreateOutlineNodes = async (workId: number | string, nodes: Partial<CreateOutlinePayload>[]) => {
  return post(OutlineApi.create, { batch: true, workId, nodes });
};

/**
 * 编辑大纲节点
 */
export const updateOutlineNode = async (data: UpdateOutlinePayload) => {
  return put(OutlineApi.update, data);
};

/**
 * 删除节点 (递归级联删除子节点)
 */
export const deleteOutlineNode = async (id: string) => {
  return del(OutlineApi.delete, { id });
};

/**
 * 请求大纲 AI 工作台处理
 */
export const requestOutlineAi = async (data: OutlineAiPayload) => {
  return post(OutlineApi.aiAssistant, data);
};

/**
 * 获取 AI 推演历史记录
 */
export const getOutlineAiHistoryList = async (workId: string | number, nodeId?: string) => {
  return get(OutlineApi.history, { workId, nodeId });
};

/**
 * 删除指定 AI 推演历史记录
 */
export const deleteOutlineAiHistoryRecord = async (id: number) => {
  return del(OutlineApi.history, { id });
};
