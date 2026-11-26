"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Box, Button, Flex, Group, Modal, Select, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { FiCpu, FiGitBranch, FiMaximize, FiMaximize2, FiMinimize2, FiPlus, FiRefreshCw, FiSave, FiTable, FiZoomIn, FiZoomOut } from "react-icons/fi";
import { MasterOutlineNode, MasterOutlineSide, deduceMasterOutlineLogicAi, generateMasterOutlineAi, getMasterOutline, saveMasterOutline } from "@/rest/master-outline";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import MindMapView, { MindMapViewHandle } from "./mindmap-view";
import TableView from "./table-view";
import ModalLogicDeduction from "./modal-logic-deduction";
import { ChildInsertPosition, SiblingInsertPosition, addChildNode, addSiblingNode, createNodeId, deleteNode, findNode, moveNode, setAllCollapsed, updateNode } from "./tree-utils";
import styles from "./style.module.scss";

interface MasterOutlineWorkspaceProps {
  workId: string;
}

export default function MasterOutlineWorkspace({ workId }: MasterOutlineWorkspaceProps) {
  const router = useRouter();
  const mindmapRef = useRef<MindMapViewHandle | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<"mindmap" | "table">("mindmap");
  const [tree, setTree] = useState<MasterOutlineNode | null>(null);
  const [selectedId, setSelectedId] = useState<string>("root");
  const [autoEditNodeId, setAutoEditNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 32, y: 32 });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aiModalOpened, setAiModalOpened] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [deductionNodeId, setDeductionNodeId] = useState<string | null>(null);
  const [deductionLoading, setDeductionLoading] = useState(false);
  const treeRef = useRef<MasterOutlineNode | null>(null);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  const deductionTargetNode = useMemo(() => {
    if (!tree || !deductionNodeId) return null;
    return findNode(tree, deductionNodeId);
  }, [tree, deductionNodeId]);

  const fetchTree = useCallback(async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getMasterOutline(workId);
      if (res && res.success && res.result?.tree) {
        setTree(res.result.tree);
        setSelectedId(res.result.tree.id || "root");
        setDirty(false);
      }
    } catch (e: any) {
      useAlert.error("获取项目总纲失败: " + (e?.message || "网络异常"));
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const mutateTree = useCallback((updater: (prev: MasterOutlineNode) => MasterOutlineNode) => {
    setTree((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!tree || !workId || saving) return;
    try {
      setSaving(true);
      const res = await saveMasterOutline({ workId, tree });
      if (res && res.success) {
        setDirty(false);
        useAlert.success("项目总纲已保存");
      } else {
        useAlert.error(res?.message || "保存失败");
      }
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  }, [tree, workId, saving]);

  const handleAddChild = useCallback(
    (parentId: string, position: ChildInsertPosition = "end", autoEdit = false, side?: MasterOutlineSide) => {
      const newId = createNodeId();
      const newNode: MasterOutlineNode = {
        id: newId,
        title: "新剧情节点",
        tag: side === "left" ? "设定" : "主线",
        note: "",
        chapterRange: "",
        status: "planned",
        children: [],
      };
      mutateTree((prev) => addChildNode(prev, parentId, newNode, position, side));
      setSelectedId(newId);
      if (autoEdit) setAutoEditNodeId(newId);
    },
    [mutateTree]
  );

  const handleAddSibling = useCallback(
    (targetId: string, position: SiblingInsertPosition = "after", autoEdit = false) => {
      if (targetId === "root") {
        handleAddChild("root", position === "before" ? "start" : "end", autoEdit, "right");
        return;
      }
      const newId = createNodeId();
      const newNode: MasterOutlineNode = {
        id: newId,
        title: "同级节点",
        tag: "主线",
        note: "",
        chapterRange: "",
        status: "planned",
        children: [],
      };
      mutateTree((prev) => addSiblingNode(prev, targetId, newNode, position));
      setSelectedId(newId);
      if (autoEdit) setAutoEditNodeId(newId);
    },
    [handleAddChild, mutateTree]
  );

  const handleTransformChange = useCallback((nextZoom: number, nextOffset: { x: number; y: number }) => {
    setZoom(nextZoom);
    setOffset(nextOffset);
  }, []);

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditNodeId(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (id === "root") return;
      const confirmed = await showConfirm({
        title: "删除总纲节点",
        message: "确定删除该节点及其下属所有子节点吗？",
        confirmLabel: "删除",
        confirmColor: "red",
      });
      if (!confirmed) return;
      mutateTree((prev) => deleteNode(prev, id));
      if (selectedId === id) setSelectedId("root");
    },
    [mutateTree, selectedId]
  );

  const handleToggleCollapse = useCallback((id: string) => {
    setTree((prev) => {
      if (!prev) return prev;
      const target = findNode(prev, id);
      if (!target) return prev;
      return updateNode(prev, id, { collapsed: !target.collapsed });
    });
  }, []);

  const handleAiGenerate = async () => {
    if (!workId) return;
    try {
      setAiLoading(true);
      const res = await generateMasterOutlineAi({ workId, prompt: aiPrompt.trim() || undefined });
      if (res && res.success && res.result?.tree) {
        setTree(res.result.tree);
        setSelectedId(res.result.tree.id || "root");
        setDirty(true);
        setAiModalOpened(false);
        setAiPrompt("");
        useAlert.success("AI 已生成项目总纲，确认无误后请点击「保存总纲」");
      } else {
        useAlert.error(res?.message || "AI 生成总纲失败");
      }
    } catch (e: any) {
      useAlert.error("AI 生成失败: " + (e?.message || "网络异常"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleJumpToAiAnalysis = useCallback(
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

  const runLogicDeduction = useCallback(
    async (nodeId: string) => {
      const curTree = treeRef.current;
      if (!curTree || !workId || deductionLoading) return;
      const targetNode = findNode(curTree, nodeId);
      if (!targetNode || targetNode.children.length === 0) {
        useAlert.warning("该节点暂无子节点，无法进行大纲逻辑推算");
        return;
      }
      try {
        setDeductionLoading(true);
        const rootSummary = `${curTree.title}${curTree.note ? `：${curTree.note}` : ""}`;
        const res = await deduceMasterOutlineLogicAi({ workId, targetNode, rootSummary });
        if (res && res.success && res.result) {
          const latestTree = treeRef.current || curTree;
          const nextTree = updateNode(latestTree, nodeId, { logicDeduction: res.result });
          setTree(nextTree);
          treeRef.current = nextTree;
          try {
            const saveRes = await saveMasterOutline({ workId, tree: nextTree });
            if (saveRes && saveRes.success) {
              setDirty(false);
            }
          } catch {}
          useAlert.success("AI 逻辑推算完成");
        } else {
          useAlert.error(res?.message || "AI 逻辑推算失败");
        }
      } catch (e: any) {
        useAlert.error("AI 逻辑推算失败: " + (e?.message || "网络异常"));
      } finally {
        setDeductionLoading(false);
      }
    },
    [workId, deductionLoading]
  );

  const handleOpenLogicDeduction = useCallback(
    (nodeId: string) => {
      const curTree = treeRef.current;
      if (!curTree) return;
      const targetNode = findNode(curTree, nodeId);
      if (!targetNode || targetNode.children.length === 0) {
        useAlert.warning("该节点暂无子节点，无法进行大纲逻辑推算");
        return;
      }
      setDeductionNodeId(nodeId);
      if (!targetNode.logicDeduction) {
        runLogicDeduction(nodeId);
      }
    },
    [runLogicDeduction]
  );

  // 快捷键：Ctrl/Cmd+S 保存，导图模式下 Tab 加子节点，Shift+Enter/Enter 上/下方加同级
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      if (viewMode !== "mindmap") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Tab" && selectedId) {
        e.preventDefault();
        handleAddChild(selectedId, "end", true, selectedId === "root" ? "right" : undefined);
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        handleAddSibling(selectedId, e.shiftKey ? "before" : "after", true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewMode, selectedId, handleAddChild, handleAddSibling, handleSave]);

  const renderViewSwitch = () => (
    <Box className={styles.dockSwitchGroup}>
      <button
        type="button"
        className={`${styles.dockSwitchBtn} ${viewMode === "mindmap" ? styles.dockSwitchBtnActive : ""}`}
        onClick={() => setViewMode("mindmap")}
      >
        <FiGitBranch size={13} />
        <span>导图</span>
      </button>
      <button
        type="button"
        className={`${styles.dockSwitchBtn} ${viewMode === "table" ? styles.dockSwitchBtnActive : ""}`}
        onClick={() => setViewMode("table")}
      >
        <FiTable size={13} />
        <span>表格</span>
      </button>
    </Box>
  );

  return (
    <Box className={styles.container}>
      <LoadingMask visible={loading && !tree} label="正在加载项目总纲..." />

      {/* 表格视图下的极简 42px 顶栏（导图模式采用方案 C：零顶栏、底部居中悬浮 Dock） */}
      {viewMode === "table" ? (
        <Flex align="center" justify="space-between" px="md" py={6} gap={12} wrap="wrap" className={styles.toolbar}>
          <Group gap={10}>
            {renderViewSwitch()}
            <Select
              size="xs"
              w={110}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || "all")}
              data={[
                { value: "all", label: "全部状态" },
                { value: "planned", label: "规划中" },
                { value: "in_progress", label: "进行中" },
                { value: "completed", label: "已完成" },
              ]}
            />
            <Button size="xs" variant="default" leftSection={<FiMaximize2 size={12} />} onClick={() => tree && setTree(setAllCollapsed(tree, false))}>
              全部展开
            </Button>
            <Button size="xs" variant="default" leftSection={<FiMinimize2 size={12} />} onClick={() => tree && setTree(setAllCollapsed(tree, true))}>
              全部收起
            </Button>
          </Group>

          <Group gap={8}>
            <Button size="xs" variant="default" leftSection={<FiPlus size={13} />} onClick={() => handleAddChild(selectedId || "root", "end", false)}>
              添加子节点
            </Button>
            <Button size="xs" variant="light" leftSection={<FiCpu size={13} />} onClick={() => setAiModalOpened(true)}>
              AI 生成/反推总纲
            </Button>
            <Button size="xs" leftSection={<FiSave size={13} />} loading={saving} onClick={handleSave}>
              {dirty ? "保存总纲 *" : "保存总纲"}
            </Button>
          </Group>
        </Flex>
      ) : null}

      {/* 主工作区 */}
      {tree ? (
        viewMode === "mindmap" ? (
          <Box flex={1} mih={0} pos="relative" style={{ overflow: "hidden" }}>
            <MindMapView
              ref={mindmapRef}
              tree={tree}
              selectedId={selectedId}
              autoEditNodeId={autoEditNodeId}
              onAutoEditHandled={handleAutoEditHandled}
              zoom={zoom}
              offset={offset}
              onOffsetChange={setOffset}
              onTransformChange={handleTransformChange}
              onSelect={setSelectedId}
              onToggleCollapse={handleToggleCollapse}
              onInlineUpdate={(id, patch) => mutateTree((prev) => updateNode(prev, id, patch))}
              onAddChild={(parentId, position, side) => handleAddChild(parentId, position, true, side)}
              onAddSibling={(targetId, position) => handleAddSibling(targetId, position, true)}
              onMoveNode={(id, dir) => mutateTree((prev) => moveNode(prev, id, dir))}
              onDeleteNode={handleDelete}
              onJumpToAiAnalysis={handleJumpToAiAnalysis}
              onOpenLogicDeduction={handleOpenLogicDeduction}
            />

            {/* 方案 C：底部居中悬浮 Dock（无突兀大 Segmented，无右侧属性栏） */}
            <Box className={styles.floatingDock}>
              {renderViewSwitch()}

              <Box className={styles.dockDivider} />

              <Group gap={2} wrap="nowrap">
                <Tooltip label="缩小">
                  <ActionIcon variant="subtle" color="gray" size={26} radius="xl" onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}>
                    <FiZoomOut size={13} />
                  </ActionIcon>
                </Tooltip>
                <Text fz={11} fw={600} c="#475569" w={38} ta="center">{Math.round(zoom * 100)}%</Text>
                <Tooltip label="放大">
                  <ActionIcon variant="subtle" color="gray" size={26} radius="xl" onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}>
                    <FiZoomIn size={13} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="居中复位">
                  <ActionIcon variant="subtle" color="gray" size={26} radius="xl" onClick={() => mindmapRef.current?.centerOnRoot()}>
                    <FiRefreshCw size={12} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="全屏编辑画布">
                  <ActionIcon variant="subtle" color="gray" size={26} radius="xl" onClick={() => mindmapRef.current?.enterFullscreen()}>
                    <FiMaximize size={13} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <Box className={styles.dockDivider} />

              <Group gap={6} wrap="nowrap">
                <Button size="xs" radius="xl" variant="light" leftSection={<FiCpu size={13} />} onClick={() => setAiModalOpened(true)}>
                  AI 生成
                </Button>
                <Button size="xs" radius="xl" leftSection={<FiSave size={13} />} loading={saving} onClick={handleSave}>
                  {dirty ? "保存总纲 *" : "保存总纲"}
                </Button>
              </Group>
            </Box>
          </Box>
        ) : (
          <TableView
            tree={tree}
            statusFilter={statusFilter}
            onUpdateNode={(id, patch) => mutateTree((prev) => updateNode(prev, id, patch))}
            onAddChild={(parentId) => handleAddChild(parentId, "end", false)}
            onDeleteNode={handleDelete}
            onMoveNode={(id, dir) => mutateTree((prev) => moveNode(prev, id, dir))}
            onToggleCollapse={handleToggleCollapse}
            onJumpToAiAnalysis={handleJumpToAiAnalysis}
            onOpenLogicDeduction={handleOpenLogicDeduction}
          />
        )
      ) : null}

      {/* AI 节点大纲逻辑推算弹窗 */}
      <ModalLogicDeduction
        opened={Boolean(deductionNodeId && deductionTargetNode)}
        onClose={() => setDeductionNodeId(null)}
        node={deductionTargetNode}
        loading={deductionLoading}
        onReDeduce={() => deductionNodeId && runLogicDeduction(deductionNodeId)}
      />

      {/* AI 生成/反推总纲弹窗 */}
      <Modal opened={aiModalOpened} onClose={() => setAiModalOpened(false)} title="AI 一键生成 / 反推项目总纲" centered size="md">
        <Stack gap={12}>
          <Text fz={12} c="#64748b" lh={1.6}>
            AI 将自动读取作品简介、角色档案、世界观规则以及已写章节大纲，生成一棵可直接编辑的总纲树。
          </Text>
          <Textarea
            size="xs"
            label="补充构想或风格要求（选填）"
            placeholder="例如：按四卷结构规划，主线围绕寻找失落古玉展开，末尾反转..."
            minRows={3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <Flex justify="flex-end" gap={8}>
            <Button size="xs" variant="default" onClick={() => setAiModalOpened(false)}>取消</Button>
            <Button size="xs" leftSection={<FiCpu size={13} />} loading={aiLoading} onClick={handleAiGenerate}>
              开始生成
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
