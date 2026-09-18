// 组件：故事大纲与章节故事轴主工作台（双向章节镜像、批量删除、A➔B 跨度推演、角色标签与笔记全文联动）
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Flex,
  Text,
  Button,
  LoadingOverlay,
  Group,
  Tabs,
  Paper,
  ScrollArea,
  Badge,
  Checkbox,
} from "@mantine/core";
import {
  FiPlus,
  FiZap,
  FiLayers,
  FiCheckCircle,
  FiClock,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  OutlineNode,
  CreateOutlinePayload,
  UpdateOutlinePayload,
  getOutlineList,
  createOutlineNode,
  updateOutlineNode,
  deleteOutlineNode,
  batchDeleteOutlineNodes,
} from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import OutlineAxis from "./outline-axis";
import ModalNodeEditor from "./modal-node-editor";
import DrawerPlotDeduction from "./drawer-plot-deduction";

export default function StoryOutlinePage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [selectedNodeIds, setSelectedNodeIds] = useState<(number | string)[]>([]);

  // 弹窗与抽屉状态
  const [editorModalOpened, setEditorModalOpened] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [deductionDrawerOpened, setDeductionDrawerOpened] = useState(false);

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

  const handleOpenCreateNode = () => {
    setEditingNode(null);
    setEditorModalOpened(true);
  };

  const handleOpenEditNode = (node: OutlineNode) => {
    setEditingNode(node);
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
      message: "确定要删除该情节卡片吗？此操作不可撤销。",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deleteOutlineNode(id);
        setNodes((prev) => prev.filter((n) => n.id !== id));
        setSelectedNodeIds((prev) => prev.filter((i) => i !== id));
        useAlert.success("已删除该大纲卡片");
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  // 批量删除选中的卡片
  const handleBatchDelete = async () => {
    if (selectedNodeIds.length === 0) return;

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
    const currentIndex = nodes.findIndex((n) => n.id === node.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= nodes.length) return;

    const targetNode = nodes[targetIndex];
    const newNodes = [...nodes];
    newNodes[currentIndex] = targetNode;
    newNodes[targetIndex] = node;

    // 乐观更新
    setNodes(newNodes);

    try {
      await Promise.all([
        updateOutlineNode({ id: node.id, orderIndex: targetIndex }),
        updateOutlineNode({ id: targetNode.id, orderIndex: currentIndex }),
      ]);
    } catch (e) {
      console.error("更新排序失败:", e);
      fetchOutline();
    }
  };

  // 统计数据
  const completedCount = nodes.filter(
    (n) => n.status === "completed" || n.isFromChapter === 1 || !!n.chapterId
  ).length;
  const plannedCount = nodes.length - completedCount;

  // 根据当前标签筛选
  const filteredNodes = useMemo(() => {
    if (activeTab === "completed") {
      return nodes.filter(
        (n) => n.status === "completed" || n.isFromChapter === 1 || !!n.chapterId
      );
    }
    if (activeTab === "planned") {
      return nodes.filter(
        (n) => !(n.status === "completed" || n.isFromChapter === 1 || !!n.chapterId)
      );
    }
    return nodes;
  }, [nodes, activeTab]);

  const isAllFilteredSelected =
    filteredNodes.length > 0 &&
    filteredNodes.every((n) => selectedNodeIds.includes(n.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // 取消当前筛选项的选择
      const filteredIds = new Set(filteredNodes.map((n) => n.id));
      setSelectedNodeIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      // 全选当前筛选项
      const combined = Array.from(
        new Set([...selectedNodeIds, ...filteredNodes.map((n) => n.id)])
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

      {/* 顶部工具栏 */}
      <Flex
        justify="space-between"
        align="center"
        px="md"
        py={12}
        style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#ffffff" }}
      >
        <Group gap="xs" align="center">
          <FiLayers size={18} color="#0284c7" />
          <Text fz={16} fw={700} c="#0f172a">
            故事大纲与章节故事轴
          </Text>
          <Badge variant="light" color="gray" size="sm">
            共 {nodes.length} 个情节 · {completedCount} 篇正文同步 · {plannedCount} 条待写规划
          </Badge>
        </Group>

        <Group gap="xs">
          {selectedNodeIds.length > 0 ? (
            <Group gap="xs">
              <Button
                size="xs"
                variant="filled"
                color="red"
                leftSection={<FiTrash2 size={13} />}
                onClick={handleBatchDelete}
                loading={loading}
              >
                批量删除 ({selectedNodeIds.length} 项)
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<FiX size={13} />}
                onClick={() => setSelectedNodeIds([])}
              >
                取消多选
              </Button>
            </Group>
          ) : (
            <Group gap="xs">
              <Button
                size="xs"
                variant="filled"
                color="blue"
                leftSection={<FiZap size={13} />}
                onClick={() => setDeductionDrawerOpened(true)}
              >
                ✨ A➔B 剧情推演 (起终点桥接)
              </Button>

              <Button
                size="xs"
                variant="default"
                leftSection={<FiPlus size={13} />}
                onClick={handleOpenCreateNode}
              >
                随手添加情节卡片
              </Button>
            </Group>
          )}
        </Group>
      </Flex>

      {/* 视图过滤标签栏与多选操作栏 */}
      <Flex
        justify="space-between"
        align="center"
        px="md"
        pt="xs"
        style={{ borderBottom: "1px solid #f8fafc" }}
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="all" leftSection={<FiLayers size={13} />}>
              全部故事轴 ({nodes.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="completed"
              leftSection={<FiCheckCircle size={13} color="#16a34a" />}
            >
              已写正文轴 ({completedCount})
            </Tabs.Tab>
            <Tabs.Tab
              value="planned"
              leftSection={<FiClock size={13} color="#0284c7" />}
            >
              待写规划轴 ({plannedCount})
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {filteredNodes.length > 0 && (
          <Group gap="xs" align="center" pb={6}>
            <Checkbox
              size="xs"
              label={isAllFilteredSelected ? "取消全选" : "全选当前项"}
              checked={isAllFilteredSelected}
              indeterminate={
                selectedNodeIds.length > 0 && !isAllFilteredSelected
              }
              onChange={handleToggleSelectAll}
            />
          </Group>
        )}
      </Flex>

      {/* 故事轴主体列表 */}
      <ScrollArea style={{ flex: 1 }} px="md" py="xs">
        <Box maw={980} mx="auto" pb={60}>
          <OutlineAxis
            workId={workId}
            nodes={filteredNodes}
            selectedNodeIds={selectedNodeIds}
            onToggleSelectNode={handleToggleSelectNode}
            onEditNode={handleOpenEditNode}
            onDeleteNode={handleDeleteNode}
            onMoveNode={handleMoveNode}
          />
        </Box>
      </ScrollArea>

      {/* 大纲卡片编辑/创建弹窗 */}
      <ModalNodeEditor
        opened={editorModalOpened}
        onClose={() => setEditorModalOpened(false)}
        workId={workId}
        editingNode={editingNode}
        onSaved={fetchOutline}
        onSubmitCreate={createOutlineNode}
        onSubmitUpdate={updateOutlineNode}
      />

      {/* A➔B 跨度推演抽屉 */}
      <DrawerPlotDeduction
        opened={deductionDrawerOpened}
        onClose={() => setDeductionDrawerOpened(false)}
        workId={workId}
        outlineNodes={nodes}
        onOutlineUpdated={fetchOutline}
      />
    </Box>
  );
}
