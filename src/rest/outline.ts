// REST: 故事大纲管理、情节点维护与 AI 剧情推演接口封装
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
};

export type OutlineNodeType = "story" | "volume" | "act" | "scene" | "branch" | "event" | "point";

export type PlotPointType = "conflict" | "twist" | "foreshadow" | "climax" | "transition" | "reveal";

export interface OutlineNode {
  id: string;
  workId: number | string;
  parentId?: string | null;
  volumeId?: string | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | null;
  title: string;
  content?: string | null;
  orderIndex: number;
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
  children?: OutlineNode[];
}

export interface CreateOutlinePayload {
  workId: number | string;
  parentId?: string | null;
  volumeId?: string | null;
  type?: OutlineNodeType;
  pointType?: PlotPointType | null;
  title: string;
  content?: string;
  orderIndex?: number;
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
  id: string;
}

export interface PlotDeductionStep {
  stepIndex?: number;
  title: string;
  content: string;
  keyConflict?: string;
  characterAction?: string;
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
  involvedCharacters?: string;
  pacePreference?: "standard" | "twist" | "dark" | string;
  stepCount?: number;
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

export const getOutlineList = async (workId: number | string) => {
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

export const deleteOutlineNode = async (id: string) => {
  return del(OutlineApi.delete, { id });
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

export type OutlineAiAction = "generate_from_premise" | "plan_chapters" | "expand_node" | "split_node" | "find_plot_holes" | "polish_rhythm" | "generate_alternatives" | "alternative_plots" | "check_mainline" | "check_conflict" | "check_pacing" | "diagnose";

export interface OutlineAiPayload {
  workId: number | string;
  action: OutlineAiAction;
  premise?: string;
  targetNodeId?: string;
  targetNode?: Partial<OutlineNode>;
  additionalPrompt?: string;
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

export const requestOutlineAi = async (data: OutlineAiPayload) => {
  return post(OutlineApi.aiAssistant, data);
};

export const getOutlineAiHistory = async (workId: number | string, nodeId?: string) => {
  return get(OutlineApi.history, { workId, nodeId });
};

export const getOutlineAiHistoryList = getOutlineAiHistory;

export const deleteOutlineAiHistoryRecord = async (id: number) => {
  return del(OutlineApi.history, { id });
};

