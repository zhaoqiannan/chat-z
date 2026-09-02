// 组件：故事大纲与剧情推演工作台（极简线条卡片流、起终点转折推演与篇章管理）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, Flex, Text, Button, LoadingOverlay, Group } from "@mantine/core";
import { FiPlus, FiZap, FiFolderPlus, FiLayers } from "react-icons/fi";
import { OutlineNode, CreateOutlinePayload, UpdateOutlinePayload, getOutlineList, createOutlineNode, updateOutlineNode, deleteOutlineNode } from "@/rest/outline";
import OutlineFlow from "./outline-flow";
import ModalSimpleNode from "./modal-simple-node";
import ModalCreateOutlineVolume from "./modal-create-outline-volume";
import DrawerPlotDeduction from "./drawer-plot-deduction";

export default function StoryOutlinePage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [flatNodes, setFlatNodes] = useState<OutlineNode[]>([]);

  const [nodeModalOpened, setNodeModalOpened] = useState(false);
  const [editingNode, setEditingNode] = useState<OutlineNode | null>(null);
  const [targetVolumeId, setTargetVolumeId] = useState<string | undefined>(undefined);

  const [volumeModalOpened, setVolumeModalOpened] = useState(false);
  const [deductionDrawerOpened, setDeductionDrawerOpened] = useState(false);

  const fetchNodes = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getOutlineList(workId);
      if (res && res.success) {
        const rawFlat: OutlineNode[] = Array.isArray((res as any).flatList)
          ? (res as any).flatList
          : Array.isArray(res.result)
          ? res.result
          : [];
        setFlatNodes(rawFlat);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, [workId]);

  const handleOpenCreateNode = (volumeId?: string) => {
    setEditingNode(null);
    setTargetVolumeId(volumeId);
    setNodeModalOpened(true);
  };

  const handleOpenEditNode = (node: OutlineNode) => {
    setEditingNode(node);
    setNodeModalOpened(true);
  };

  const handleDeleteNode = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该大纲节点吗？此操作不可撤销。")) {
      try {
        await deleteOutlineNode(id);
        setFlatNodes((prev) => prev.filter((n) => n.id !== id));
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const handleLaunchDeduction = (start?: string, target?: string) => {
    setDeductionDrawerOpened(true);
  };

  const volumes = flatNodes.filter((n) => n.type === "volume" || n.type === "story");
  const points = flatNodes.filter((n) => n.type !== "volume" && n.type !== "story");

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
      <LoadingOverlay visible={loading && flatNodes.length === 0} />

      <Flex
        justify="space-between"
        align="center"
        px="md"
        py={12}
        style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#ffffff" }}
      >
        <Group gap={8} align="center">
          <FiLayers size={16} color="#0284c7" />
          <Text fz={16} fw={800} c="#0f172a">
            故事大纲与情节点
          </Text>
          <Text fz={12} c="#94a3b8">
            ({volumes.length} 个篇章分卷 · {points.length} 个情节点)
          </Text>
        </Group>

        <Group gap="xs">
          <Button
            size="xs"
            color="cyan"
            variant="gradient"
            gradient={{ from: "teal", to: "cyan", deg: 90 }}
            leftSection={<FiZap size={13} />}
            onClick={() => handleLaunchDeduction()}
          >
            ✨ 剧情推演 (起终点转折)
          </Button>

          <Button
            size="xs"
            variant="default"
            leftSection={<FiFolderPlus size={13} />}
            onClick={() => setVolumeModalOpened(true)}
          >
            新建分卷篇章
          </Button>

          <Button
            size="xs"
            color="cyan"
            leftSection={<FiPlus size={13} />}
            onClick={() => handleOpenCreateNode()}
          >
            新增情节点
          </Button>
        </Group>
      </Flex>

      <OutlineFlow
        nodes={flatNodes}
        onOpenCreateNode={handleOpenCreateNode}
        onOpenCreateVolume={() => setVolumeModalOpened(true)}
        onEditNode={handleOpenEditNode}
        onDeleteNode={handleDeleteNode}
        onLaunchDeduction={handleLaunchDeduction}
      />

      <ModalSimpleNode
        opened={nodeModalOpened}
        onClose={() => setNodeModalOpened(false)}
        workId={workId}
        editingNode={editingNode}
        volumes={volumes}
        onSuccess={fetchNodes}
        onCreateNode={createOutlineNode}
        onUpdateNode={updateOutlineNode}
      />

      <ModalCreateOutlineVolume
        opened={volumeModalOpened}
        onClose={() => setVolumeModalOpened(false)}
        workId={workId}
        onSuccess={fetchNodes}
        onCreateNode={createOutlineNode}
      />

      <DrawerPlotDeduction
        opened={deductionDrawerOpened}
        onClose={() => setDeductionDrawerOpened(false)}
        workId={workId}
        outlineNodes={flatNodes}
        onOutlineUpdated={fetchNodes}
      />
    </Box>
  );
}
