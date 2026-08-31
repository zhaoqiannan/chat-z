import { get, post, put, del } from "@/utils/rest";

// 1. 笔记相关类型与 API
export interface NoteData {
  id: number;
  workId: number;
  title: string;
  content: string;
  category: "memo" | "idea" | "todo" | "outline_ref" | string;
  isTodo: number;
  isCompleted: number;
  priority: "low" | "medium" | "high" | string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export const getNoteList = async (workId: number | string) => {
  return get(`/api/notes?workId=${workId}`);
};

export const createNote = async (data: Partial<NoteData> & { workId: number; title: string }) => {
  return post(`/api/notes`, data);
};

export const updateNote = async (data: Partial<NoteData> & { id: number }) => {
  return put(`/api/notes`, data);
};

export const deleteNote = async (id: number) => {
  return del(`/api/notes`, { id });
};

// 2. 素材相关类型与 API
export interface MaterialData {
  id: number;
  workId: number;
  title: string;
  category: "knowledge" | "reference" | "photo" | "doc" | string;
  content?: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  tags?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export const getMaterialList = async (workId: number | string) => {
  return get(`/api/materials?workId=${workId}`);
};

export const createMaterial = async (data: Partial<MaterialData> & { workId: number; title: string }) => {
  return post(`/api/materials`, data);
};

export const updateMaterial = async (data: Partial<MaterialData> & { id: number }) => {
  return put(`/api/materials`, data);
};

export const deleteMaterial = async (id: number) => {
  return del(`/api/materials`, { id });
};

// 3. 时间线相关类型与 API
export interface TimelineData {
  id: number;
  workId: number;
  title: string;
  description?: string;
  isMain: number;
  color?: string;
}

export interface TimelineEventData {
  id: number;
  timelineId: number;
  workId: number;
  timePoint: string;
  sortOrder: number;
  title: string;
  location?: string;
  characters?: string;
  impactLevel: "climax" | "major" | "normal" | "minor" | string;
  description?: string;
  createdAt?: string | number;
}

export const getTimelineFullData = async (workId: number | string) => {
  return get(`/api/timelines?workId=${workId}`);
};

export const createTimeline = async (data: { workId: number; title: string; description?: string; color?: string; isMain?: boolean }) => {
  return post(`/api/timelines`, { ...data, type: "timeline" });
};

export const createTimelineEvent = async (data: Partial<TimelineEventData> & { timelineId: number; workId: number; title: string; timePoint: string }) => {
  return post(`/api/timelines`, { ...data, type: "event" });
};

export const updateTimeline = async (data: Partial<TimelineData> & { id: number }) => {
  return put(`/api/timelines`, { ...data, type: "timeline" });
};

export const updateTimelineEvent = async (data: Partial<TimelineEventData> & { id: number }) => {
  return put(`/api/timelines`, { ...data, type: "event" });
};

export const deleteTimeline = async (id: number) => {
  return del(`/api/timelines`, { id, type: "timeline" });
};

export const deleteTimelineEvent = async (id: number) => {
  return del(`/api/timelines`, { id, type: "event" });
};

// 4. 角色关系相关类型与 API
export interface CharacterRelationData {
  id: number;
  workId: number;
  sourceCharId: number;
  sourceCharName: string;
  targetCharId: number;
  targetCharName: string;
  relationType: string;
  relationTag: "friendly" | "hostile" | "romantic" | "family" | "neutral" | string;
  description?: string;
  createdAt?: string | number;
}

export interface RelationGraphCharNode {
  id: number;
  name: string;
  avatarUrl?: string;
  roleType?: string;
  faction?: string;
}

export const getRelationGraphData = async (workId: number | string) => {
  return get(`/api/relations?workId=${workId}`);
};

export const createCharacterRelation = async (data: Partial<CharacterRelationData> & {
  workId: number;
  sourceCharId: number;
  sourceCharName: string;
  targetCharId: number;
  targetCharName: string;
  relationType: string;
}) => {
  return post(`/api/relations`, data);
};

export const updateCharacterRelation = async (data: Partial<CharacterRelationData> & { id: number }) => {
  return put(`/api/relations`, data);
};

export const deleteCharacterRelation = async (id: number) => {
  return del(`/api/relations`, { id });
};

// 5. 项目设置相关 API
export const getProjectDetailSettings = async (workId: number | string) => {
  return get(`/api/project/settings?workId=${workId}&action=detail`);
};

export const updateProjectSettings = async (data: {
  id: number | string;
  title?: string;
  tag?: string;
  targetWords?: number;
  description?: string;
  coverUrl?: string;
  status?: string;
}) => {
  return put(`/api/project/settings`, data);
};
