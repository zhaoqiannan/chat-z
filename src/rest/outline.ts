// REST: 故事大纲管理、双向章节故事轴与 AI A➔B 剧情推演接口封装
import { get, post, put, del } from "@/utils/rest";

export const OutlineApi = {
  list: "/api/outlines",
  create: "/api/outlines",
  update: "/api/outlines",
  delete: "/api/outlines",
  aiAssistant: "/api/ai/outline",
  history: "/api/ai/outline/history",
  deductAi: "/api/ai/plot-deduction",
  deductions: "/api/plot-deductions",
  extractOutline: "/api/ai/chapter/extract-outline",
};

export type OutlineNodeType = "scene" | "volume" | "act" | "branch" | "bridge" | "story";
export type PlotPointType = "conflict" | "twist" | "foreshadow" | "climax" | "transition" | "reveal";
export type OutlineStatus = "completed" | "in_progress" | "planned";

export interface EnrichedCharacter {
  id: number;
  name: string;
  roleType: string;
  identity?: string;
  avatarUrl?: string | null;
  tags: string[];
  characterArc?: string;
}

export interface EnrichedNote {
  id: number;
  title: string;
  category: string;
  content: string;
  isPinned?: number;
  priority?: string;
  updatedAt?: string | number;
}

export interface OutlineNode {
  id: number | string;
  workId: number | string;
  parentId?: number | string | null;
  volumeId?: number | string | null;
  chapterId?: number | null;
  chapterNumber?: number | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | null;
  status: OutlineStatus | string;
  isFromChapter: number;
  title: string;
  orderIndex: number;

  // 大白话 4 要素
  event?: string | null;
  twist?: string | null;
  nextGoal?: string | null;
  suspense?: string | null;

  content?: string | null;
  wordCountEstimate?: number;

  linkedCharacterIds?: number[];
  linkedNoteIds?: number[];
  linkedCharacters?: EnrichedCharacter[];
  linkedNotes?: EnrichedNote[];

