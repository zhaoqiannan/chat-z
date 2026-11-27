"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AiAnalysisTabKey,
  AiAnalysisType,
  AnalysisReportRecord,
  AnalysisWorkMetrics,
  deleteAnalysisReport,
  getAnalysisOverview,
  runAiAnalysis,
} from "@/rest/analysis";
import { useAlert } from "@/hooks/useAlert";

interface AiAnalysisContextValue {
  workId: string;
  activeTab: AiAnalysisTabKey;
  setActiveTab: (tab: AiAnalysisTabKey) => void;
  auditSubMode: "logic_audit" | "character_audit";
  setAuditSubMode: (mode: "logic_audit" | "character_audit") => void;
  loading: boolean;
  running: boolean;
  metrics: AnalysisWorkMetrics | null;
  history: AnalysisReportRecord[];
  activeReport: AnalysisReportRecord | null;
  setActiveReport: (report: AnalysisReportRecord | null) => void;
  startChapter: number;
  setStartChapter: (val: number) => void;
  endChapter: number;
  setEndChapter: (val: number) => void;
  expectedGoal: string;
  setExpectedGoal: (val: string) => void;
  sourceNodeGoal: string | null;
  selectedCharIds: string[];
  setSelectedCharIds: (ids: string[]) => void;
  maxChapterNum: number;
  currentAnalysisType: AiAnalysisType;
  refreshCurrentTab: () => Promise<void>;
  handleRunAnalysis: () => Promise<void>;
  handleDeleteReport: (id: number, e: React.MouseEvent) => Promise<void>;
  handlePickVolume: (volId: string | null) => void;
  handlePickMasterNode: (nodeId: string | null) => void;
}

const AiAnalysisContext = createContext<AiAnalysisContextValue | null>(null);

