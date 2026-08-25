import { get, post, put, del } from "@/utils/rest";

export const WorkApi = {
  list: '/api/works',       // 获取作品列表或单本详情
  create: '/api/works',     // 新建作品
  update: '/api/works',     // 编辑作品 (PUT)
  delete: '/api/works',     // 删除作品 (DELETE)
};

export interface WorkItem {
  id: number | string;
  userId?: string;
  title: string;
  tag: string;
  expectedWords?: number;
  expectedChapters?: number;
  wordCount?: number;
  chapterCount?: number;
  progress?: number;
  status?: string;
  cover?: string;
  description?: string;
  isPinned?: number;
  pinnedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkPayload {
  title: string;
  tag: string;
  expectedWords?: number | string;
  expectedChapters?: number | string;
  description?: string;
  cover?: string;
  isPinned?: boolean | number;
}

export interface UpdateWorkPayload {
  id: number | string;
  title?: string;
  tag?: string;
  expectedWords?: number;
  expectedChapters?: number;
  description?: string;
  cover?: string;
  status?: string;
  isPinned?: boolean | number;
}

/**
 * 获取当前用户作品列表
 */
export const getWorkList = async () => get(WorkApi.list);

/**
 * 获取单本小说作品详情
 */
export const getWorkDetail = async (id: string | number) => get(WorkApi.list, { id });

/**
 * 创建新作品
 */
export const createWork = async (data: CreateWorkPayload) => post(WorkApi.create, data);

/**
 * 更新/编辑作品
 */
export const updateWork = async (data: UpdateWorkPayload) => put(WorkApi.update, data);

/**
 * 删除作品 (包含级联章节)
 */
export const deleteWork = async (id: string | number) => del(WorkApi.delete, { id });
