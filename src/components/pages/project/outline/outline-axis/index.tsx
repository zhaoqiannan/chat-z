// 组件：树级故事大纲列表（一级主纲卡片容器 + 二级时空时间轴流水线、支持整组编辑替换、支持全部展开/收起、默认按钮尺寸）
"use client";

import React, { useState, useMemo } from "react";
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
  Tooltip,
  Checkbox,
  Collapse,
} from "@mantine/core";
import {
  FiEdit2,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiFileText,
  FiChevronDown,
  FiChevronUp,
  FiBookOpen,
  FiExternalLink,
  FiZap,
  FiEdit3,
  FiCornerDownRight,
  FiPlus,
  FiClock,
  FiMapPin,
} from "react-icons/fi";
import { OutlineNode } from "@/rest/outline";
import { useRouter } from "next/navigation";

interface OutlineAxisProps {
  workId: string;
  category: "chapter" | "deduction" | "memo";
  nodes: OutlineNode[];
  selectedNodeIds: (number | string)[];
  onToggleSelectNode: (id: number | string) => void;
  onEditNode: (node: OutlineNode) => void;
  onDeleteNode: (id: number | string, e: React.MouseEvent) => void;
  onMoveNode: (node: OutlineNode, direction: "up" | "down") => void;
  onAddChildNode?: (parentNode: OutlineNode) => void;
  onTriggerDeduction?: () => void;
  onTriggerCreate?: () => void;
  collapsedParents: Record<string, boolean>;
  onToggleParentCollapse: (id: number | string) => void;
}

