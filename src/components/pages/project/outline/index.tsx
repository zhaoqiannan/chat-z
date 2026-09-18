// 组件：故事大纲工作台（全选旁增加全部展开/收起、批量删除移至右侧、推演与历史双按钮、抽屉55vw、默认按钮尺寸）
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Flex,
  Button,
  LoadingOverlay,
  Group,
  Tabs,
  ScrollArea,
  Checkbox,
  Paper,
  Text,
} from "@mantine/core";
import {
  FiPlus,
  FiZap,
  FiBookOpen,
  FiEdit3,
  FiTrash2,
  FiCpu,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiMinimize2,
  FiMaximize2,
} from "react-icons/fi";
import {
  OutlineNode,
  getOutlineList,
  createOutlineNode,
  updateOutlineNode,
  deleteOutlineNode,
  batchDeleteOutlineNodes,
  PlotDeductionRecord,
} from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import OutlineAxis from "./outline-axis";
import ModalNodeEditor from "./modal-node-editor";
import DrawerPlotDeduction from "./drawer-plot-deduction";
import DrawerPlotDeductionHistory from "./drawer-plot-deduction/drawer-plot-deduction-history";
import DrawerThoughtOrganizer from "./drawer-thought-organizer";

export default function StoryOutlinePage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("chapter");
  const [selectedNodeIds, setSelectedNodeIds] = useState<(number | string)[]>([]);

  // 弹窗与抽屉状态
  const [editorModalOpened, setEditorModalOpened] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [parentForNewChild, setParentForNewChild] = useState<OutlineNode | null>(null);

  // 剧情推演与历史双抽屉独立状态
  const [deductionDrawerOpened, setDeductionDrawerOpened] = useState(false);
  const [historyDrawerOpened, setHistoryDrawerOpened] = useState(false);
  const [loadedDeductionRecord, setLoadedDeductionRecord] = useState<PlotDeductionRecord | null>(null);

  // AI 思路整理抽屉状态
  const [thoughtDrawerOpened, setThoughtDrawerOpened] = useState(false);

  // 树结构折叠状态管理（用于支持全局 全部展开 / 全部收起）
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  const fetchOutline = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getOutlineList(workId);
      if (res && res.success && res.result) {
        const rawList = Array.isArray(res.result)
          ? res.result
          : Array.isArray((res.result as any).list)
          ? (res.result as any).list
          : [];
        setNodes(rawList);
      }
    } catch (e) {
      console.error("获取故事大纲失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutline();
  }, [workId]);

  // 分类数据过滤
  const chapterNodes = useMemo(
    () => nodes.filter((n) => (n.category || (n.isFromChapter || n.chapterId ? "chapter" : "memo")) === "chapter"),
    [nodes]
  );
  const deductionNodes = useMemo(
    () => nodes.filter((n) => n.category === "deduction"),
    [nodes]
  );
  const memoNodes = useMemo(
    () => nodes.filter((n) => n.category === "memo" || (!n.category && !n.isFromChapter && !n.chapterId)),
    [nodes]
  );

  const currentCategory: "chapter" | "deduction" | "memo" =
    activeTab === "deduction" ? "deduction" : activeTab === "memo" ? "memo" : "chapter";

  const currentList = useMemo(() => {
    if (activeTab === "deduction") return deductionNodes;
    if (activeTab === "memo") return memoNodes;
    return chapterNodes;
  }, [activeTab, chapterNodes, deductionNodes, memoNodes]);

  // 当前 Tab 下的所有根节点列表
  const currentRoots = useMemo(
    () => currentList.filter((n) => !n.parentId),
    [currentList]
  );

  // 判断是否全部展开
  const isAllExpanded = useMemo(() => {
    if (currentRoots.length === 0) return true;
    return currentRoots.every((r) => !collapsedParents[String(r.id)]);
  }, [currentRoots, collapsedParents]);

  // 全部展开 / 全部收起 切换
  const handleToggleExpandAll = () => {
    if (isAllExpanded) {
      // 全部收起
      const nextMap = { ...collapsedParents };
      currentRoots.forEach((r) => {
        nextMap[String(r.id)] = true;
      });
      setCollapsedParents(nextMap);
    } else {
      // 全部展开
      const nextMap = { ...collapsedParents };
      currentRoots.forEach((r) => {
        delete nextMap[String(r.id)];
      });
      setCollapsedParents(nextMap);
    }
  };

  const handleToggleParentCollapse = (parentId: number | string) => {
    setCollapsedParents((prev) => ({
      ...prev,
      [String(parentId)]: !prev[String(parentId)],
    }));
  };

  const handleOpenCreateNode = () => {
    setEditingNode(null);
    setParentForNewChild(null);
    setEditorModalOpened(true);
  };

  const handleOpenAddChildNode = (parentNode: OutlineNode) => {
    setEditingNode(null);
    setParentForNewChild(parentNode);
    setEditorModalOpened(true);
  };

  const handleOpenEditNode = (node: OutlineNode) => {
    // 组装带 children 的完整节点对象
    const childList = nodes.filter((n) => Number(n.parentId) === Number(node.id));
    setEditingNode({ ...node, children: childList });
    setParentForNewChild(null);
    setEditorModalOpened(true);
  };

  const handleToggleSelectNode = (id: number | string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteNode = async (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await showConfirm({
      title: "删除大纲卡片",
      message: "确定要删除该卡片吗？若有下属子情节将一并删除。",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deleteOutlineNode(id);
        setNodes((prev) => prev.filter((n) => n.id !== id && n.parentId !== id));
        setSelectedNodeIds((prev) => prev.filter((i) => i !== id));
        useAlert.success("已删除该卡片及下属情节");
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  // 批量删除：位于操作栏右侧
  const handleBatchDelete = async () => {
    if (selectedNodeIds.length === 0) {
      useAlert.warning("请先在左侧勾选需要删除的卡片");
      return;
    }

    const isConfirmed = await showConfirm({
      title: "批量删除大纲卡片",
      message: `确定要批量删除选中的 ${selectedNodeIds.length} 个大纲卡片吗？此操作不可撤销。`,
      confirmLabel: `确认删除 (${selectedNodeIds.length} 项)`,
      confirmColor: "red",
    });

    if (isConfirmed) {
      try {
        setLoading(true);
        await batchDeleteOutlineNodes(selectedNodeIds);
        setNodes((prev) => prev.filter((n) => !selectedNodeIds.includes(n.id)));
        setSelectedNodeIds([]);
        useAlert.success(`已成功批量删除 ${selectedNodeIds.length} 个大纲卡片`);
      } catch (e: any) {
        useAlert.error("批量删除失败: " + (e?.message || "网络异常"));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMoveNode = async (node: OutlineNode, direction: "up" | "down") => {
    const siblingList = currentList.filter((n) => (n.parentId ?? null) === (node.parentId ?? null));
    const currentIndex = siblingList.findIndex((n) => n.id === node.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblingList.length) return;

    const targetNode = siblingList[targetIndex];

    const newNodes = [...nodes];
    const nIndex = newNodes.findIndex((n) => n.id === node.id);
    const tIndex = newNodes.findIndex((n) => n.id === targetNode.id);
    if (nIndex !== -1 && tIndex !== -1) {
      const tempOrder = newNodes[nIndex].orderIndex;
      newNodes[nIndex] = { ...newNodes[nIndex], orderIndex: newNodes[tIndex].orderIndex };
      newNodes[tIndex] = { ...newNodes[tIndex], orderIndex: tempOrder };
      setNodes(newNodes);
    }

    try {
      await Promise.all([
        updateOutlineNode({ id: node.id, orderIndex: targetNode.orderIndex }),
        updateOutlineNode({ id: targetNode.id, orderIndex: node.orderIndex }),
      ]);
    } catch (e) {
      console.error("更新排序失败:", e);
      fetchOutline();
    }
  };

  // 全选/取消全选二合一逻辑
  const isAllCurrentSelected =
    currentList.length > 0 &&
    currentList.every((n) => selectedNodeIds.includes(n.id));

  const handleToggleSelectAll = () => {
    if (isAllCurrentSelected) {
      const currentIds = new Set(currentList.map((n) => n.id));
      setSelectedNodeIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const combined = Array.from(
        new Set([...selectedNodeIds, ...currentList.map((n) => n.id)])
      );
      setSelectedNodeIds(combined);
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <LoadingOverlay visible={loading && nodes.length === 0} />

      {/* 第一行：三大 Tab 切换栏 */}
      <Box style={{ borderBottom: "1px solid #f1f5f9" }} px="md" pt={6}>
        <Tabs
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val);
            setSelectedNodeIds([]);
          }}
        >
          <Tabs.List>
            <Tabs.Tab
              value="chapter"
              leftSection={<FiBookOpen size={15} color="#0d9488" />}
            >
              章节大纲 ({chapterNodes.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="deduction"
              leftSection={<FiZap size={15} color="#2563eb" />}
            >
              剧情推演 ({deductionNodes.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="memo"
              leftSection={<FiEdit3 size={15} color="#64748b" />}
            >
              随手卡片 ({memoNodes.length})
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Box>

      {/* 第二行：专属工具操作条（左侧保留全选与展开收起，右侧放批量删除与Tab操作，默认按钮尺寸） */}
      <Flex
        justify="space-between"
        align="center"
        px="md"
        py={10}
        style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fafafa" }}
      >
        {/* 左侧：精美一体化控制胶囊 (全选当前 + 全部展开/收起) */}
        <Paper
          withBorder
          radius="md"
          px="sm"
          py={5}
          style={{
            backgroundColor: "#ffffff",
            borderColor: "#e2e8f0",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Checkbox
            size="sm"
            label={
              <Text fz={13} fw={600} c={isAllCurrentSelected ? "blue.7" : "#334155"}>
                {isAllCurrentSelected ? "取消全选" : "全选当前"}
              </Text>
            }
            checked={isAllCurrentSelected}
            indeterminate={selectedNodeIds.length > 0 && !isAllCurrentSelected}
            onChange={handleToggleSelectAll}
            styles={{
              input: { cursor: "pointer" },
              label: { cursor: "pointer", userSelect: "none" },
            }}
          />

          <Box style={{ width: 1, height: 16, backgroundColor: "#e2e8f0" }} />

          <Button
            variant="light"
            color={isAllExpanded ? "blue" : "gray"}
            radius="sm"
            leftSection={
              isAllExpanded ? (
                <FiMinimize2 size={13} style={{ strokeWidth: 2.2 }} />
              ) : (
                <FiMaximize2 size={13} style={{ strokeWidth: 2.2 }} />
              )
            }
            onClick={handleToggleExpandAll}
            style={{
              fontWeight: 600,
              fontSize: 13,
              height: 30,
              paddingLeft: 10,
              paddingRight: 10,
            }}
          >
            {isAllExpanded ? "全部收起" : "全部展开"}
          </Button>
        </Paper>

        {/* 右侧：批量删除按钮 + 当前 Tab 专属操作按钮 */}
        <Group gap="sm" align="center">
          <Button
            variant={selectedNodeIds.length > 0 ? "filled" : "light"}
            color="red"
            leftSection={<FiTrash2 size={15} />}
            onClick={handleBatchDelete}
            loading={loading}
          >
            批量删除{selectedNodeIds.length > 0 ? ` (${selectedNodeIds.length})` : ""}
          </Button>

          {activeTab === "chapter" && (
            <Button
              variant="default"
              leftSection={<FiPlus size={15} />}
              onClick={handleOpenCreateNode}
            >
              新建章节大纲
            </Button>
          )}

          {activeTab === "deduction" && (
            <Group gap="xs">
              <Button
                variant="filled"
                color="blue"
                leftSection={<FiZap size={15} />}
                onClick={() => setDeductionDrawerOpened(true)}
              >
                A➔B 剧情推演
              </Button>
              <Button
                variant="default"
                leftSection={<FiClock size={15} />}
                onClick={() => setHistoryDrawerOpened(true)}
              >
                推演历史
              </Button>
            </Group>
          )}

          {activeTab === "memo" && (
            <Group gap="xs">
              <Button
                variant="light"
                color="blue"
                leftSection={<FiCpu size={15} />}
                onClick={() => setThoughtDrawerOpened(true)}
              >
                AI 思路整理
              </Button>
              <Button
                variant="default"
                leftSection={<FiPlus size={15} />}
                onClick={handleOpenCreateNode}
              >
                新建随手卡片
              </Button>
            </Group>
          )}
        </Group>
      </Flex>

      {/* 故事大纲列表主体（树状结构呈现） */}
      <ScrollArea style={{ flex: 1 }} px={24} py="md">
        <Box mx="auto" pb={80}>
          <OutlineAxis
            workId={workId}
            category={currentCategory}
            nodes={currentList}
            selectedNodeIds={selectedNodeIds}
            onToggleSelectNode={handleToggleSelectNode}
            onEditNode={handleOpenEditNode}
            onDeleteNode={handleDeleteNode}
            onMoveNode={handleMoveNode}
            onAddChildNode={handleOpenAddChildNode}
            onTriggerDeduction={() => setDeductionDrawerOpened(true)}
            onTriggerCreate={handleOpenCreateNode}
            collapsedParents={collapsedParents}
            onToggleParentCollapse={handleToggleParentCollapse}
          />
        </Box>
      </ScrollArea>

      {/* 大纲卡片编辑/创建弹窗 (宽度 55vw) */}
      <ModalNodeEditor
        opened={editorModalOpened}
        onClose={() => {
          setEditorModalOpened(false);
          setEditingNode(null);
          setParentForNewChild(null);
        }}
        workId={workId}
        category={currentCategory}
        editingNode={editingNode}
        onSaved={fetchOutline}
        onSubmitCreate={(payload) => {
          if (parentForNewChild) {
            return createOutlineNode({
              ...payload,
              parentId: parentForNewChild.id,
              level: 2,
            });
          }
          return createOutlineNode(payload);
        }}
        onSubmitUpdate={updateOutlineNode}
      />

      {/* A➔B 跨度推演工作台抽屉 (宽度 55vw) */}
      <DrawerPlotDeduction
        opened={deductionDrawerOpened}
        onClose={() => setDeductionDrawerOpened(false)}
        workId={workId}
        outlineNodes={nodes}
        onOutlineUpdated={fetchOutline}
        loadedRecord={loadedDeductionRecord}
      />

      {/* 独立剧情推演历史抽屉 (宽度 55vw) */}
      <DrawerPlotDeductionHistory
        opened={historyDrawerOpened}
        onClose={() => setHistoryDrawerOpened(false)}
        workId={workId}
        onOutlineUpdated={fetchOutline}
        onLoadToDeduct={(rec) => {
          setLoadedDeductionRecord(rec);
          setDeductionDrawerOpened(true);
        }}
      />

      {/* AI 思路整理抽屉 (宽度 55vw) */}
      <DrawerThoughtOrganizer
        opened={thoughtDrawerOpened}
        onClose={() => setThoughtDrawerOpened(false)}
        workId={workId}
        onOutlineUpdated={fetchOutline}
      />
    </Box>
  );
}