export function AiAnalysisProvider({ workId, children }: { workId: string; children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const initialTab: AiAnalysisTabKey = searchParams.get("mode") === "range" ? "chapter_range" : "book_overview";

  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<AnalysisWorkMetrics | null>(null);
  const [history, setHistory] = useState<AnalysisReportRecord[]>([]);
  const [activeReport, setActiveReport] = useState<AnalysisReportRecord | null>(null);

  const [activeTab, setActiveTab] = useState<AiAnalysisTabKey>(initialTab);
  const [auditSubMode, setAuditSubMode] = useState<"logic_audit" | "character_audit">("logic_audit");

  const [startChapter, setStartChapter] = useState<number>(1);
  const [endChapter, setEndChapter] = useState<number>(5);
  const [expectedGoal, setExpectedGoal] = useState<string>("");
  const [sourceNodeGoal, setSourceNodeGoal] = useState<string | null>(null);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  const reqIdRef = useRef(0);

  // 响应从「项目总纲 / 章节规划与起草」跳转携带的区间与节点目标参数
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const rangeParam = searchParams.get("range");
    const goalParam = searchParams.get("goal");
    if (modeParam === "range") {
      setActiveTab("chapter_range");
      if (rangeParam) {
        const nums = rangeParam.match(/\d+/g);
        if (nums && nums.length >= 1) {
          const s = Number(nums[0]);
          const e = nums.length >= 2 ? Number(nums[1]) : s;
          if (!isNaN(s)) setStartChapter(s);
          if (!isNaN(e)) setEndChapter(Math.max(s, e));
        }
      }
      if (goalParam) {
        setExpectedGoal(goalParam);
        setSourceNodeGoal(goalParam);
      }
    }
  }, [searchParams]);

  // 按当前激活 Tab 请求最新分析数据与该 Tab 历史报告
  const fetchTabData = useCallback(
    async (tab: AiAnalysisTabKey) => {
      if (!workId) return;
      const reqId = ++reqIdRef.current;
      try {
        setLoading(true);
        const res = await getAnalysisOverview(workId, tab);
        if (reqId !== reqIdRef.current) return;
        if (res && res.success && res.result) {
          setMetrics(res.result.metrics);
          const list = res.result.history || [];
          setHistory(list);
          setActiveReport((prev) => {
            if (prev && list.some((item) => item.id === prev.id)) {
              return prev;
            }
            return list[0] || null;
          });
          const maxCh = res.result.metrics.chapters.length;
          if (maxCh > 0) {
            setEndChapter((prev) => (prev > maxCh ? maxCh : prev));
          }
        }
      } catch (e: any) {
        if (reqId === reqIdRef.current) {
          useAlert.error("加载分析数据失败: " + (e?.message || "网络异常"));
        }
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
        }
      }
    },
    [workId]
  );

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  const refreshCurrentTab = useCallback(() => fetchTabData(activeTab), [activeTab, fetchTabData]);

  const currentAnalysisType: AiAnalysisType =
    activeTab === "book_overview"
      ? "book_overview"
      : activeTab === "chapter_range"
      ? "chapter_range"
      : auditSubMode;

  const handleRunAnalysis = useCallback(async () => {
    if (!workId) return;
    if (currentAnalysisType === "character_audit" && selectedCharIds.length === 0) {
      useAlert.warning("请至少选择 1 位需要分析的角色");
      return;
    }

    try {
      setRunning(true);
      const res = await runAiAnalysis({
        workId,
        analysisType: currentAnalysisType,
        startChapter,
        endChapter: Math.max(startChapter, endChapter),
        expectedGoal: expectedGoal.trim() || undefined,
        characterIds: selectedCharIds.map(Number).filter((n) => !isNaN(n)),
      });

      if (res && res.success && res.result) {
        setActiveReport(res.result);
        setHistory((prev) => [res.result!, ...prev.filter((r) => r.id !== res.result!.id)]);
        useAlert.success("AI 深度分析完成！");
      } else {
        useAlert.error(res?.message || "AI 分析失败");
      }
    } catch (e: any) {
      useAlert.error("AI 分析异常: " + (e?.message || "网络异常"));
    } finally {
      setRunning(false);
    }
  }, [workId, currentAnalysisType, selectedCharIds, startChapter, endChapter, expectedGoal]);

  const handleDeleteReport = useCallback(
    async (id: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const res = await deleteAnalysisReport(id);
        if (res && res.success) {
          setHistory((prev) => {
            const next = prev.filter((item) => item.id !== id);
            setActiveReport((curr) => (curr?.id === id ? next[0] || null : curr));
            return next;
          });
          useAlert.success("已删除历史报告");
        }
      } catch (err: any) {
        useAlert.error("删除失败: " + (err?.message || "网络异常"));
      }
    },
    []
  );

  const handlePickVolume = useCallback(
    (volId: string | null) => {
      if (!volId || !metrics) return;
      const chs = metrics.chapters.filter((c) => String(c.volumeId) === volId);
      if (chs.length > 0) {
        setStartChapter(chs[0].chapterNumber);
        setEndChapter(chs[chs.length - 1].chapterNumber);
      }
    },
    [metrics]
  );

  const handlePickMasterNode = useCallback(
    (nodeId: string | null) => {
      if (!nodeId || !metrics) return;
      const node = metrics.masterNodes.find((n) => n.id === nodeId);
      if (!node) return;
      const nums = node.chapterRange.match(/\d+/g);
      if (nums && nums.length >= 1) {
        const s = Number(nums[0]);
        const e = nums.length >= 2 ? Number(nums[1]) : s;
        setStartChapter(s);
        setEndChapter(Math.max(s, e));
      }
      setExpectedGoal(node.title);
    },
    [metrics]
  );

  const maxChapterNum = useMemo(() => {
    if (!metrics || metrics.chapters.length === 0) return 100;
    return Math.max(...metrics.chapters.map((c) => c.chapterNumber));
  }, [metrics]);

  const value = useMemo<AiAnalysisContextValue>(
    () => ({
      workId,
      activeTab,
      setActiveTab,
      auditSubMode,
      setAuditSubMode,
      loading,
      running,
      metrics,
      history,
      activeReport,
      setActiveReport,
      startChapter,
      setStartChapter,
      endChapter,
      setEndChapter,
      expectedGoal,
      setExpectedGoal,
      sourceNodeGoal,
      selectedCharIds,
      setSelectedCharIds,
      maxChapterNum,
      currentAnalysisType,
      refreshCurrentTab,
      handleRunAnalysis,
      handleDeleteReport,
      handlePickVolume,
      handlePickMasterNode,
    }),
    [
      workId,
      activeTab,
      auditSubMode,
      loading,
      running,
      metrics,
      history,
      activeReport,
      startChapter,
      endChapter,
      expectedGoal,
      sourceNodeGoal,
      selectedCharIds,
      maxChapterNum,
      currentAnalysisType,
      refreshCurrentTab,
      handleRunAnalysis,
      handleDeleteReport,
      handlePickVolume,
      handlePickMasterNode,
    ]
  );

  return <AiAnalysisContext.Provider value={value}>{children}</AiAnalysisContext.Provider>;
}

export function useAiAnalysisContext() {
  const ctx = useContext(AiAnalysisContext);
  if (!ctx) {
    throw new Error("useAiAnalysisContext must be used inside AiAnalysisProvider");
  }
  return ctx;
}
