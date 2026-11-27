// REST: 故事大纲管理、双向章节故事轴与章节规划闭环接口封装
import { get, post, put, del } from "@/utils/rest";
import { MasterOutlineNode } from "@/rest/master-outline";

export const OutlineApi = {
  list: "/api/outlines",
  create: "/api/outlines",
  update: "/api/outlines",
  delete: "/api/outlines",
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
  category: "chapter" | "memo";
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
  category?: "chapter" | "memo";
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
}

export interface UpdateOutlinePayload extends Partial<CreateOutlinePayload> {
  id: number | string;
  replaceChildren?: boolean;
  children?: any[];
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

export const getOutlineList = async (
  workId: number | string,
  category?: "chapter" | "memo"
): Promise<{ success: boolean; result?: OutlineNode[]; flatList?: OutlineNode[]; message?: string }> => {
  return get(OutlineApi.list, category ? { workId, category } : { workId });
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

// ============================================================================
// Tab 2 章节规划与起草闭环（项目总纲节点 + 章节大纲进度 ➔ 纯文本多方案 ➔ ≥3000字正文）
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

export const saveMasterChapterPlansSnapshot = async (payload: {
  workId: number | string;
  nodeId: string;
  selectedPlanId?: string;
  plans?: MasterChapterPlanOption[];
}): Promise<{ success: boolean; result?: MasterNodeDeductionSnapshot; message?: string }> => {
  return put(`/api/ai/plot-deduction/plan`, payload);
};

export const generateProseFromPlan = async (payload: {
  workId: number | string;
  nodeId: string;
  planId: string;
  planName?: string;
  chapterNumber: number;
  chapterTitle: string;
  plotText: string;
  prevPlanContext?: string;
  nextPlanContext?: string;
  siblingContext?: string;
  writingStyle?: string;
  extraInstruction?: string;
}): Promise<{ success: boolean; result?: GeneratedProseDraft; message?: string }> => {
  return post(`/api/ai/plot-deduction/generate-prose`, payload);
};

export const reverseMasterOutlineFromChapters = async (payload: {
  workId: number | string;
  mode: "single" | "all";
  chapterId?: number | string;
  mergeMode?: "merge" | "replace";
  autoSave?: boolean;
}): Promise<{
  success: boolean;
  result?: {
    tree: MasterOutlineNode;
    saved: boolean;
    mappedChaptersCount: number;
    nodeCount: number;
    chapterOutlineExtracted?: boolean;
  };
  message?: string;
}> => {
  return post(`/api/ai/outline/master/reverse-from-chapters`, payload);
};
