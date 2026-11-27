"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OutlineNode } from "@/rest/outline";

export type OutlineTabKey = "master" | "chapter" | "deduction" | "memo";
export type OutlineCategoryKey = "chapter" | "memo";

interface OutlineContextValue {
  workId: string;
  activeTab: OutlineTabKey;
  setActiveTab: (tab: OutlineTabKey) => void;
  deductionTargetMasterNodeId: string | null;
  setDeductionTargetMasterNodeId: (nodeId: string | null) => void;
  jumpToPlotDeduction: (nodeId: string) => void;
  jumpToQualityAudit: (chapterRange: string, nodeTitle: string) => void;

  tabCounts: Partial<Record<OutlineCategoryKey, number>>;
  setTabCount: (category: OutlineCategoryKey, count: number) => void;
  activeCategoryNodes: OutlineNode[];
  setActiveCategoryNodes: (nodes: OutlineNode[]) => void;

  refreshVersion: number;
  triggerRefresh: () => Promise<void>;

  editorModalOpened: boolean;
  editingNode: OutlineNode | null;
  parentForNewChild: OutlineNode | null;
  editorCategory: OutlineCategoryKey;
  openCreateNode: (category: OutlineCategoryKey) => void;
  openAddChildNode: (parentNode: OutlineNode, category: OutlineCategoryKey) => void;
  openEditNode: (node: OutlineNode, categoryNodes: OutlineNode[], category: OutlineCategoryKey) => void;
  closeEditorModal: () => void;

  thoughtDrawerOpened: boolean;
  openThoughtDrawer: () => void;
  closeThoughtDrawer: () => void;
}

const OutlineContext = createContext<OutlineContextValue | null>(null);

export function OutlineProvider({ workId, children }: { workId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [activeTab, setActiveTabState] = useState<OutlineTabKey>("master");
  const [deductionTargetMasterNodeId, setDeductionTargetMasterNodeId] = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<Partial<Record<OutlineCategoryKey, number>>>({});
  const [activeCategoryNodes, setActiveCategoryNodes] = useState<OutlineNode[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [editorModalOpened, setEditorModalOpened] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [parentForNewChild, setParentForNewChild] = useState<OutlineNode | null>(null);
  const [editorCategory, setEditorCategory] = useState<OutlineCategoryKey>("chapter");
  const [thoughtDrawerOpened, setThoughtDrawerOpened] = useState(false);

  useEffect(() => {
    setTabCounts({});
    setActiveCategoryNodes([]);
    setDeductionTargetMasterNodeId(null);
  }, [workId]);

  const setActiveTab = useCallback((tab: OutlineTabKey) => {
    setActiveTabState(tab);
  }, []);

  const jumpToPlotDeduction = useCallback((nodeId: string) => {
    setDeductionTargetMasterNodeId(nodeId);
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

  const openThoughtDrawer = useCallback(() => setThoughtDrawerOpened(true), []);
  const closeThoughtDrawer = useCallback(() => setThoughtDrawerOpened(false), []);

  const value = useMemo<OutlineContextValue>(
    () => ({
      workId,
      activeTab,
      setActiveTab,
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
      thoughtDrawerOpened,
      openThoughtDrawer,
      closeThoughtDrawer,
    }),
    [
      workId,
      activeTab,
      setActiveTab,
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
