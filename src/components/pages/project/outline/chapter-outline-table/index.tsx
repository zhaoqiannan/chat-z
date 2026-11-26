"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Badge, Box, Button, Checkbox, Flex, Group, Paper, Stack, Table, Text, Tooltip } from "@mantine/core";
import { FiArrowDown, FiArrowUp, FiBookOpen, FiChevronDown, FiChevronRight, FiEdit2, FiExternalLink, FiPlus, FiTrash2 } from "react-icons/fi";
import { OutlineNode } from "@/rest/outline";

interface ChapterOutlineTableProps {
  workId: string;
  nodes: OutlineNode[];
  selectedNodeIds: (number | string)[];
  collapsedParents: Record<string, boolean>;
  onToggleParentCollapse: (id: number | string) => void;
  onToggleSelectNode: (id: number | string) => void;
  onEditNode: (node: OutlineNode) => void;
  onDeleteNode: (id: number | string, e: React.MouseEvent) => void;
  onMoveNode: (node: OutlineNode, direction: "up" | "down") => void;
  onAddChildNode?: (parentNode: OutlineNode) => void;
  onTriggerCreate?: () => void;
}

type TreeOutlineNode = Omit<OutlineNode, "children"> & { children: TreeOutlineNode[] };

interface FlatRow {
  node: TreeOutlineNode;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  hasChildren: boolean;
}

