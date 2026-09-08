import { get, post } from "@/utils/rest";

export const WorkspaceApi = {
  recentChapter: "/api/workspace/recent-chapter",
  activities: "/api/workspace/activities",
  creationStats: "/api/workspace/creation-stats",
  aiSuggestions: "/api/workspace/ai-suggestions",
};

export interface RecentChapterResult {
  workId: number;
  chapterId: number | null;
  novelTitle: string;
  chapterTitle: string;
  wordCount: string;
  progressDesc: string;
}

export interface ActivityResult {
  id: string | number;
  title: string;
  time: string;
  description: string;
}

export interface CreationStatItem {
  id: string | number;
  label: string;
  value: string | number;
  unit: string;
  color?: string;
}

export interface AiSuggestionItem {
  id: string | number;
  type?: string;
  title: string;
  content: string;
}

/**
 * 获取最近编辑章节与作品
 */
export const getRecentChapter = async () => get(WorkspaceApi.recentChapter);

/**
 * 获取最近 24 小时动态
 */
export const getRecentActivities = async () => get(WorkspaceApi.activities);

/**
 * 获取创作统计数据 (今日、本周、连续天数、总字数)
 */
export const getCreationStats = async () => get(WorkspaceApi.creationStats);

/**
 * 主动按需触发 AI 创意智囊与设定冲突诊断 (POST)
 */
export const triggerAiDiagnosis = async () => post(WorkspaceApi.aiSuggestions, {});
