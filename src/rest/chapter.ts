import { get, post, put, patch, del, ensureTrailingSlash, refreshSession } from "@/utils/rest";

export const ChapterApi = {
  list: "/api/chapters",
  create: "/api/chapters",
  update: "/api/chapters",
  delete: "/api/chapters",
};

export type ChapterStatus = "not_started" | "revising" | "completed";

export type ChapterAiApplyMode =
  | "replace_selection"
  | "insert_after_selection"
  | "replace_full_chapter"
  | "readonly";

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
  outlineExtracted?: number;
  worldExtracted?: number;
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
  chapterNumber?: number;
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

export interface ContextTagOption {
  id: string | number;
  name: string;
  type: "character" | "location" | "faction" | "item" | "rule" | "outline" | "chapter" | "material" | string;
  desc?: string;
}

export interface ActiveAiTask {
  id: string | number;
  actionType: string;
  snippet: string;
  colorIndex: number;
  isPending?: boolean;
}

export const HIGHLIGHT_COLORS = [
  { bg: "rgba(147, 197, 253, 0.45)", border: "#60a5fa", tagBg: "#eff6ff", tagText: "#1d4ed8", name: "天蓝" },
  { bg: "rgba(167, 243, 208, 0.50)", border: "#4ade80", tagBg: "#f0fdf4", tagText: "#15803d", name: "青翠" },
  { bg: "rgba(253, 230, 138, 0.55)", border: "#facc15", tagBg: "#fefce8", tagText: "#a16207", name: "暖金" },
  { bg: "rgba(244, 114, 182, 0.40)", border: "#f472b6", tagBg: "#fdf2f8", tagText: "#be185d", name: "玫粉" },
  { bg: "rgba(196, 181, 253, 0.50)", border: "#a78bfa", tagBg: "#faf5ff", tagText: "#6b21a8", name: "紫罗兰" },
  { bg: "rgba(253, 186, 116, 0.50)", border: "#fb923c", tagBg: "#fff7ed", tagText: "#c2410c", name: "日落橙" },
  { bg: "rgba(94, 234, 212, 0.50)", border: "#2dd4bf", tagBg: "#f0fdfa", tagText: "#0f766e", name: "薄荷青" },
];

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
  applyMode?: ChapterAiApplyMode;
  createdAt: string | number;
}

export interface SendChapterAiChatPayload {
  workId: number | string;
  chapterId: number | string;
  prompt?: string;
  actionType?: string;
  subMode?: string;
  selectedText?: string;
  currentContent?: string;
  contextTags?: ContextTagOption[];
  stream?: boolean;
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

export const sendChapterAiChatStream = async (
  data: SendChapterAiChatPayload,
  callbacks: {
    onChunk: (chunk: string) => void;
    onDone?: (result: ChapterAiChatItem, applyMode: ChapterAiApplyMode) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> => {
  const baseApi = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const url = `${baseApi}${ensureTrailingSlash("/api/ai/chapter/chat")}`;

  const doFetch = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...data, stream: true }),
      signal,
    });

  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await refreshSession().catch(() => false);
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.message) msg = errJson.message;
    } catch {}
    throw new Error(msg);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const json = await res.json();
    if (json?.success && json.result) {
      callbacks.onChunk(json.result.content || "");
      callbacks.onDone?.(json.result, json.applyMode || "readonly");
      return;
    }
    throw new Error(json?.message || "AI 协同推演失败");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("响应流不可读");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const raw = trimmed.slice(5).trim();
    if (!raw || raw === "[DONE]") return;
    try {
      const evt = JSON.parse(raw);
      if (evt.chunk) {
        callbacks.onChunk(evt.chunk);
      } else if (evt.done && evt.result) {
        callbacks.onDone?.(evt.result, evt.applyMode || "readonly");
      } else if (evt.error) {
        callbacks.onError?.(evt.error);
      }
    } catch {}
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(handleLine);
  }
  if (buffer) handleLine(buffer);
};

export const applyChapterAiChat = async (id: number | string, applied: boolean = true) => {
  return patch(`/api/ai/chapter/chat`, { id, applied });
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
  return del(`/api/chapters/versions?id=${id}`, { id: Number(id) });
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
  return del(`/api/chapters/fragments?id=${id}`, { id: Number(id) });
};
