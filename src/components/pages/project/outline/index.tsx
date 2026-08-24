"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import {
  getOutlineList,
  createOutlineNode,
  updateOutlineNode,
  deleteOutlineNode,
  OutlineNode,
  CreateOutlinePayload,
  UpdateOutlinePayload,
} from "@/rest/outline";
import TreePanel from "./tree-panel";
import DetailPanel from "./detail-panel";
import ModalCreateNode from "./modal-create-node";
import ModalAiPlan from "./modal-ai-plan";
import styles from "./style.module.scss";

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
  const [flatNodes, setFlatNodes] = useState<OutlineNode[]>([]);
  const [treeNodes, setTreeNodes] = useState<OutlineNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<OutlineNode | null>(null);

  // 弹窗状态
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [aiModalOpened, setAiModalOpened] = useState(false);

  const fetchOutlines = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getOutlineList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        const rawList: OutlineNode[] = res.result;
        setFlatNodes(rawList);
        const built = buildTree(rawList);
        setTreeNodes(built);

        // 如果之前选中的节点还在列表中，更新其引用；否则选中第一个
        if (selectedNode) {
          const found = rawList.find((n) => n.id === selectedNode.id);
          setSelectedNode(found || (rawList.length > 0 ? rawList[0] : null));
        } else if (rawList.length > 0) {
          setSelectedNode(rawList[0]);
        } else {
          setSelectedNode(null);
        }
      }
    } catch (e) {
      console.error("加载故事大纲失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlines();
  }, [workId]);

  // 新增节点
  const handleOpenCreate = (parentId?: string | null) => {
    setCreateParentId(parentId || null);
    setCreateModalOpened(true);
  };

  const handleCreateNode = async (data: CreateOutlinePayload) => {
    const res = await createOutlineNode(data);
    if (res && res.success) {
      await fetchOutlines();
      if (res.result) {
        setSelectedNode(res.result);
      }
    }
  };

  // 编辑节点
  const handleUpdateNode = async (data: UpdateOutlinePayload) => {
    const res = await updateOutlineNode(data);
    if (res && res.success) {
      await fetchOutlines();
    }
  };

  // 删除节点
  const handleDeleteNode = async (id: string) => {
    if (window.confirm("确定要删除该大纲节点及其所有子节点吗？")) {
      const res = await deleteOutlineNode(id);
      if (res && res.success) {
        await fetchOutlines();
      }
    }
  };

  return (
    <Box className={styles.container} pos="relative">
      <LoadingOverlay visible={loading && flatNodes.length === 0} />

      {/* 左侧大纲结构树 */}
      <TreePanel
        nodes={treeNodes}
        selectedNodeId={selectedNode?.id || null}
        onSelectNode={(node) => setSelectedNode(node)}
        onOpenCreate={handleOpenCreate}
        onDeleteNode={handleDeleteNode}
        onOpenAiPlan={() => setAiModalOpened(true)}
        loading={loading}
      />

      {/* 右侧节点详情设定与剧情推演面板 */}
      <DetailPanel
        node={selectedNode}
        onUpdate={handleUpdateNode}
        onOpenAiPlan={() => setAiModalOpened(true)}
      />

      {/* 新增大纲节点弹窗 */}
      <ModalCreateNode
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        workId={workId}
        parentNodes={flatNodes}
        defaultParentId={createParentId}
        onSubmit={handleCreateNode}
      />

      {/* AI 智能大纲规划与推演弹窗 */}
      <ModalAiPlan
        opened={aiModalOpened}
        onClose={() => setAiModalOpened(false)}
        workId={workId}
        onSuccess={() => fetchOutlines()}
      />
    </Box>
  );
}
