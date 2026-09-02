// 组件：极简大纲卡片流与时间线（分卷分组、情节点卡片、快速发起剧情推演）
"use client";

import React from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Card, Group, Stack, ScrollArea, SimpleGrid } from "@mantine/core";
import { FiEdit2, FiTrash2, FiZap, FiPlus, FiFolder, FiUser, FiArrowRight } from "react-icons/fi";
import { OutlineNode } from "@/rest/outline";

interface OutlineFlowProps {
  nodes: OutlineNode[];
  onOpenCreateNode: (volumeId?: string) => void;
  onOpenCreateVolume: () => void;
  onEditNode: (node: OutlineNode) => void;
  onDeleteNode: (id: string, e: React.MouseEvent) => void;
  onLaunchDeduction: (startPoint?: string, targetPoint?: string) => void;
}

export default function OutlineFlow({
  nodes,
  onOpenCreateNode,
  onOpenCreateVolume,
  onEditNode,
  onDeleteNode,
  onLaunchDeduction,
}: OutlineFlowProps) {
  const volumes = nodes.filter((n) => n.type === "volume" || n.type === "story");
  const points = nodes.filter((n) => n.type !== "volume" && n.type !== "story");

  const ungroupedPoints = points.filter((p) => !p.volumeId && !p.parentId);

  const getPointsForVolume = (volumeId: string) => {
    return points.filter((p) => p.volumeId === volumeId || p.parentId === volumeId);
  };

  const renderPointCard = (point: OutlineNode, idx: number) => {
    return (
      <Card
        key={point.id}
        p="10px 14px"
        radius="sm"
        withBorder
        bg="#ffffff"
        style={{
          display: "flex",
          flexDirection: "column",
          borderColor: "#f1f5f9",
          transition: "all 0.15s ease",
        }}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Badge size="xs" color="gray" variant="outline" styles={{ root: { fontSize: 10, height: 16 } }}>
              #{idx + 1}
            </Badge>
            <Text fz={13.5} fw={700} c="#1e293b" truncate="end">
              {point.title}
            </Text>
          </Group>

          <Group gap={4}>
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => onEditNode(point)}>
              <FiEdit2 size={12} />
            </ActionIcon>
            <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => onDeleteNode(point.id, e)}>
              <FiTrash2 size={12} />
            </ActionIcon>
          </Group>
        </Flex>

        <Text fz={12} c="#475569" lineClamp={3} style={{ lineHeight: 1.6, marginBottom: 8, whiteSpace: "pre-wrap" }}>
          {point.content || point.eventDescription || "（暂无剧情描述，点击右上角编辑补充）"}
        </Text>

        <Flex justify="space-between" align="center" pt={6} style={{ borderTop: "1px solid #f8fafc" }}>
          <Group gap={6}>
            {point.characters && (
              <Group gap={4} fz={11} c="#64748b">
                <FiUser size={10} color="#94a3b8" />
                <Text fz={10.5} truncate="end" style={{ maxWidth: 140 }}>
                  {point.characters}
                </Text>
              </Group>
            )}
          </Group>

          <Group gap={4}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="cyan"
              leftSection={<FiZap size={10} />}
              onClick={() => onLaunchDeduction(point.title, "")}
            >
              由此推演
            </Button>
          </Group>
        </Flex>
      </Card>
    );
  };

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ScrollArea style={{ flex: 1 }} p="md">
        <Stack gap="lg">
          {volumes.map((vol) => {
            const volPoints = getPointsForVolume(vol.id);
            return (
              <Box key={vol.id} p="12px 16px" bg="#fafbfc" style={{ border: "1px solid #f1f5f9", borderRadius: 6 }}>
                <Flex justify="space-between" align="center" mb="sm">
                  <Group gap={6}>
                    <FiFolder size={14} color="#0284c7" />
                    <Text fz={14} fw={800} c="#0f172a">
                      {vol.title}
                    </Text>
                    <Badge size="xs" color="gray" variant="outline" styles={{ root: { fontSize: 10 } }}>
                      {volPoints.length} 个情节点
                    </Badge>
                  </Group>

                  <Group gap="xs">
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="cyan"
                      leftSection={<FiPlus size={10} />}
                      onClick={() => onOpenCreateNode(vol.id)}
                    >
                      添加情节点
                    </Button>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => onEditNode(vol)}>
                      <FiEdit2 size={11} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => onDeleteNode(vol.id, e)}>
                      <FiTrash2 size={11} />
                    </ActionIcon>
                  </Group>
                </Flex>

                {vol.content && (
                  <Text fz={11.5} c="#64748b" mb="sm" style={{ lineHeight: 1.5 }}>
                    {vol.content}
                  </Text>
                )}

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                  {volPoints.map((point, idx) => renderPointCard(point, idx))}
                </SimpleGrid>

                {volPoints.length === 0 && (
                  <Text fz={12} c="#94a3b8" ta="center" py="md">
                    该篇章下暂无情节点，点击右上角「+ 添加情节点」
                  </Text>
                )}
              </Box>
            );
          })}

          {ungroupedPoints.length > 0 && (
            <Box p="12px 16px" bg="#fafbfc" style={{ border: "1px solid #f1f5f9", borderRadius: 6 }}>
              <Flex justify="space-between" align="center" mb="sm">
                <Group gap={6}>
                  <Text fz={14} fw={800} c="#0f172a">未归属情节点</Text>
                  <Badge size="xs" color="gray" variant="outline" styles={{ root: { fontSize: 10 } }}>
                    {ungroupedPoints.length} 个情节点
                  </Badge>
                </Group>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="cyan"
                  leftSection={<FiPlus size={10} />}
                  onClick={() => onOpenCreateNode()}
                >
                  添加情节点
                </Button>
              </Flex>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {ungroupedPoints.map((point, idx) => renderPointCard(point, idx))}
              </SimpleGrid>
            </Box>
          )}

          {nodes.length === 0 && (
            <Stack align="center" justify="center" p={80} c="#94a3b8" gap={8}>
              <FiZap size={40} strokeWidth={1.2} />
              <Text fz={14} fw={600}>暂无大纲内容</Text>
              <Text fz={12}>可点击上方「+ 新增情节点」，或使用「✨ 剧情推演」自动生成转折路线</Text>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
