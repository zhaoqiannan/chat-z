"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OutlineNode, PlotDeductionRecord } from "@/rest/outline";

export type OutlineTabKey = "master" | "chapter" | "deduction" | "memo";
export type OutlineCategoryKey = "chapter" | "deduction" | "memo";

interface OutlineContextValue {
  workId: string;
  activeTab: OutlineTabKey;
  setActiveTab: (tab: OutlineTabKey) => void;
  showLegacyDeductionList: boolean;
  setShowLegacyDeductionList: (show: boolean) => void;
  deductionTargetMasterNodeId: string | null;
  setDeductionTargetMasterNodeId: (nodeId: string | null) => void;
  jumpToPlotDeduction: (nodeId: string) => void;
  jumpToQualityAudit: (chapterRange: string, nodeTitle: string) => void;

  // 当前激活分类节点列表与各 Tab 数量缓存（按需进入 Tab 后更新）
  tabCounts: Partial<Record<OutlineCategoryKey, number>>;
  setTabCount: (category: OutlineCategoryKey, count: number) => void;
  activeCategoryNodes: OutlineNode[];
  setActiveCategoryNodes: (nodes: OutlineNode[]) => void;

  // 刷新信号（弹窗/抽屉保存后触发当前激活面板重新拉取最新数据）
  refreshVersion: number;
  triggerRefresh: () => Promise<void>;

  // 公共弹窗与抽屉交互状态
  editorModalOpened: boolean;
  editingNode: OutlineNode | null;
  parentForNewChild: OutlineNode | null;
  editorCategory: OutlineCategoryKey;
  openCreateNode: (category: OutlineCategoryKey) => void;
  openAddChildNode: (parentNode: OutlineNode, category: OutlineCategoryKey) => void;
  openEditNode: (node: OutlineNode, categoryNodes: OutlineNode[], category: OutlineCategoryKey) => void;
  closeEditorModal: () => void;

  deductionDrawerOpened: boolean;
  loadedDeductionRecord: PlotDeductionRecord | null;
  openDeductionDrawer: (record?: PlotDeductionRecord | null) => void;
  closeDeductionDrawer: () => void;

  historyDrawerOpened: boolean;
  openHistoryDrawer: () => void;
  closeHistoryDrawer: () => void;

  thoughtDrawerOpened: boolean;
  openThoughtDrawer: () => void;
  closeThoughtDrawer: () => void;
}

const OutlineContext = createContext<OutlineContextValue | null>(null);

