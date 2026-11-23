// REST: 项目总纲（思维导图 / 表格双视图树状数据）接口封装
import { get, post, put } from "@/utils/rest";

export type MasterOutlineStatus = "planned" | "in_progress" | "completed";

export interface MasterOutlineNode {
  id: string;
  title: string;
  tag?: string; // 自由标签：卷 / 主线 / 支线 / 高潮 / 伏笔 / 副本 等
  note?: string; // 要点说明
  chapterRange?: string; // 关联章节范围，如 "1-20" 或 "第1-20章"
  status?: MasterOutlineStatus;
  collapsed?: boolean;
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
