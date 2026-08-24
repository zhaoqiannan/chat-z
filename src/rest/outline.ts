import { get, post, put, del } from "@/utils/rest";

export const OutlineApi = {
  list: "/api/outlines",
  create: "/api/outlines",
  update: "/api/outlines",
  delete: "/api/outlines",
  aiPlan: "/api/outlines/ai-plan",
};

export type OutlineNodeType = "volume" | "act" | "scene" | "event";

export interface OutlineNode {
  id: string;
  workId: string;
  parentId: string | null;
  type: OutlineNodeType;
  title: string;
  orderIndex: number;
  goal: string;
  conflict?: string;
  characters?: string;
  locations?: string;
  expectedOutcome?: string;
  linkedChapters?: string;
  createdAt?: string;
  updatedAt?: string;
  children?: OutlineNode[];
}

export interface CreateOutlinePayload {
  workId: string;
  parentId?: string | null;
  type: OutlineNodeType;
  title: string;
  goal: string;
  conflict?: string;
  characters?: string;
  locations?: string;
  expectedOutcome?: string;
  linkedChapters?: string;
  orderIndex?: number;
}

export interface UpdateOutlinePayload {
  id: string;
  title?: string;
  type?: OutlineNodeType;
  goal?: string;
  conflict?: string;
  characters?: string;
  locations?: string;
  expectedOutcome?: string;
  linkedChapters?: string;
  parentId?: string | null;
  orderIndex?: number;
}

/**
 * 获取指定作品的大纲节点列表
 */
export const getOutlineList = async (workId: string) => {
  return get(OutlineApi.list, { workId });
};

/**
 * 创建新大纲节点
 */
export const createOutlineNode = async (data: CreateOutlinePayload) => {
  return post(OutlineApi.create, data);
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
 * 请求 AI 进行智能大纲/章节规划
 */
export const requestAiPlan = async (workId: string, applyDirectly: boolean = false) => {
  return post(OutlineApi.aiPlan, { workId, applyDirectly });
};
