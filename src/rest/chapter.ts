import { get, post, put, del } from "@/utils/rest";

export const ChapterApi = {
  list: "/api/chapters",
  create: "/api/chapters",
  update: "/api/chapters",
  delete: "/api/chapters",
  ai: "/api/chapters/ai",
};

export type ChapterStatus = "not_started" | "revising" | "completed";

export interface ChapterItem {
  id: string;
  workId: string;
  volumeId: string | null;
  isVolume: number;
  title: string;
  content: string;
  wordCount: number;
  chapterNumber: number;
  status: ChapterStatus;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateChapterPayload {
  workId: string;
  volumeId?: string | null;
  isVolume?: boolean | number;
  title: string;
  content?: string;
  status?: ChapterStatus;
  summary?: string;
}

export interface UpdateChapterPayload {
  id: string;
  title?: string;
  content?: string;
  status?: ChapterStatus;
  summary?: string;
  volumeId?: string | null;
  chapterNumber?: number;
}

export interface AiDraftPayload {
  workId: string;
  chapterId?: string;
  mode: "draft";
  overview: string;
  events?: string;
  plotDirection?: string;
  characters?: string;
  writingStyle?: string;
  targetWords?: number | string;
}

export interface AiOptimizePayload {
  workId: string;
  chapterId?: string;
  mode: "optimize";
  currentContent: string;
  optimizeGoal?: string;
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

