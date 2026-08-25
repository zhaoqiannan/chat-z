import { get, post, put, del } from "@/utils/rest";

export const WorkApi = {
  list: '/api/works',       // 获取作品列表
  create: '/api/works',     // 新建作品
  update: '/api/works',     // 编辑作品 (PUT)
  delete: '/api/works',     // 删除作品 (DELETE)
};

export interface CreateWorkPayload {
  title: string;
  tag: string;
  expectedWords?: number | string;
  description?: string;
  cover?: string;
}

export interface UpdateWorkPayload {
  id: number | string;
  title: string;
  tag: string;
  expectedWords?: number;
  description?: string;
  cover?: string;
  status?: string;
}

/**
 * 获取当前用户作品列表
 */
export const getWorkList = async () => get(WorkApi.list);

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
export const deleteWork = async (id: string) => del(WorkApi.delete, { id });