export default function ChapterOutlineTable({
  workId,
  nodes,
  selectedNodeIds,
  collapsedParents,
  onToggleParentCollapse,
  onToggleSelectNode,
  onEditNode,
  onDeleteNode,
  onMoveNode,
  onAddChildNode,
  onTriggerCreate,
}: ChapterOutlineTableProps) {
  const router = useRouter();

  const flatRows = useMemo<FlatRow[]>(() => {
    const nodeMap = new Map<string, TreeOutlineNode>();
    nodes.forEach((n) => {
      nodeMap.set(String(n.id), { ...n, children: [] });
    });

    const roots: TreeOutlineNode[] = [];
    nodes.forEach((n) => {
      const item = nodeMap.get(String(n.id));
      if (!item) return;
      if (n.parentId && nodeMap.has(String(n.parentId))) {
        nodeMap.get(String(n.parentId))!.children.push(item);
      } else {
        roots.push(item);
      }
    });

    const rows: FlatRow[] = [];
    const walk = (list: TreeOutlineNode[], depth: number) => {
      list.forEach((item, idx) => {
        const hasChildren = item.children.length > 0;
        rows.push({ node: item, depth, siblingIndex: idx, siblingCount: list.length, hasChildren });
        if (hasChildren && !collapsedParents[String(item.id)]) {
          walk(item.children, depth + 1);
        }
      });
    };
    walk(roots, 0);
    return rows;
  }, [nodes, collapsedParents]);

  const handleJumpToChapter = (chapterId?: number | null) => {
    if (chapterId) {
      router.push(`/project/${workId}?tab=chapters&chapterId=${chapterId}`);
    } else {
      router.push(`/project/${workId}?tab=chapters`);
    }
  };

  if (nodes.length === 0) {
    return (
      <Paper p="xl" withBorder radius="md" ta="center" bg="gray.0" my="md">
        <Text fz={15} fw={600} c="dimmed">暂无章节大纲</Text>
        <Text fz={13} c="dimmed" mt={4} mb="md">
          在章节写作页点击「提取剧情到大纲」或左侧「一键提取章节大纲」，即可自动将每章剧情同步至此表格。
        </Text>
        {onTriggerCreate ? (
          <Button variant="default" size="xs" leftSection={<FiBookOpen size={14} />} onClick={onTriggerCreate}>
            新建章节大纲
          </Button>
        ) : null}
      </Paper>
    );
  }

  return (
    <Box bg="#ffffff" bd="1px solid #f1f5f9" bdrs={8} style={{ overflow: "hidden" }}>
      <Table highlightOnHover verticalSpacing={8} horizontalSpacing="sm">
        <Table.Thead bg="#f8fafc">
          <Table.Tr>
            <Table.Th w={38} />
            <Table.Th w={86}><Text fz={12} fw={600} c="#475569">章节</Text></Table.Th>
            <Table.Th w={200}><Text fz={12} fw={600} c="#475569">大纲标题</Text></Table.Th>
            <Table.Th miw={320}><Text fz={12} fw={600} c="#475569">核心剧情经过</Text></Table.Th>
            <Table.Th w={260}><Text fz={12} fw={600} c="#475569">转折 / 目标 / 伏笔</Text></Table.Th>
            <Table.Th w={116}><Text fz={12} fw={600} c="#475569">出场人物</Text></Table.Th>
            <Table.Th w={156}><Text fz={12} fw={600} c="#475569">操作</Text></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {flatRows.map(({ node, depth, siblingIndex, siblingCount, hasChildren }) => {
            const isSelected = selectedNodeIds.includes(node.id);
            const isCollapsed = Boolean(collapsedParents[String(node.id)]);
            const plotBody = (node.event || node.content || node.summary || "").trim();

            return (
              <Table.Tr
                key={node.id}
                style={{
                  verticalAlign: "top",
                  borderBottom: "1px solid #f1f5f9",
                  backgroundColor: isSelected ? "rgba(0, 201, 255, 0.06)" : undefined,
                }}
              >
                <Table.Td pt={10}>
                  <Checkbox
                    size="xs"
                    checked={isSelected}
                    onChange={() => onToggleSelectNode(node.id)}
                    aria-label={`选择 ${node.title}`}
                  />
                </Table.Td>

                <Table.Td pt={9}>
                  <Flex align="center" gap={4}>
                    {hasChildren ? (
                      <ActionIcon variant="subtle" color="gray" size={18} onClick={() => onToggleParentCollapse(node.id)}>
                        {isCollapsed ? <FiChevronRight size={12} /> : <FiChevronDown size={12} />}
                      </ActionIcon>
                    ) : null}
                    {node.chapterNumber ? (
                      <Badge size="xs" variant="light" color="cyan">第 {node.chapterNumber} 章</Badge>
                    ) : (
                      <Badge size="xs" variant="light" color="gray">{depth === 0 ? "分卷/总" : "子情节"}</Badge>
                    )}
                  </Flex>
                </Table.Td>

                <Table.Td pt={8}>
                  <Box pl={depth * 14}>
                    <Text
                      fz={13}
                      fw={depth === 0 ? 600 : 500}
                      c="#0f172a"
                      lh={1.55}
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {node.title}
                    </Text>
                    {node.timeframe || node.location ? (
                      <Text fz={11} c="#94a3b8" mt={2} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {[node.timeframe, node.location].filter(Boolean).join(" · ")}
                      </Text>
                    ) : null}
                  </Box>
                </Table.Td>

                <Table.Td pt={8}>
                  <Text
                    fz={13}
                    c={plotBody ? "#334155" : "#94a3b8"}
                    lh={1.65}
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {plotBody || "（暂无具体剧情描述）"}
                  </Text>
                </Table.Td>

                <Table.Td pt={8}>
                  {node.twist || node.nextGoal || node.suspense ? (
                    <Stack gap={4}>
                      {node.twist ? (
                        <Text fz={12} c="#c2410c" lh={1.5} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          <Text span fw={600}>转折：</Text>{node.twist}
                        </Text>
                      ) : null}
                      {node.nextGoal ? (
                        <Text fz={12} c="#0369a1" lh={1.5} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          <Text span fw={600}>目标：</Text>{node.nextGoal}
                        </Text>
                      ) : null}
                      {node.suspense ? (
                        <Text fz={12} c="#7c3aed" lh={1.5} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          <Text span fw={600}>伏笔：</Text>{node.suspense}
                        </Text>
                      ) : null}
                    </Stack>
                  ) : (
                    <Text fz={12} c="#cbd5e1">--</Text>
                  )}
                </Table.Td>

                <Table.Td pt={8}>
                  {node.linkedCharacters && node.linkedCharacters.length > 0 ? (
                    <Flex gap={4} wrap="wrap">
                      {node.linkedCharacters.map((c) => (
                        <Badge key={c.id} size="xs" variant="light" color="indigo">{c.name}</Badge>
                      ))}
                    </Flex>
                  ) : (
                    <Text fz={12} c="#cbd5e1">--</Text>
                  )}
                </Table.Td>

                <Table.Td pt={6}>
                  <Group gap={3} wrap="nowrap">
                    {node.chapterId ? (
                      <Tooltip label="跳转对应章节正文">
                        <ActionIcon variant="subtle" color="cyan" size={24} onClick={() => handleJumpToChapter(node.chapterId)}>
                          <FiExternalLink size={13} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null}
                    <Tooltip label="编辑大纲">
                      <ActionIcon variant="subtle" color="blue" size={24} onClick={() => onEditNode(node)}>
                        <FiEdit2 size={13} />
                      </ActionIcon>
                    </Tooltip>
                    {depth === 0 && onAddChildNode ? (
                      <Tooltip label="添加子情节">
                        <ActionIcon variant="subtle" color="cyan" size={24} onClick={() => onAddChildNode(node)}>
                          <FiPlus size={13} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null}
                    <Tooltip label="上移">
                      <ActionIcon variant="subtle" color="gray" size={24} disabled={siblingIndex === 0} onClick={() => onMoveNode(node, "up")}>
                        <FiArrowUp size={13} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="下移">
                      <ActionIcon variant="subtle" color="gray" size={24} disabled={siblingIndex === siblingCount - 1} onClick={() => onMoveNode(node, "down")}>
                        <FiArrowDown size={13} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除">
                      <ActionIcon variant="subtle" color="red" size={24} onClick={(e) => onDeleteNode(node.id, e)}>
                        <FiTrash2 size={13} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
