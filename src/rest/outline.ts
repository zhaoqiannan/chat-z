import { get, post, put, del } from "@/utils/rest";

export const OutlineApi = {
  list: "/api/outlines",
  create: "/api/outlines",
  update: "/api/outlines",
  delete: "/api/outlines",
  aiAssistant: "/api/ai/outline",
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
  parentId: string | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | string;
  title: string;
  orderIndex: number;
  goal: string;
  conflict?: string;
  eventDescription?: string;
  expectedOutcome?: string;
  characters?: string;
  locations?: string;
  foreshadowing?: string;
  linkedChapters?: number[];
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
  children?: OutlineNode[];
}

export interface CreateOutlinePayload {
  workId: number | string;
  parentId?: string | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | string;
  title: string;
  goal: string;
  conflict?: string;
  eventDescription?: string;
  expectedOutcome?: string;
  characters?: string;
  locations?: string;
  foreshadowing?: string;
  linkedChapters?: number[];
  remarks?: string;
  orderIndex?: number;
}

export interface UpdateOutlinePayload {
  id: string;
  title?: string;
  type?: OutlineNodeType;
  pointType?: PlotPointType | string;
  goal?: string;
  conflict?: string;
  eventDescription?: string;
  expectedOutcome?: string;
  characters?: string;
  locations?: string;
  foreshadowing?: string;
  linkedChapters?: number[];
  remarks?: string;
  parentId?: string | null;
  orderIndex?: number;
}

export type OutlineAiAction =
  | "generate_from_premise"   // 一句话/梗概生成大纲
  | "expand_node"             // 扩写当前节点
  | "split_node"              // 拆分一个节点为多个情节点
  | "plan_chapters"           // 根据卷大纲生成章节规划
  | "check_mainline"          // 检查主线完整度
  | "check_conflict"          // 检查冲突密度
  | "check_pacing"            // 检查故事节奏
  | "alternative_plots";      // 提供替代剧情方案

export interface OutlineAiPayload {
  workId: number | string;
  action: OutlineAiAction;
  premise?: string;
  targetNodeId?: string;
  targetNode?: Partial<OutlineNode>;
  additionalPrompt?: string;
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