export function OutlineProvider({ workId, children }: { workId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [activeTab, setActiveTabState] = useState<OutlineTabKey>("master");
  const [showLegacyDeductionList, setShowLegacyDeductionList] = useState(false);
  const [deductionTargetMasterNodeId, setDeductionTargetMasterNodeId] = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<Partial<Record<OutlineCategoryKey, number>>>({});
  const [activeCategoryNodes, setActiveCategoryNodes] = useState<OutlineNode[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);

  // 弹窗与抽屉状态
  const [editorModalOpened, setEditorModalOpened] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [parentForNewChild, setParentForNewChild] = useState<OutlineNode | null>(null);
  const [editorCategory, setEditorCategory] = useState<OutlineCategoryKey>("chapter");

  const [deductionDrawerOpened, setDeductionDrawerOpened] = useState(false);
  const [loadedDeductionRecord, setLoadedDeductionRecord] = useState<PlotDeductionRecord | null>(null);
  const [historyDrawerOpened, setHistoryDrawerOpened] = useState(false);
  const [thoughtDrawerOpened, setThoughtDrawerOpened] = useState(false);

  // 切换作品时重置局部页面状态
  useEffect(() => {
    setTabCounts({});
    setActiveCategoryNodes([]);
    setDeductionTargetMasterNodeId(null);
    setShowLegacyDeductionList(false);
  }, [workId]);

  const setActiveTab = useCallback((tab: OutlineTabKey) => {
    setActiveTabState(tab);
  }, []);

  const jumpToPlotDeduction = useCallback((nodeId: string) => {
    setDeductionTargetMasterNodeId(nodeId);
    setShowLegacyDeductionList(false);
    setActiveTabState("deduction");
  }, []);

  const jumpToQualityAudit = useCallback(
    (chapterRange: string, nodeTitle: string) => {
      const query = new URLSearchParams({
        tab: "ai_analysis",
        mode: "range",
        range: chapterRange,
        goal: nodeTitle,
      });
      router.push(`/project/${workId}?${query.toString()}`);
    },
    [router, workId]
  );

  const setTabCount = useCallback((category: OutlineCategoryKey, count: number) => {
    setTabCounts((prev) => (prev[category] === count ? prev : { ...prev, [category]: count }));
  }, []);

  const triggerRefresh = useCallback(async () => {
    setRefreshVersion((v) => v + 1);
  }, []);

  const openCreateNode = useCallback((category: OutlineCategoryKey) => {
    setEditorCategory(category);
    setEditingNode(null);
    setParentForNewChild(null);
    setEditorModalOpened(true);
  }, []);

  const openAddChildNode = useCallback((parentNode: OutlineNode, category: OutlineCategoryKey) => {
    setEditorCategory(category);
    setEditingNode(null);
    setParentForNewChild(parentNode);
    setEditorModalOpened(true);
  }, []);

  const openEditNode = useCallback((node: OutlineNode, categoryNodes: OutlineNode[], category: OutlineCategoryKey) => {
    const childList = categoryNodes.filter((n) => Number(n.parentId) === Number(node.id));
    setEditorCategory(category);
    setEditingNode({ ...node, children: childList });
    setParentForNewChild(null);
    setEditorModalOpened(true);
  }, []);

  const closeEditorModal = useCallback(() => {
    setEditorModalOpened(false);
    setEditingNode(null);
    setParentForNewChild(null);
  }, []);

  const openDeductionDrawer = useCallback((record?: PlotDeductionRecord | null) => {
    if (record !== undefined) {
      setLoadedDeductionRecord(record);
    }
    setDeductionDrawerOpened(true);
  }, []);

  const closeDeductionDrawer = useCallback(() => {
    setDeductionDrawerOpened(false);
  }, []);

  const openHistoryDrawer = useCallback(() => setHistoryDrawerOpened(true), []);
  const closeHistoryDrawer = useCallback(() => setHistoryDrawerOpened(false), []);
  const openThoughtDrawer = useCallback(() => setThoughtDrawerOpened(true), []);
  const closeThoughtDrawer = useCallback(() => setThoughtDrawerOpened(false), []);

  const value = useMemo<OutlineContextValue>(
    () => ({
      workId,
      activeTab,
      setActiveTab,
      showLegacyDeductionList,
      setShowLegacyDeductionList,
      deductionTargetMasterNodeId,
      setDeductionTargetMasterNodeId,
      jumpToPlotDeduction,
      jumpToQualityAudit,
      tabCounts,
      setTabCount,
      activeCategoryNodes,
      setActiveCategoryNodes,
      refreshVersion,
      triggerRefresh,
      editorModalOpened,
      editingNode,
      parentForNewChild,
      editorCategory,
      openCreateNode,
      openAddChildNode,
      openEditNode,
      closeEditorModal,
      deductionDrawerOpened,
      loadedDeductionRecord,
      openDeductionDrawer,
      closeDeductionDrawer,
      historyDrawerOpened,
      openHistoryDrawer,
      closeHistoryDrawer,
      thoughtDrawerOpened,
      openThoughtDrawer,
      closeThoughtDrawer,
    }),
    [
      workId,
      activeTab,
      setActiveTab,
      showLegacyDeductionList,
      deductionTargetMasterNodeId,
      jumpToPlotDeduction,
      jumpToQualityAudit,
      tabCounts,
      setTabCount,
      activeCategoryNodes,
      refreshVersion,
      triggerRefresh,
      editorModalOpened,
      editingNode,
      parentForNewChild,
      editorCategory,
      openCreateNode,
      openAddChildNode,
      openEditNode,
      closeEditorModal,
      deductionDrawerOpened,
      loadedDeductionRecord,
      openDeductionDrawer,
      closeDeductionDrawer,
      historyDrawerOpened,
      openHistoryDrawer,
      closeHistoryDrawer,
      thoughtDrawerOpened,
      openThoughtDrawer,
      closeThoughtDrawer,
    ]
  );

  return <OutlineContext.Provider value={value}>{children}</OutlineContext.Provider>;
}

export function useOutlineContext() {
  const ctx = useContext(OutlineContext);
  if (!ctx) {
    throw new Error("useOutlineContext must be used inside OutlineProvider");
  }
  return ctx;
}
