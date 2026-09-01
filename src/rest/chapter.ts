import { get, post, put, del } from "@/utils/rest";

export const ChapterApi = {
  list: "/api/chapters",
  create: "/api/chapters",
  update: "/api/chapters",
  delete: "/api/chapters",
  ai: "/api/ai/chapter",
};

export type ChapterStatus = "not_started" | "revising" | "completed";

export interface ChapterItem {
  id: number | string;
  workId: number | string;
  volumeId: number | string | null;
  isVolume: number;
  title: string;
  subtitle?: string;
  content: string;
  wordCount: number;
  chapterNumber: number;
  status: ChapterStatus;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateChapterPayload {
  workId: number | string;
  volumeId?: number | string | null;
  isVolume?: boolean | number;
  title: string;
  subtitle?: string;
  content?: string;
  status?: ChapterStatus;
  summary?: string;
}

export interface UpdateChapterPayload {
  id: number | string;
  title?: string;
  subtitle?: string;
  content?: string;
  status?: ChapterStatus;
  summary?: string;
  volumeId?: number | string | null;
  chapterNumber?: number;
}

export interface AiDraftPayload {
  workId: number | string;
  chapterId?: number | string;
  mode: "draft";
  overview: string;
  events?: string;
  plotDirection?: string;
  characters?: string;
  writingStyle?: string;
  targetWords?: number | string;
}

export interface AiOptimizePayload {
  workId: number | string;
  chapterId?: number | string;
  mode: "optimize";
  currentContent: string;
  optimizeGoal?: string;
}

export interface AiSelectionPayload {
  workId: number | string;
  chapterId?: number | string;
  mode: "selection_ai";
  selectedText: string;
  actionType: "polish" | "expand" | "shorten" | "enrich_desc" | "dialogue" | "custom";
  customInstruction?: string;
  fullContext?: string;
}

export const getChapterList = async (workId: string) => {
  return get(ChapterApi.list, { workId });
};

export const createChapter = async (data: CreateChapterPayload) => {
  return post(ChapterApi.create, data);
};

export const updateChapter = async (data: UpdateChapterPayload) => {
  return put(ChapterApi.update, data);
};

export const deleteChapter = async (id: string) => {
  return del(ChapterApi.delete, { id });
};

export const requestChapterAiDraft = async (data: AiDraftPayload) => {
  return post(ChapterApi.ai, data);
};

export const requestChapterAiOptimize = async (data: AiOptimizePayload) => {
  return post(ChapterApi.ai, data);
};

export const requestChapterSelectionAi = async (data: AiSelectionPayload) => {
  return post(ChapterApi.ai, data);
};

export interface ChapterAiHistoryItem {
  id: number;
  workId: number;
  chapterId: number;
  mode: "draft" | "optimize" | "selection_ai" | string;
  title: string;
  promptSummary?: string;
  content: string;
  wordCount: number;
  createdAt: string | number;
}

export const getChapterAiHistoryList = async (chapterId: number | string, workId?: number | string) => {
  return get(`/api/ai/chapter/history?chapterId=${chapterId}${workId ? `&workId=${workId}` : ""}`);
};

export const deleteChapterAiHistory = async (id: number | string) => {
  return del(`/api/ai/chapter/history`, { id });
};

export interface ContextTagOption {
  id: string | number;
  name: string;
  type: "character" | "location" | "faction" | "item" | "rule" | "outline" | "chapter" | string;
  desc?: string;
}

export interface ChapterAiChatItem {
  id: number;
  workId: number;
  chapterId: number;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  actionType: string;
  selectedText?: string;
  contextTags?: ContextTagOption[];
  applied: number;
  createdAt: string | number;
}

export interface SendChapterAiChatPayload {
  workId: number | string;
  chapterId: number | string;
  prompt?: string;
  actionType?: string;
  selectedText?: string;
  currentContent?: string;
  contextTags?: ContextTagOption[];
}

export const getWorkContextTagOptions = async (workId: number | string, chapterId?: number | string) => {
  return get(`/api/ai/chapter/context-tags?workId=${workId}${chapterId ? `&chapterId=${chapterId}` : ""}`);
};

export const getChapterAiChatList = async (chapterId: number | string) => {
  return get(`/api/ai/chapter/chat?chapterId=${chapterId}`);
};

export const sendChapterAiChat = async (data: SendChapterAiChatPayload) => {
  return post(`/api/ai/chapter/chat`, data);
};

export const applyChapterAiChat = async (id: number | string, applied: boolean = true) => {
  return fetch("/api/ai/chapter/chat", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, applied }),
  }).then((r) => r.json());
};

export const deleteChapterAiChat = async (id: number | string) => {
  return del(`/api/ai/chapter/chat`, { id });
};

export interface ChapterVersionItem {
  id: number;
  workId: number;
  chapterId: number;
  title: string;
  content: string;
  wordCount: number;
  versionTag?: string;
  createdAt: string | number;
}

export const getChapterVersionList = async (chapterId: number | string) => {
  return get(`/api/chapters/versions?chapterId=${chapterId}`);
};

export const createChapterVersion = async (data: {
  workId: number | string;
  chapterId: number | string;
  title: string;
  content: string;
  wordCount?: number;
  versionTag?: string;
}) => {
  return post(`/api/chapters/versions`, data);
};

export const deleteChapterVersion = async (id: number | string) => {
  return del(`/api/chapters/versions`, { id });
};

export interface MemoryFragmentItem {
  id: number;
  workId: number;
  chapterId?: number;
  title: string;
  content: string;
  sourceType: string;
  tags?: string;
  createdAt: string | number;
}

export const getMemoryFragmentList = async (workId: number | string, keyword?: string) => {
  return get(`/api/chapters/fragments?workId=${workId}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`);
};

export const createMemoryFragment = async (data: {
  workId: number | string;
  chapterId?: number | string;
  title?: string;
  content: string;
  sourceType?: string;
  tags?: string;
}) => {
  return post(`/api/chapters/fragments`, data);
};

export const deleteMemoryFragment = async (id: number | string) => {
  return del(`/api/chapters/fragments`, { id });
};

