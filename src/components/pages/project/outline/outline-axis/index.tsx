// 组件：双向章节故事轴（极简串珠流、4要素大白话、多选复选框、角色标签徽章、笔记全文直接展开）
"use client";

import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  ActionIcon,
  Stack,
  Paper,
  Group,
  Button,
  Collapse,
  Tooltip,
  Checkbox,
} from "@mantine/core";
import {
  FiEdit2,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiUser,
  FiFileText,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
} from "react-icons/fi";
import { OutlineNode } from "@/rest/outline";
import { useRouter } from "next/navigation";

interface OutlineAxisProps {
  workId: string;
  nodes: OutlineNode[];
  selectedNodeIds: (number | string)[];
  onToggleSelectNode: (id: number | string) => void;
  onEditNode: (node: OutlineNode) => void;
  onDeleteNode: (id: number | string, e: React.MouseEvent) => void;
  onMoveNode: (node: OutlineNode, direction: "up" | "down") => void;
}

export default function OutlineAxis({
  workId,
  nodes,
  selectedNodeIds,
  onToggleSelectNode,
  onEditNode,
  onDeleteNode,
  onMoveNode,
}: OutlineAxisProps) {
  const router = useRouter();
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const toggleNoteExpand = (noteKey: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [noteKey]: !prev[noteKey],
    }));
  };

  const handleJumpToChapter = (chapterId?: number | null) => {
    if (chapterId) {
      router.push(`/project/${workId}/chapters?chapterId=${chapterId}`);
    } else {
      router.push(`/project/${workId}/chapters`);
    }
  };

  if (nodes.length === 0) {
    return (
      <Paper p="xl" withBorder radius="md" ta="center" bg="gray.0" my="md">
        <Text fz={15} fw={600} c="dimmed">
          暂无故事大纲与情节点
        </Text>
        <Text fz={13} c="dimmed" mt={4}>
          你可以点击上方【✨ A➔B 剧情推演】自动搭建桥梁，或点击【➕ 随手添加情节】开始梳理。
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md" py="xs">
      {nodes.map((node, index) => {
        const isFromChapter = node.isFromChapter === 1 || !!node.chapterId;
        const isCompleted = node.status === "completed" || isFromChapter;
        const isSelected = selectedNodeIds.includes(node.id);

        return (
          <Paper
            key={node.id}
            p="md"
            withBorder
            radius="md"
            style={{
              borderColor: isSelected ? "#3b82f6" : isCompleted ? "#86efac" : "#e2e8f0",
              backgroundColor: isSelected ? "#eff6ff" : isCompleted ? "#f0fdf4" : "#ffffff",
              boxShadow: isSelected ? "0 0 0 1px #3b82f6" : "none",
              transition: "all 0.15s ease",
            }}
          >
            {/* 卡片头部：复选框、序号、标题、状态徽章、操作按钮 */}
            <Flex justify="space-between" align="center" wrap="wrap" gap="xs" mb="xs">
              <Group gap="xs" align="center">
                {/* 选择复选框 */}
                <Checkbox
                  size="sm"
                  checked={isSelected}
                  onChange={() => onToggleSelectNode(node.id)}
                  aria-label={`选择 ${node.title}`}
                />

                {/* 状态徽章 */}
                {isCompleted ? (
                  <Badge
                    variant="light"
                    color="teal"
                    size="sm"
                    leftSection={<FiCheckCircle size={12} />}
                  >
                    {node.chapterNumber ? `第 ${node.chapterNumber} 章 · 正文已同步` : "已完成正文"}
                  </Badge>
                ) : (
                  <Badge
                    variant="light"
                    color="blue"
                    size="sm"
                    leftSection={<FiClock size={12} />}
                  >
                    待写规划 · 约 {node.wordCountEstimate || 3000} 字
                  </Badge>
                )}

                <Text fw={700} fz={15} c="#0f172a">
                  {node.title}
                </Text>
              </Group>

              <Group gap={4}>
                {isFromChapter && node.chapterId && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="teal"
                    leftSection={<FiExternalLink size={12} />}
                    onClick={() => handleJumpToChapter(node.chapterId)}
                  >
                    查看正文
                  </Button>
                )}

                <Tooltip label="上移">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    disabled={index === 0}
                    onClick={() => onMoveNode(node, "up")}
                  >
                    <FiArrowUp size={13} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="下移">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    disabled={index === nodes.length - 1}
                    onClick={() => onMoveNode(node, "down")}
                  >
                    <FiArrowDown size={13} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="编辑">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="blue"
                    onClick={() => onEditNode(node)}
                  >
                    <FiEdit2 size={13} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="删除">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={(e) => onDeleteNode(node.id, e)}
                  >
                    <FiTrash2 size={13} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Flex>

            {/* 4 核心要素大白话排布 */}
            <Stack gap={6} my={8}>
              {node.event && (
                <Flex align="flex-start" gap={6}>
                  <Text fz={12} fw={700} c="blue.7" style={{ minWidth: 70 }}>
                    📍 发生经过:
                  </Text>
                  <Text fz={13} c="#334155" style={{ flex: 1, lineHeight: 1.5 }}>
                    {node.event}
                  </Text>
                </Flex>
              )}

              {node.twist && (
                <Flex align="flex-start" gap={6}>
                  <Text fz={12} fw={700} c="orange.7" style={{ minWidth: 70 }}>
                    ⚡ 意外转折:
                  </Text>
                  <Text fz={13} c="#334155" style={{ flex: 1, lineHeight: 1.5 }}>
                    {node.twist}
                  </Text>
                </Flex>
              )}

              {node.nextGoal && (
                <Flex align="flex-start" gap={6}>
                  <Text fz={12} fw={700} c="teal.7" style={{ minWidth: 70 }}>
                    🎯 下一步:
                  </Text>
                  <Text fz={13} c="#334155" style={{ flex: 1, lineHeight: 1.5 }}>
                    {node.nextGoal}
                  </Text>
                </Flex>
              )}

              {node.suspense && (
                <Flex align="flex-start" gap={6}>
                  <Text fz={12} fw={700} c="grape.7" style={{ minWidth: 70 }}>
                    🕳️ 留下伏笔:
                  </Text>
                  <Text fz={13} c="#334155" style={{ flex: 1, lineHeight: 1.5 }}>
                    {node.suspense}
                  </Text>
                </Flex>
              )}

              {!node.event && !node.twist && !node.nextGoal && !node.suspense && node.content && (
                <Text fz={13} c="#334155" style={{ lineHeight: 1.5 }}>
                  {node.content}
                </Text>
              )}
            </Stack>

            {/* 关联角色栏：显示角色姓名 + 角色标签 */}
            {node.linkedCharacters && node.linkedCharacters.length > 0 && (
              <Box mt="xs" pt="xs" style={{ borderTop: "1px dashed #e2e8f0" }}>
                <Flex align="center" gap="xs" wrap="wrap">
                  <Text fz={12} fw={600} c="dimmed">
                    👥 登场角色:
                  </Text>
                  {node.linkedCharacters.map((char) => (
                    <Group key={char.id} gap={4} align="center">
                      <Badge variant="light" color="indigo" size="sm">
                        👤 {char.name}
                      </Badge>
                      {char.tags && char.tags.length > 0 && (
                        <Group gap={2}>
                          {char.tags.slice(0, 3).map((t, idx) => (
                            <Badge key={idx} variant="outline" color="gray" size="xs">
                              {t}
                            </Badge>
                          ))}
                        </Group>
                      )}
                    </Group>
                  ))}
                </Flex>
              </Box>
            )}

            {/* 关联笔记栏：全文直接显示 */}
            {node.linkedNotes && node.linkedNotes.length > 0 && (
              <Box mt="xs" pt="xs" style={{ borderTop: "1px dashed #e2e8f0" }}>
                <Text fz={12} fw={600} c="dimmed" mb={4}>
                  📑 关联参考笔记（全文直显）:
                </Text>
                <Stack gap="xs">
                  {node.linkedNotes.map((note) => {
                    const noteKey = `${node.id}_note_${note.id}`;
                    const isLong = (note.content || "").length > 200;
                    const isExpanded = expandedNotes[noteKey] ?? !isLong;

                    return (
                      <Paper
                        key={note.id}
                        p="xs"
                        withBorder
                        radius="sm"
                        bg={isCompleted ? "#ffffff" : "gray.0"}
                      >
                        <Flex justify="space-between" align="center">
                          <Group gap="xs">
                            <FiFileText size={13} color="#0284c7" />
                            <Text fz={13} fw={700} c="#0f172a">
                              {note.title}
                            </Text>
                            <Badge variant="dot" color="blue" size="xs">
                              {note.category}
                            </Badge>
                          </Group>

                          {isLong && (
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="gray"
                              rightSection={
                                isExpanded ? (
                                  <FiChevronUp size={12} />
                                ) : (
                                  <FiChevronDown size={12} />
                                )
                              }
                              onClick={() => toggleNoteExpand(noteKey)}
                            >
                              {isExpanded ? "收起全文" : "展开全文"}
                            </Button>
                          )}
                        </Flex>

                        {/* 笔记全文展示 */}
                        <Box mt={4}>
                          <Text
                            fz={12}
                            c="#334155"
                            style={{
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.6,
                              maxHeight: isExpanded ? "none" : 80,
                              overflow: "hidden",
                            }}
                          >
                            {note.content || "(该笔记内容为空)"}
                          </Text>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
