"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, Flex, Grid, LoadingOverlay, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  getOutlineList,
  createOutlineNode,
  updateOutlineNode,
  deleteOutlineNode,
  batchCreateOutlineNodes,
  requestOutlineAi,
  OutlineNode,
  CreateOutlinePayload,
  UpdateOutlinePayload,
  OutlineNodeType,
  OutlineAiHistoryRecord,
} from "@/rest/outline";
import { getWorkDetail, WorkItem } from "@/rest/work";
import TreePanel from "./tree-panel";
import DetailPanel from "./detail-panel";
import ModalCreateNode from "./modal-create-node";
import ModalAiAssistant from "./modal-ai-assistant";
import ModalAiPreview, { PreviewData } from "./modal-ai-preview";
import DrawerAiHistory from "./drawer-ai-history";

/**
 * 将平铺的 Outline 数组转化为树形结构
 */
function buildTree(flatList: OutlineNode[]): OutlineNode[] {
  const map: Record<string, OutlineNode> = {};
  const roots: OutlineNode[] = [];

  flatList.forEach((item) => {
    map[item.id] = { ...item, children: [] };
  });

  flatList.forEach((item) => {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children!.push(map[item.id]);
    } else {
      roots.push(map[item.id]);
    }
  });

  return roots;
}

export default function StoryOutlinePage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [work, setWork] = useState<WorkItem | null>(null);
  const [flatNodes, setFlatNodes] = useState<OutlineNode[]>([]);
  const [treeNodes, setTreeNodes] = useState<OutlineNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<OutlineNode | null>(null);
  const [isOverviewSelected, setIsOverviewSelected] = useState<boolean>(false);

  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createDefaultType, setCreateDefaultType] = useState<OutlineNodeType>("scene");

  const [aiAssistantOpened, setAiAssistantOpened] = useState(false);
  const [historyDrawerOpened, setHistoryDrawerOpened] = useState(false);
  const [previewModalOpened, setPreviewModalOpened] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  /**
   * 加载作品详情与大纲节点列表
   */
  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const [workRes, outlineRes] = await Promise.all([
        getWorkDetail(workId),
        getOutlineList(workId),
      ]);

      if (workRes && workRes.success && workRes.result) {
        setWork(workRes.result);
      }

      if (outlineRes && outlineRes.success) {
        const rawTree: OutlineNode[] = Array.isArray(outlineRes.result) ? outlineRes.result : [];
        const rawFlat: OutlineNode[] = Array.isArray((outlineRes as any).flatList)
          ? (outlineRes as any).flatList
          : rawTree;

        setFlatNodes(rawFlat);
        const hasChildrenStructure = rawTree.some((n) => Array.isArray(n.children));
        setTreeNodes(hasChildrenStructure ? rawTree : buildTree(rawFlat));

        if (selectedNode) {
          const found = rawFlat.find((n) => n.id === selectedNode.id);
          setSelectedNode(found || (rawFlat.length > 0 ? rawFlat[0] : null));
        } else if (rawFlat.length > 0 && !isOverviewSelected) {
          setSelectedNode(rawFlat[0]);
        }
      }
    } catch (e) {
      console.error("加载故事大纲失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workId]);

  /**
   * 选中具体节点
   */
  const handleSelectNode = (node: OutlineNode) => {
    setIsOverviewSelected(false);
    setSelectedNode(node);
  };

  /**
   * 选中全文大纲
   */
  const handleSelectOverview = () => {
    setIsOverviewSelected(true);
  };

  /**
   * 打开创建顶级根节点弹窗
   */
  const handleOpenCreateRoot = () => {
    setCreateParentId(null);
    setCreateDefaultType("volume");
    setCreateModalOpened(true);
  };

  /**
   * 打开创建同级节点弹窗
   */
  const handleOpenCreateSibling = (parentId: string | null) => {
    setCreateParentId(parentId);
    setCreateDefaultType(selectedNode?.type || "scene");
    setCreateModalOpened(true);
  };

  /**
   * 打开创建子节点弹窗
   */
  const handleOpenCreateChild = (parentId: string) => {
    setCreateParentId(parentId);
    const childType: OutlineNodeType =
      selectedNode?.type === "story"
        ? "volume"
        : selectedNode?.type === "volume"
          ? "act"
          : "scene";
    setCreateDefaultType(childType);
    setCreateModalOpened(true);
  };

  /**
   * 提交新增节点
   */
  const handleCreateNode = async (data: CreateOutlinePayload) => {
    const res = await createOutlineNode(data);
    if (res && res.success) {
      await fetchData();
      if (res.result) {
        setIsOverviewSelected(false);
        setSelectedNode(res.result);
      }
    }
  };

  /**
   * 提交更新节点
   */
  const handleUpdateNode = async (data: UpdateOutlinePayload) => {
    const res = await updateOutlineNode(data);
    if (res && res.success) {
      await fetchData();
    }
  };

  /**
   * 删除节点二次确认弹窗
   */
  const handleDeleteNode = (id: string) => {
    const target = flatNodes.find((n) => n.id === id);
    modals.openConfirmModal({
      title: "删除大纲节点确认",
      centered: true,
      children: (
        <Text size="sm" c="#475569" lh={1.6}>
          确定要删除节点 <b>「{target?.title || "该节点"}」</b> 及其所有子节点吗？
          <br />
          <Text span fz="xs" c="#ef4444">
            该操作不可逆，所有下属情节点都将被一并移除。
          </Text>
        </Text>
      ),
      labels: { confirm: "确认删除", cancel: "取消" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const res = await deleteOutlineNode(id);
        if (res && res.success) {
          await fetchData();
          if (selectedNode?.id === id) {
            setSelectedNode(null);
            setIsOverviewSelected(true);
          }
        }
      },
    });
  };

  /**
   * 触发单节点专属 AI 辅助
   */
  const handleTriggerNodeAi = async (action: "expand_node" | "split_node") => {
    if (!selectedNode) return;
    try {
      setLoading(true);
      const res = await requestOutlineAi({
        workId,
        action,
        targetNodeId: selectedNode.id,
        targetNode: selectedNode,
      });

      if (res && res.success && res.result) {
        setPreviewData(res.result);
        setPreviewModalOpened(true);
      }
    } catch (e) {
      console.error("触发节点 AI 失败:", e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * AI 结果全部采纳写入
   */
  const handleApplyAiAll = async (data: PreviewData) => {
    if (data.expandedData && selectedNode) {
      await handleUpdateNode({
        id: selectedNode.id,
        ...data.expandedData,
      });
      return;
    }

    if (data.splitScenes && data.splitScenes.length > 0) {
      const pId = selectedNode?.id || null;
      const nodesToInsert = data.splitScenes.map((s, idx) => ({
        ...s,
        parentId: pId,
        orderIndex: idx,
      }));
      await batchCreateOutlineNodes(workId, nodesToInsert);
      await fetchData();
      return;
    }

    if (data.generatedTree && data.generatedTree.length > 0) {
      const flattenedNodes: any[] = [];
      const traverse = (items: any[], pId: string | null) => {
        items.forEach((item, idx) => {
          const currentId = item.id || crypto.randomUUID();
          flattenedNodes.push({
            id: currentId,
            parentId: pId,
            type: item.type || "scene",
            pointType: item.pointType,
            title: item.title,
            goal: item.goal,
            conflict: item.conflict,
            eventDescription: item.eventDescription,
            expectedOutcome: item.expectedOutcome,
            characters: item.characters,
            locations: item.locations,
            foreshadowing: item.foreshadowing,
            linkedChapters: item.linkedChapters,
            orderIndex: idx,
          });
          if (item.children && item.children.length > 0) {
            traverse(item.children, currentId);
          }
        });
      };
      traverse(data.generatedTree, null);
      await batchCreateOutlineNodes(workId, flattenedNodes);
      await fetchData();
    }
  };

  /**
   * AI 结果部分勾选采纳
   */
  const handleApplyAiSelected = async (selectedItems: any[]) => {
    if (!selectedItems || selectedItems.length === 0) return;
    const pId = selectedNode?.id || null;
    const nodesToInsert = selectedItems.map((s, idx) => ({
      ...s,
      parentId: pId,
      orderIndex: idx,
    }));
    await batchCreateOutlineNodes(workId, nodesToInsert);
    await fetchData();
  };

  const handleSelectHistoryVersion = (record: OutlineAiHistoryRecord) => {
    if (!record || !record.resultPayload) return;
    const payload = record.resultPayload;
    setPreviewData({
      action: record.action,
      summary: `历史版本恢复 [${record.title}]`,
      generatedTree: payload.generatedTree,
      expandedData: payload.expandedData,
      splitScenes: payload.splitScenes,
      chapterPlans: payload.chapterPlans,
      diagnosis: payload.diagnosis,
      alternatives: payload.alternatives,
    });
    setPreviewModalOpened(true);
  };

  const parentOptions = flatNodes
    .filter((n) => n.id !== selectedNode?.id)
    .map((n) => ({
      value: n.id,
      label: `${n.type === "story" ? "🌟" : n.type === "volume" ? "📁" : "🎬"} ${n.title}`,
    }));

  return (<>
    <Grid bg={'#fff'}>
      <Grid.Col span={4}>
        <TreePanel
          nodes={treeNodes}
          selectedNodeId={selectedNode?.id || null}
          isOverviewSelected={isOverviewSelected}
          onSelectNode={handleSelectNode}
          onSelectOverview={handleSelectOverview}
          onOpenCreateRoot={handleOpenCreateRoot}
          onOpenCreateChild={handleOpenCreateChild}
          onOpenHistory={() => setHistoryDrawerOpened(true)}
        />
      </Grid.Col>
      <Grid.Col span={8}>
        <DetailPanel
          node={selectedNode}
          work={work}
          isOverview={isOverviewSelected}
          parentOptions={parentOptions}
          onSave={handleUpdateNode}
          onTriggerNodeAi={handleTriggerNodeAi}
          onOpenAiAssistant={() => setAiAssistantOpened(true)}
          onOpenHistory={() => setHistoryDrawerOpened(true)}
          onOpenCreateSibling={handleOpenCreateSibling}
          onOpenCreateChild={handleOpenCreateChild}
          onDeleteNode={handleDeleteNode}
        />
      </Grid.Col>
    </Grid>

    <ModalCreateNode
      opened={createModalOpened}
      onClose={() => setCreateModalOpened(false)}
      workId={workId}
      parentOptions={parentOptions}
      defaultParentId={createParentId}
      defaultType={createDefaultType}
      onSubmit={handleCreateNode}
    />

    <ModalAiAssistant
      opened={aiAssistantOpened}
      onClose={() => setAiAssistantOpened(false)}
      workId={workId}
      currentNode={selectedNode}
      allNodes={flatNodes}
      onOpenPreview={(data) => {
        setPreviewData(data);
        setPreviewModalOpened(true);
      }}
    />

    <ModalAiPreview
      opened={previewModalOpened}
      onClose={() => setPreviewModalOpened(false)}
      previewData={previewData}
      targetNodeId={selectedNode?.id}
      onApplyAll={handleApplyAiAll}
      onApplySelected={handleApplyAiSelected}
    />

    <DrawerAiHistory
      opened={historyDrawerOpened}
      onClose={() => setHistoryDrawerOpened(false)}
      workId={workId}
      onSelectVersion={handleSelectHistoryVersion}
    />
  </>);
}