  // 兼容与扩展字段
  children?: OutlineNode[];
  goal?: string | null;
  conflict?: string | null;
  eventDescription?: string | null;
  expectedOutcome?: string | null;
  characters?: string | null;
  locations?: string | null;
  foreshadowing?: string | null;
  linkedChapters?: number[] | null;
  remarks?: string | null;

  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface CreateOutlinePayload {
  workId: number | string;
  parentId?: number | string | null;
  volumeId?: number | string | null;
  chapterId?: number | null;
  chapterNumber?: number | null;
  type?: OutlineNodeType;
  pointType?: PlotPointType | null;
  status?: OutlineStatus | string;
  isFromChapter?: number;
  title: string;
  event?: string;
  twist?: string;
  nextGoal?: string;
  suspense?: string;
  content?: string;
  wordCountEstimate?: number;
  linkedCharacterIds?: number[];
  linkedNoteIds?: number[];
  orderIndex?: number;

  // 兼容旧字段
  goal?: string;
  conflict?: string;
  eventDescription?: string;
  expectedOutcome?: string;
  characters?: string;
  locations?: string;
  foreshadowing?: string;
  linkedChapters?: number[];
  remarks?: string;
}

export interface UpdateOutlinePayload extends Partial<CreateOutlinePayload> {
  id: number | string;
}

export interface PlotDeductionStep {
  stepIndex?: number;
  title: string;
  event: string;
  twist?: string;
  nextGoal?: string;
  suspense?: string;
  characterAction?: string;
  estimatedWords?: number;
  // 兼容旧字段
  content?: string;
  keyConflict?: string;
}

export interface PlotDeductionPath {
  id: number;
  title: string;
  style: string;
  summary: string;
  steps: PlotDeductionStep[];
}

export interface PlotDeductionResult {
  paths: PlotDeductionPath[];
}

export interface PlotDeductionPayload {
  workId: number | string;
  startPoint: string;
  targetPoint: string;
  estimatedWords?: number;
  stepCount?: number;
  selectedCharacterIds?: number[];
  selectedNoteIds?: number[];
  pacePreference?: "standard" | "twist" | "dark" | string;
  involvedCharacters?: string;
}

export interface PlotDeductionRecord {
  id: number;
  workId: number;
  userId: string;
  startPoint: string;
  targetPoint: string;
  involvedCharacters?: string | null;
  pacePreference?: string | null;
  stepCount?: number;
  generatedPaths: PlotDeductionPath[];
  selectedPathIndex?: number | null;
  status: string;
  createdAt: string | number;
  updatedAt: string | number;
}

export const getOutlineList = async (workId: number | string): Promise<{ success: boolean; result?: OutlineNode[]; flatList?: OutlineNode[]; message?: string }> => {
  return get(OutlineApi.list, { workId });
};

export const createOutlineNode = async (data: CreateOutlinePayload) => {
  return post(OutlineApi.create, data);
};

export const batchCreateOutlineNodes = async (data: { workId: number | string; nodes: any[]; batch: true }) => {
  return post(OutlineApi.create, data);
};

export const updateOutlineNode = async (data: UpdateOutlinePayload) => {
  return put(OutlineApi.update, data);
};

export const deleteOutlineNode = async (id: number | string) => {
  return del(`${OutlineApi.delete}?id=${encodeURIComponent(String(id))}`, { id: Number(id) });
};

export const batchDeleteOutlineNodes = async (ids: (number | string)[]) => {
  return del(`${OutlineApi.delete}?ids=${encodeURIComponent(ids.join(","))}`, { ids: ids.map(Number) });
};

export const deductPlot = async (payload: PlotDeductionPayload): Promise<{ success: boolean; result?: PlotDeductionResult; message?: string }> => {
  return post(OutlineApi.deductAi, payload);
};

export const getPlotDeductions = async (workId: number | string): Promise<{ success: boolean; result?: PlotDeductionRecord[]; message?: string }> => {
  return get(OutlineApi.deductions, { workId });
};

export const savePlotDeduction = async (payload: Partial<PlotDeductionRecord>): Promise<{ success: boolean; result?: PlotDeductionRecord; message?: string }> => {
  return post(OutlineApi.deductions, payload);
};

export const deletePlotDeduction = async (id: number) => {
  return del(OutlineApi.deductions, { id });
};

export const extractChapterOutline = async (payload: {
  chapterId: number | string;
  workId: number | string;
  content?: string;
  title?: string;
}): Promise<{ success: boolean; result?: OutlineNode; message?: string }> => {
  return post(OutlineApi.extractOutline, payload);
};

// 兼容历史 AI 辅助功能接口定义
export type OutlineAiAction =
  | "generate_from_premise"
  | "plan_chapters"
  | "expand_node"
  | "split_node"
  | "find_plot_holes"
  | "polish_rhythm"
  | "generate_alternatives"
  | "alternative_plots"
  | "check_mainline"
  | "check_conflict"
  | "check_pacing"
  | "diagnose";

export interface OutlineAiPayload {
  workId: number | string;
  nodeId?: string;
  targetNodeId?: string;
  targetNode?: any;
  action: OutlineAiAction;
  premise?: string;
  currentContent?: string;
  targetChapterCount?: number;
  genre?: string;
  customPrompt?: string;
}

export interface OutlineAiHistoryRecord {
  id: number;
  workId: number;
  nodeId?: string | null;
  action: string;
  title: string;
  prompt?: string | null;
  resultPayload: any;
  createdAt: string | number;
}

export interface OutlineAiResponse {
  success: boolean;
  action?: string;
  title?: string;
  data?: any;
  result?: any;
  rawText?: string;
  message?: string;
}

export const requestOutlineAi = async (data: OutlineAiPayload): Promise<OutlineAiResponse> => {
  return post(OutlineApi.aiAssistant, data);
};

export const getOutlineAiHistoryList = async (workId: number | string, nodeId?: string): Promise<{ success: boolean; result?: OutlineAiHistoryRecord[]; message?: string }> => {
  return get(OutlineApi.history, { workId, nodeId });
};

export const deleteOutlineAiHistoryRecord = async (id: number) => {
  return del(OutlineApi.history, { id });
};
