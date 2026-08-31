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



