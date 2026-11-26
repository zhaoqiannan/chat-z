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
  organizeThoughts: "/api/ai/outline/organize-thoughts",
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
  category: "chapter" | "deduction" | "memo";
  level?: number;
  parentId?: number | string | null;
  volumeId?: number | string | null;
  chapterId?: number | null;
  chapterNumber?: number | null;
  type: OutlineNodeType;
  pointType?: PlotPointType | null;
  status: OutlineStatus | string;
  isFromChapter: number;
  title: string;
  summary?: string | null;
  timeframe?: string | null;
  location?: string | null;
  orderIndex: number;

  // 剧情推演溯源
  deductionId?: number | null;
  deductionOrigin?: string | null;
  deductionPremise?: string | null;
  deductionTarget?: string | null;
  deductionPathTitle?: string | null;
  deductionStepIndex?: number | null;

  // 大纲核心要素
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

  // 树级子节点
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
  category?: "chapter" | "deduction" | "memo";
  level?: number;
  parentId?: number | string | null;
  volumeId?: number | string | null;
  chapterId?: number | null;
  chapterNumber?: number | null;
  type?: OutlineNodeType;
  pointType?: PlotPointType | null;
  status?: OutlineStatus | string;
  isFromChapter?: number;
  title: string;
  summary?: string | null;
  timeframe?: string | null;
  location?: string | null;

  // 剧情推演溯源
  deductionId?: number | null;
  deductionOrigin?: string | null;
  deductionPremise?: string | null;
  deductionTarget?: string | null;
  deductionPathTitle?: string | null;
  deductionStepIndex?: number | null;

  event?: string;
  twist?: string;
  nextGoal?: string;
  suspense?: string;
  content?: string;
  wordCountEstimate?: number;
  linkedCharacterIds?: number[];
  linkedNoteIds?: number[];
  orderIndex?: number;
  children?: any[];

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
  replaceChildren?: boolean;
  children?: any[];
}

export interface PlotDeductionStep {
  stepIndex?: number;
  title: string;
  purpose?: string;
  cause?: string;
  action?: string;
  result?: string;
  characterDecision?: string;
  stateChange?: string[] | string;
  nextCondition?: string | null;
  event: string;
  twist?: string | null;
  nextGoal?: string | null;
  suspense?: string | null;
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
  missingConditions?: string[];
}

export interface PlotDeductionPayload {
  workId: number | string;
  startPoint: string;
  targetPoint: string;
  estimatedWords?: number;
  stepCount?: number;
  selectedCharacterIds?: number[];
  selectedNoteIds?: number[];
  pacePreference?: string;
  pathPreference?: string; // 自由输入的演进期望
  involvedCharacters?: string;
}

export interface OrganizedTreeNode {
  title: string;
  content: string;
  timeframe?: string;
  location?: string;
  characters?: string;
  children?: OrganizedTreeNode[];
}

export interface ThoughtOrganizePayload {
  workId: number | string;
  thoughts: string[];
  selectedCharacterIds?: number[];
  selectedNoteIds?: number[];
}

export interface ThoughtOrganizeResult {
  title?: string;
  summary: string;
  timeframe?: string;
  location?: string;
  tree: OrganizedTreeNode[];
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

export const organizeOutlineThoughts = async (payload: ThoughtOrganizePayload): Promise<{ success: boolean; result?: ThoughtOrganizeResult; message?: string }> => {
  return post(OutlineApi.organizeThoughts, payload);
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

// ============================================================================
// Tab 3 剧情推演闭环（项目总纲节点 + Tab 2 章节大纲进度 ➔ 纯文本多方案 ➔ ≥3000字正文）
// ============================================================================
export interface MasterNodePlanMeta {
  id: string;
  title: string;
  tag?: string;
  note?: string;
  chapterRange?: string;
  status?: string;
  depth: number;
  childCount: number;
  parsedRange: { start: number; end: number } | null;
  writtenCount: number;
  totalPlannedCount: number;
  missingChapters: number[];
  hasSnapshot: boolean;
}

export interface ChapterProgressOutlineItem {
  chapterNumber: number;
  chapterId: number | null;
  title: string;
  outlineText: string;
  twist?: string;
  suspense?: string;
  wordCount: number;
  hasOutline: boolean;
  hasProse: boolean;
}

export interface MasterChapterPlanItem {
  chapterNumber: number;
  title: string;
  plotText: string;
}

export interface MasterChapterPlanOption {
  id: string;
  name: string;
  style: string;
  overview: string;
  chapters: MasterChapterPlanItem[];
}

export interface GeneratedProseDraft {
  chapterNumber: number;
  chapterTitle: string;
  planId: string;
  planName?: string;
  plotText: string;
  content: string;
  wordCount: number;
  updatedAt: number;
}

export interface MasterNodeDeductionSnapshot {
  nodeId: string;
  nodeTitle: string;
  chapterStart: number;
  chapterEnd: number;
  preference?: string;
  progressSummary: string;
  plans: MasterChapterPlanOption[];
  selectedPlanId: string;
  latestDrafts?: Record<string, GeneratedProseDraft>;
  lastGeneratedDraft?: GeneratedProseDraft | null;
  updatedAt: number;
}

export interface MasterNodeDeductionContextResult {
  masterNodes: MasterNodePlanMeta[];
  selectedNodeId: string;
  targetNode: any | null;
  suggestedRange: { start: number; end: number };
  inRangeOutlines: ChapterProgressOutlineItem[];
  precedingOutlines: ChapterProgressOutlineItem[];
  volumes: Array<{ id: number; title: string }>;
  existingChapters: Array<{ id: number; chapterNumber: number; title: string; wordCount: number; volumeId: number | null }>;
  snapshot: MasterNodeDeductionSnapshot | null;
}

export const getMasterNodeDeductionContext = async (
  workId: number | string,
  nodeId?: string
): Promise<{ success: boolean; result?: MasterNodeDeductionContextResult; message?: string }> => {
  return get(`/api/ai/plot-deduction/plan?workId=${workId}${nodeId ? `&nodeId=${encodeURIComponent(nodeId)}` : ""}`);
};

export const generateMasterChapterPlans = async (payload: {
  workId: number | string;
  nodeId: string;
  targetNode?: any;
  chapterStart: number;
  chapterEnd: number;
  preference?: string;
}): Promise<{ success: boolean; result?: MasterNodeDeductionSnapshot; message?: string }> => {
  return post(`/api/ai/plot-deduction/plan`, payload);
};

export const generateProseFromPlan = async (payload: {
  workId: number | string;
  nodeId: string;
  planId: string;
  planName?: string;
  chapterNumber: number;
  chapterTitle: string;
  plotText: string;
  siblingContext?: string;
  writingStyle?: string;
  extraInstruction?: string;
}): Promise<{ success: boolean; result?: GeneratedProseDraft; message?: string }> => {
  return post(`/api/ai/plot-deduction/generate-prose`, payload);
};
