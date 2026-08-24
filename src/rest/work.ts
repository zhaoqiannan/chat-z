import { get, post } from "@/utils/rest";

export const WorkApi = {
  list: '/api/works',       // 获取作品列表
  create: '/api/works',     // 新建作品
};

export interface CreateWorkPayload {
  title: string;
  tag: string;
  expectedWords?: string;
  description?: string;
  cover?: string;
}

export const getWorkList = async () => {
  return get(WorkApi.list);
};

export const createWork = async (data: CreateWorkPayload) => {
  return post(WorkApi.create, data);
};
