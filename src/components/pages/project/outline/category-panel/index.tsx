"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Checkbox, Flex, Group, Paper, ScrollArea, Text } from "@mantine/core";
import { FiClock, FiCpu, FiMaximize2, FiMinimize2, FiPlus, FiTrash2, FiZap } from "react-icons/fi";
import { OutlineNode, batchDeleteOutlineNodes, deleteOutlineNode, getOutlineList, updateOutlineNode } from "@/rest/outline";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import ChapterOutlineTable from "../chapter-outline-table";
import OutlineAxis from "../outline-axis";
import { OutlineCategoryKey, useOutlineContext } from "../context/OutlineContext";

interface OutlineCategoryPanelProps {
  category: OutlineCategoryKey;
}

export default function OutlineCategoryPanel({ category }: OutlineCategoryPanelProps) {
  const {
    workId,
    refreshVersion,
    setTabCount,
    setActiveCategoryNodes,
    setShowLegacyDeductionList,
    openCreateNode,
    openAddChildNode,
    openEditNode,
    openDeductionDrawer,
    openHistoryDrawer,
    openThoughtDrawer,
  } = useOutlineContext();

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<(number | string)[]>([]);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const reqIdRef = useRef(0);

  const fetchCategoryNodes = useCallback(async () => {
    if (!workId) return;
    const reqId = ++reqIdRef.current;
    try {
      setLoading(true);
      const res = await getOutlineList(workId, category);
      if (reqId !== reqIdRef.current) return;
      if (res && res.success && res.result) {
        const rawList = Array.isArray(res.result)
          ? res.result
          : Array.isArray((res.result as any).list)
          ? (res.result as any).list
          : [];
        setNodes(rawList);
        setTabCount(category, rawList.length);
        setActiveCategoryNodes(rawList);
      }
    } catch (e) {
      if (reqId === reqIdRef.current) {
        console.error(`获取${category}大纲失败:`, e);
      }
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [workId, category, setTabCount, setActiveCategoryNodes]);

  useEffect(() => {
    setSelectedNodeIds([]);
    fetchCategoryNodes();
  }, [fetchCategoryNodes, refreshVersion]);

  const currentRoots = useMemo(() => nodes.filter((n) => !n.parentId), [nodes]);

  const isAllExpanded = useMemo(() => {
    if (currentRoots.length === 0) return true;
    return currentRoots.every((r) => !collapsedParents[String(r.id)]);
  }, [currentRoots, collapsedParents]);

  const handleToggleExpandAll = () => {
    if (isAllExpanded) {
      const nextMap = { ...collapsedParents };
      currentRoots.forEach((r) => {
        nextMap[String(r.id)] = true;
      });
      setCollapsedParents(nextMap);
    } else {
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

  const handleToggleSelectNode = (id: number | string) => {
    setSelectedNodeIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const isAllCurrentSelected = nodes.length > 0 && nodes.every((n) => selectedNodeIds.includes(n.id));

  const handleToggleSelectAll = () => {
    if (isAllCurrentSelected) {
      setSelectedNodeIds([]);
    } else {
      setSelectedNodeIds(nodes.map((n) => n.id));
    }
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
        setNodes((prev) => {
          const next = prev.filter((n) => n.id !== id && n.parentId !== id);
          setTabCount(category, next.length);
          setActiveCategoryNodes(next);
          return next;
        });
        setSelectedNodeIds((prev) => prev.filter((i) => i !== id));
        useAlert.success("已删除该卡片及下属情节");
      } catch (err: any) {
        useAlert.error("删除失败: " + (err?.message || "网络异常"));
      }
    }
  };

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
        setNodes((prev) => {
          const next = prev.filter((n) => !selectedNodeIds.includes(n.id));
          setTabCount(category, next.length);
          setActiveCategoryNodes(next);
          return next;
        });
        setSelectedNodeIds([]);
        useAlert.success(`已成功批量删除 ${selectedNodeIds.length} 个大纲卡片`);
      } catch (err: any) {
        useAlert.error("批量删除失败: " + (err?.message || "网络异常"));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMoveNode = async (node: OutlineNode, direction: "up" | "down") => {
    const siblingList = nodes.filter((n) => (n.parentId ?? null) === (node.parentId ?? null));
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
      fetchCategoryNodes();
    }
  };

  return (
    <Flex direction="column" flex={1} mih={0} pos="relative" style={{ overflow: "hidden" }}>
      <LoadingMask visible={loading} />

      <Flex justify="space-between" align="center" px="md" py={10} bg="#fafafa" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Paper withBorder radius="md" px="sm" py={5} bg="#ffffff" bd="1px solid #e2e8f0" style={{ boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)" }}>
          <Flex align="center" gap={12}>
            <Checkbox
              size="sm"
              label={
                <Text fz={13} fw={600} c={isAllCurrentSelected ? "#00c9ff" : "#334155"}>
                  {isAllCurrentSelected ? "取消全选" : "全选当前"}
                </Text>
              }
              checked={isAllCurrentSelected}
              indeterminate={selectedNodeIds.length > 0 && !isAllCurrentSelected}
              onChange={handleToggleSelectAll}
              styles={{ input: { cursor: "pointer" }, label: { cursor: "pointer", userSelect: "none" } }}
            />

            <Box w={1} h={16} bg="#e2e8f0" />

            <Button
              size="xs"
              variant="light"
              color={isAllExpanded ? undefined : "gray"}
              radius="sm"
              leftSection={isAllExpanded ? <FiMinimize2 size={13} /> : <FiMaximize2 size={13} />}
              onClick={handleToggleExpandAll}
            >
              {isAllExpanded ? "全部收起" : "全部展开"}
            </Button>
          </Flex>
        </Paper>

        <Group gap="sm" align="center">
          <Button
            variant={selectedNodeIds.length > 0 ? "filled" : "light"}
            color="red"
            leftSection={<FiTrash2 size={15} />}
            loading={loading}
            onClick={handleBatchDelete}
          >
            批量删除{selectedNodeIds.length > 0 ? ` (${selectedNodeIds.length})` : ""}
          </Button>

          {category === "chapter" ? (
            <Button variant="default" leftSection={<FiPlus size={15} />} onClick={() => openCreateNode("chapter")}>
              新建章节大纲
            </Button>
          ) : null}

          {category === "deduction" ? (
            <Group gap="xs">
              <Button variant="light" onClick={() => setShowLegacyDeductionList(false)}>
                返回章节走向推演工作台
              </Button>
              <Button variant="filled" leftSection={<FiZap size={15} />} onClick={() => openDeductionDrawer(null)}>
                A➔B 剧情推演
              </Button>
              <Button variant="default" leftSection={<FiClock size={15} />} onClick={openHistoryDrawer}>
                推演历史
              </Button>
            </Group>
          ) : null}

          {category === "memo" ? (
            <Group gap="xs">
              <Button variant="light" leftSection={<FiCpu size={15} />} onClick={openThoughtDrawer}>
                AI 思路整理
              </Button>
              <Button variant="default" leftSection={<FiPlus size={15} />} onClick={() => openCreateNode("memo")}>
                新建随手卡片
              </Button>
            </Group>
          ) : null}
        </Group>
      </Flex>

      <ScrollArea flex={1} px={16} py={12}>
        <Box mx="auto" pb={80}>
          {category === "chapter" ? (
            <ChapterOutlineTable
              workId={workId}
              nodes={nodes}
              selectedNodeIds={selectedNodeIds}
              collapsedParents={collapsedParents}
              onToggleParentCollapse={handleToggleParentCollapse}
              onToggleSelectNode={handleToggleSelectNode}
              onEditNode={(node) => openEditNode(node, nodes, "chapter")}
              onDeleteNode={handleDeleteNode}
              onMoveNode={handleMoveNode}
              onAddChildNode={(parent) => openAddChildNode(parent, "chapter")}
              onTriggerCreate={() => openCreateNode("chapter")}
            />
          ) : (
            <OutlineAxis
              workId={workId}
              category={category}
              nodes={nodes}
              selectedNodeIds={selectedNodeIds}
              onToggleSelectNode={handleToggleSelectNode}
              onEditNode={(node) => openEditNode(node, nodes, category)}
              onDeleteNode={handleDeleteNode}
              onMoveNode={handleMoveNode}
              onAddChildNode={(parent) => openAddChildNode(parent, category)}
              onTriggerDeduction={() => openDeductionDrawer(null)}
              onTriggerCreate={() => openCreateNode(category)}
              collapsedParents={collapsedParents}
              onToggleParentCollapse={handleToggleParentCollapse}
            />
          )}
        </Box>
      </ScrollArea>
    </Flex>
  );
}
