// REST: 项目总纲（思维导图 / 表格双视图树状数据）接口封装
import { get, post, put } from "@/utils/rest";

export type MasterOutlineStatus = "planned" | "in_progress" | "completed";
export type MasterOutlineSide = "left" | "right";

export interface MasterOutlineLogicSuggestion {
  targetNodeTitle: string;
  problem: string;
  suggestion: string;
}

export interface MasterOutlineRecommendedStep {
  step: number;
  title: string;
  note: string;
}

export interface MasterOutlineLogicDeduction {
  updatedAt: number;
  logicLine: string; // 1. 逻辑线梳理
  hasIssues: boolean; // 2. 是否有问题
  issueConclusion: string; // 2. 总体判断结论
  logicHoles: string[]; // 3. 是否存在逻辑漏洞
  optimizablePoints: string[]; // 4. 是否存在可优化部分
  optimizationSuggestions: MasterOutlineLogicSuggestion[]; // 5. 有问题的地方的优化建议
  recommendedLogicLine: MasterOutlineRecommendedStep[]; // 6. 建议最终修改逻辑线
}

export interface MasterOutlineNode {
  id: string;
  title: string;
  tag?: string; // 自由标签：卷 / 主线 / 支线 / 高潮 / 伏笔 / 副本 等
  note?: string; // 要点说明
  chapterRange?: string; // 关联章节范围，如 "1-20" 或 "第1-20章"
  status?: MasterOutlineStatus;
  side?: MasterOutlineSide; // 仅总纲直属一级子节点使用，默认 "right"
  collapsed?: boolean;
  width?: number; // 自定义画布节点宽度
  height?: number; // 自定义画布节点高度
  logicDeduction?: MasterOutlineLogicDeduction; // 仅保留最近一次 AI 逻辑推算结果
  children: MasterOutlineNode[];
}

export const getMasterOutline = async (workId: number | string): Promise<{
  success: boolean;
  result?: { tree: MasterOutlineNode; updatedAt?: number | null; isDefault?: boolean };
  message?: string;
}> => {
  return get(`/api/outlines/master?workId=${workId}`);
};

export const saveMasterOutline = async (payload: {
  workId: number | string;
  tree: MasterOutlineNode;
}): Promise<{ success: boolean; message?: string }> => {
  return put(`/api/outlines/master`, payload);
};

export const generateMasterOutlineAi = async (payload: {
  workId: number | string;
  prompt?: string;
}): Promise<{ success: boolean; result?: { tree: MasterOutlineNode }; message?: string }> => {
  return post(`/api/ai/outline/master`, payload);
};

export const deduceMasterOutlineLogicAi = async (payload: {
  workId: number | string;
  targetNode: MasterOutlineNode;
  rootSummary?: string;
}): Promise<{ success: boolean; result?: MasterOutlineLogicDeduction; message?: string }> => {
  return post(`/api/ai/outline/master/logic-deduction`, payload);
};