export default function OutlineAxis({
  workId,
  category,
  nodes,
  selectedNodeIds,
  onToggleSelectNode,
  onEditNode,
  onDeleteNode,
  onMoveNode,
  onAddChildNode,
  onTriggerDeduction,
  onTriggerCreate,
  collapsedParents,
  onToggleParentCollapse,
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

  // 组装树状层级数据结构
  const treeNodes = useMemo(() => {
    const nodeMap = new Map<number | string, OutlineNode & { children: OutlineNode[] }>();
    nodes.forEach((n) => {
      nodeMap.set(n.id, { ...n, children: [] });
    });

    const rootNodes: (OutlineNode & { children: OutlineNode[] })[] = [];
    nodes.forEach((n) => {
      const item = nodeMap.get(n.id);
      if (!item) return;
      if (n.parentId && nodeMap.has(n.parentId)) {
        nodeMap.get(n.parentId)!.children.push(item);
      } else {
        rootNodes.push(item);
      }
    });

    return rootNodes;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <Paper p="xl" withBorder radius="md" ta="center" bg="gray.0" my="md">
        <Text fz={16} fw={600} c="dimmed">
          {category === "chapter"
            ? "暂无章节大纲"
            : category === "deduction"
            ? "暂无剧情推演记录"
            : "暂无随手灵感卡片"}
        </Text>
        <Text fz={13} c="dimmed" mt={4} mb="md">
          {category === "chapter"
            ? "在正文编辑区点击【提取剧情到大纲】即可一键同步章节大纲，或手动添加分卷规划。"
            : category === "deduction"
            ? "点击【A➔B 剧情推演】设定起点与终点，智能生成并采纳树级推演方案。"
            : "点击【新建随手卡片】或【AI 思路整理】快速重构你的灵感时空脉络。"}
        </Text>
        <Group justify="center">
          {category === "deduction" && onTriggerDeduction && (
            <Button
              variant="filled"
              color="blue"
              leftSection={<FiZap size={15} />}
              onClick={onTriggerDeduction}
            >
              开始 A➔B 剧情推演
            </Button>
          )}
          {onTriggerCreate && (
            <Button
              variant="default"
              leftSection={category === "chapter" ? <FiBookOpen size={15} /> : <FiEdit3 size={15} />}
              onClick={onTriggerCreate}
            >
              新建本分类卡片
            </Button>
          )}
        </Group>
      </Paper>
    );
  }

  // 渲染二级/三级细分子情节点
  const renderChildNode = (
    childNode: OutlineNode,
    siblingIndex: number,
    siblingCount: number,
    parentNode: OutlineNode
  ) => {
    const isSelected = selectedNodeIds.includes(childNode.id);

    return (
      <Paper
        key={childNode.id}
        p="md"
        withBorder
        radius="md"
        style={{
          borderColor: isSelected ? "#3b82f6" : "#e2e8f0",
          backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
          boxShadow: isSelected ? "0 0 0 1px #3b82f6" : "none",
        }}
      >
        <Flex justify="space-between" align="center" wrap="wrap" gap="xs" mb={6}>
          <Group gap="xs" align="center">
            <FiCornerDownRight size={14} color="#64748b" />
            <Checkbox
              checked={isSelected}
              onChange={() => onToggleSelectNode(childNode.id)}
              aria-label={`选择 ${childNode.title}`}
            />
            <Badge variant="light" color="indigo" size="sm">
              {childNode.chapterNumber
                ? `第 ${childNode.chapterNumber} 章`
                : childNode.deductionStepIndex
                ? `阶段 ${childNode.deductionStepIndex}`
                : `情节 ${siblingIndex + 1}`}
            </Badge>
            <Text fw={700} fz={15} c="#0f172a">
              {childNode.title}
            </Text>
            {childNode.timeframe && (
              <Badge variant="outline" color="blue" size="xs" leftSection={<FiClock size={10} />}>
                {childNode.timeframe}
              </Badge>
            )}
            {childNode.location && (
              <Badge variant="outline" color="teal" size="xs" leftSection={<FiMapPin size={10} />}>
                {childNode.location}
              </Badge>
            )}
          </Group>

          <Group gap={4}>
            {childNode.chapterId && (
              <Button
                variant="subtle"
                color="teal"
                leftSection={<FiExternalLink size={13} />}
                onClick={() => handleJumpToChapter(childNode.chapterId)}
              >
                正文
              </Button>
            )}
            <Tooltip label="上移">
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={siblingIndex === 0}
                onClick={() => onMoveNode(childNode, "up")}
              >
                <FiArrowUp size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="下移">
              <ActionIcon
                variant="subtle"
                color="gray"
                disabled={siblingIndex === siblingCount - 1}
                onClick={() => onMoveNode(childNode, "down")}
              >
                <FiArrowDown size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="编辑该情节">
              <ActionIcon
                variant="subtle"
                color="blue"
                onClick={() => onEditNode(childNode)}
              >
                <FiEdit2 size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="删除">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={(e) => onDeleteNode(childNode.id, e)}
              >
                <FiTrash2 size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Flex>

        {/* 具体叙述 */}
        <Box my={4}>
          <Text fz={13} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {childNode.content || childNode.event || "（暂无具体叙述）"}
          </Text>
        </Box>

        {/* 转折冲突与下一步目标 */}
        {(childNode.twist || childNode.nextGoal || childNode.suspense) && (
          <Group gap="md" mt="xs" pt="xs" style={{ borderTop: "1px dashed #f1f5f9" }}>
            {childNode.twist && (
              <Text fz={12} c="orange.8">
                <b>⚡ 推进冲突:</b> {childNode.twist}
              </Text>
            )}
            {childNode.nextGoal && (
              <Text fz={12} c="teal.8">
                <b>🎯 目标计划:</b> {childNode.nextGoal}
              </Text>
            )}
            {childNode.suspense && (
              <Text fz={12} c="grape.8">
                <b>🔍 悬念伏笔:</b> {childNode.suspense}
              </Text>
            )}
          </Group>
        )}
      </Paper>
    );
  };

  return (
    <Stack gap="lg" py="xs">
      {treeNodes.map((rootNode, rootIndex) => {
        const hasChildren = Array.isArray(rootNode.children) && rootNode.children.length > 0;
        const isCollapsed = !!collapsedParents[String(rootNode.id)];
        const isSelected = selectedNodeIds.includes(rootNode.id);
        const nodeCategory = rootNode.category || category;

        return (
          <Paper
            key={rootNode.id}
            p="md"
            withBorder
            radius="md"
            style={{
              borderColor: isSelected ? "#3b82f6" : "#cbd5e1",
              backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            {/* 一级主纲卡片顶部栏 */}
            <Flex justify="space-between" align="center" wrap="wrap" gap="xs" mb="xs">
              <Group gap="xs" align="center">
                <Checkbox
                  checked={isSelected}
                  onChange={() => onToggleSelectNode(rootNode.id)}
                  aria-label={`选择主纲 ${rootNode.title}`}
                />

                {nodeCategory === "chapter" && (
                  <Badge variant="filled" color="teal" size="md" leftSection={<FiBookOpen size={12} />}>
                    分卷 / 章节大纲
                  </Badge>
                )}

                {nodeCategory === "deduction" && (
                  <Badge variant="filled" color="blue" size="md" leftSection={<FiZap size={12} />}>
                    剧情推演方案
                  </Badge>
                )}

                {nodeCategory === "memo" && (
                  <Badge variant="filled" color="indigo" size="md" leftSection={<FiEdit3 size={12} />}>
                    AI 思路整理 / 主纲
                  </Badge>
                )}

                <Text fw={700} fz={17} c="#0f172a">
                  {rootNode.title}
                </Text>

                {hasChildren && (
                  <Badge variant="light" color="gray" size="sm">
                    {rootNode.children.length} 个子情节
                  </Badge>
                )}

                {rootNode.timeframe && (
                  <Badge variant="outline" color="blue" size="xs" leftSection={<FiClock size={10} />}>
                    {rootNode.timeframe}
                  </Badge>
                )}
                {rootNode.location && (
                  <Badge variant="outline" color="teal" size="xs" leftSection={<FiMapPin size={10} />}>
                    {rootNode.location}
                  </Badge>
                )}
              </Group>

              {/* 右侧主操作按钮区 */}
              <Group gap="xs">
                {hasChildren && (
                  <Button
                    variant="subtle"
                    color="gray"
                    leftSection={isCollapsed ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
                    onClick={() => onToggleParentCollapse(rootNode.id)}
                  >
                    {isCollapsed ? `展开 (${rootNode.children.length})` : "收起子情节"}
                  </Button>
                )}

                <Button
                  variant="light"
                  color="blue"
                  leftSection={<FiEdit2 size={13} />}
                  onClick={() => onEditNode(rootNode)}
                >
                  编辑整组
                </Button>

                {onAddChildNode && (
                  <Button
                    variant="default"
                    leftSection={<FiPlus size={13} />}
                    onClick={() => onAddChildNode(rootNode)}
                  >
                    添加子情节
                  </Button>
                )}

                <Tooltip label="上移">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    disabled={rootIndex === 0}
                    onClick={() => onMoveNode(rootNode, "up")}
                  >
                    <FiArrowUp size={15} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="下移">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    disabled={rootIndex === treeNodes.length - 1}
                    onClick={() => onMoveNode(rootNode, "down")}
                  >
                    <FiArrowDown size={15} />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label="删除该条目">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={(e) => onDeleteNode(rootNode.id, e)}
                  >
                    <FiTrash2 size={15} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Flex>

            {/* 剧情推演专属：起点 ➔ 终点 */}
            {nodeCategory === "deduction" && (rootNode.deductionOrigin || rootNode.deductionPremise || rootNode.deductionTarget) && (
              <Paper p="xs" withBorder radius="sm" bg="blue.0" mb="xs" style={{ borderColor: "#bfdbfe" }}>
                <Flex align="center" gap={6} wrap="wrap">
                  <Badge variant="filled" color="blue" size="xs">
                    推演脉络
                  </Badge>
                  <Text fz={13} fw={600} c="blue.9">
                    {rootNode.deductionOrigin || `从「${rootNode.deductionPremise || "起点"}」➔「${rootNode.deductionTarget || "终点"}」`}
                  </Text>
                  {rootNode.deductionPathTitle && (
                    <Badge variant="outline" color="blue" size="xs">
                      {rootNode.deductionPathTitle}
                    </Badge>
                  )}
                </Flex>
              </Paper>
            )}

            {/* 核心总述 Summary / 脉络叙述 */}
            {(rootNode.summary || rootNode.content || rootNode.event) && (
              <Box my="xs" p="xs" style={{ backgroundColor: "#f8fafc", borderRadius: 6 }}>
                <Text fz={13} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                  <b>【总体概述】:</b> {rootNode.summary || rootNode.content || rootNode.event}
                </Text>
              </Box>
            )}

            {/* 关联人物与笔记 */}
            {rootNode.linkedCharacters && rootNode.linkedCharacters.length > 0 && (
              <Box mt="xs" pt="xs" style={{ borderTop: "1px dashed #e2e8f0" }}>
                <Flex align="center" gap="xs" wrap="wrap">
                  <Text fz={12} fw={600} c="dimmed">
                    涉及人物:
                  </Text>
                  {rootNode.linkedCharacters.map((char) => (
                    <Badge key={char.id} variant="light" color="indigo" size="sm">
                      {char.name}
                    </Badge>
                  ))}
                </Flex>
              </Box>
            )}

            {rootNode.linkedNotes && rootNode.linkedNotes.length > 0 && (
              <Box mt="xs" pt="xs" style={{ borderTop: "1px dashed #e2e8f0" }}>
                <Text fz={12} fw={600} c="dimmed" mb={4}>
                  参考设定笔记:
                </Text>
                <Stack gap="xs">
                  {rootNode.linkedNotes.map((note) => {
                    const noteKey = `${rootNode.id}_note_${note.id}`;
                    const isLong = (note.content || "").length > 200;
                    const isExpanded = expandedNotes[noteKey] ?? !isLong;

                    return (
                      <Paper key={note.id} p="xs" withBorder radius="sm" bg="gray.0">
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
                              variant="subtle"
                              color="gray"
                              rightSection={isExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                              onClick={() => toggleNoteExpand(noteKey)}
                            >
                              {isExpanded ? "收起全文" : "展开全文"}
                            </Button>
                          )}
                        </Flex>
                        <Text fz={12} c="#334155" mt={4} style={{ maxHeight: isExpanded ? "none" : 80, overflow: "hidden" }}>
                          {note.content || "(空)"}
                        </Text>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* 子节点折叠/展开区域（二级时间轴流水线） */}
            {hasChildren && (
              <Collapse expanded={!isCollapsed}>
                <Box mt="md" pt="xs">
                  <Text fz={13} fw={700} c="#475569" mb="xs">
                    下属细分情节与步骤推进：
                  </Text>
                  <Stack gap="xs" pl="md" style={{ borderLeft: "3px solid #94a3b8" }}>
                    {rootNode.children.map((child, childIdx) =>
                      renderChildNode(child, childIdx, rootNode.children.length, rootNode)
                    )}
                  </Stack>
                </Box>
              </Collapse>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
