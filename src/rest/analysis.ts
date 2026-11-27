// REST: AI 深度分析模块（全书宏观 / 区间模块 / 逻辑审查 / 人物性格 OOC）
import { get, post, del } from "@/utils/rest";

export type AiAnalysisType = "book_overview" | "chapter_range" | "logic_audit" | "character_audit";

export interface AnalysisChapterBrief {
  id: number;
  chapterNumber: number;
  title: string;
  wordCount: number;
  volumeId: number | null;
  status: string;
}

export interface AnalysisVolumeBrief {
  id: number;
  title: string;
}

export interface AnalysisCharacterBrief {
  id: number;
  name: string;
  identity?: string | null;
  roleType?: string | null;
}

export interface AnalysisMasterNodeBrief {
  id: string;
  title: string;
  chapterRange: string;
  tag?: string;
}

export interface AnalysisWorkMetrics {
  workTitle: string;
  workTag: string;
  totalWords: number;
  expectedWords: number;
  progressPercent: number;
  chapterCount: number;
  completedChapters: number;
  avgWordsPerChapter: number;
  outlineNodeCount: number;
  hasMasterOutline: boolean;
  chapters: AnalysisChapterBrief[];
  volumes: AnalysisVolumeBrief[];
  characters: AnalysisCharacterBrief[];
  masterNodes: AnalysisMasterNodeBrief[];
}

export interface AnalysisReportRecord {
  id: number;
  workId: number;
  analysisType: AiAnalysisType;
  scopeLabel: string;
  scopeParams?: Record<string, any> | null;
  overallScore: number;
  report: any;
  createdAt: number;
}

export type AiAnalysisTabKey = "book_overview" | "chapter_range" | "audit";

export const getAnalysisOverview = async (
  workId: number | string,
  tab?: AiAnalysisTabKey
): Promise<{
  success: boolean;
  result?: { metrics: AnalysisWorkMetrics; history: AnalysisReportRecord[] };
  message?: string;
}> => {
  const query = tab ? `workId=${workId}&tab=${encodeURIComponent(tab)}` : `workId=${workId}`;
  return get(`/api/ai/analysis?${query}`);
};

export const runAiAnalysis = async (payload: {
  workId: number | string;
  analysisType: AiAnalysisType;
  startChapter?: number;
  endChapter?: number;
  expectedGoal?: string;
  characterIds?: number[];
}): Promise<{ success: boolean; result?: AnalysisReportRecord; message?: string }> => {
  return post(`/api/ai/analysis`, payload);
};

export const deleteAnalysisReport = async (id: number | string): Promise<{ success: boolean; message?: string }> => {
  return del(`/api/ai/analysis?id=${id}`, { id });
};
