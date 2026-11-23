"use client";

import React, { useMemo } from "react";
import { ActionIcon, Box, Flex, Group, ScrollArea, Select, Table, Text, Tooltip } from "@mantine/core";
import { FiArrowDown, FiArrowUp, FiChevronDown, FiChevronRight, FiCpu, FiPlus, FiTrash2 } from "react-icons/fi";
import { MasterOutlineNode, MasterOutlineStatus } from "@/rest/master-outline";
import { flattenVisibleTree, TAG_PRESETS } from "./tree-utils";
import styles from "./style.module.scss";

interface TableViewProps {
  tree: MasterOutlineNode;
  statusFilter: string;
  onUpdateNode: (id: string, patch: Partial<Omit<MasterOutlineNode, "id" | "children">>) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (id: string) => void;
  onMoveNode: (id: string, dir: "up" | "down") => void;
  onToggleCollapse: (id: string) => void;
  onJumpToAiAnalysis: (chapterRange: string, title: string) => void;
}

export default function TableView({
  tree,
  statusFilter,
  onUpdateNode,
  onAddChild,
  onDeleteNode,
  onMoveNode,
  onToggleCollapse,
  onJumpToAiAnalysis,
}: TableViewProps) {
  const rows = useMemo(() => {
    const all = flattenVisibleTree(tree);
    if (!statusFilter || statusFilter === "all") return all;
    return all.filter((r) => r.depth === 0 || (r.node.status || "planned") === statusFilter);
  }, [tree, statusFilter]);

  return (
    <ScrollArea flex={1} px={16} py={12}>
      <Box bg="#ffffff" bd="1px solid #f1f5f9" bdrs={8} style={{ overflow: "hidden" }}>
        <Table highlightOnHover verticalSpacing={6} horizontalSpacing="sm">
          <Table.Thead bg="#f8fafc">
            <Table.Tr>
              <Table.Th w={260}><Text fz={12} fw={600} c="#475569">层级节点名称</Text></Table.Th>
              <Table.Th w={110}><Text fz={12} fw={600} c="#475569">标签</Text></Table.Th>
              <Table.Th><Text fz={12} fw={600} c="#475569">要点说明</Text></Table.Th>
              <Table.Th w={110}><Text fz={12} fw={600} c="#475569">关联章节</Text></Table.Th>
              <Table.Th w={110}><Text fz={12} fw={600} c="#475569">状态</Text></Table.Th>
              <Table.Th w={140}><Text fz={12} fw={600} c="#475569">操作</Text></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(({ node, depth, siblingIndex, siblingCount }) => {
              const isRoot = depth === 0;
              const hasChildren = node.children.length > 0;

              return (
                <Table.Tr key={node.id} className={styles.tableRow}>
                  <Table.Td>
                    <Flex align="center" gap={4} pl={depth * 18}>
                      {hasChildren ? (
                        <ActionIcon variant="subtle" color="gray" size={20} onClick={() => onToggleCollapse(node.id)}>
                          {node.collapsed ? <FiChevronRight size={13} /> : <FiChevronDown size={13} />}
                        </ActionIcon>
                      ) : (
                        <Box w={20} />
                      )}
                      <input
                        value={node.title}
                        className={styles.inlineInput}
                        style={{ fontWeight: isRoot ? 700 : depth === 1 ? 600 : 400 }}
                        onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
                      />
                    </Flex>
                  </Table.Td>

                  <Table.Td>
                    <input
                      list="master-outline-tag-presets"
                      value={node.tag || ""}
                      placeholder="主线/伏笔"
                      className={styles.inlineInput}
                      onChange={(e) => onUpdateNode(node.id, { tag: e.target.value })}
                    />
                  </Table.Td>

                  <Table.Td>
                    <input
                      value={node.note || ""}
                      placeholder="填写核心冲突、推进目标或伏笔要点..."
                      className={styles.inlineInput}
                      onChange={(e) => onUpdateNode(node.id, { note: e.target.value })}
                    />
                  </Table.Td>

                  <Table.Td>
                    <input
                      value={node.chapterRange || ""}
                      placeholder="如 1-20"
                      className={styles.inlineInput}
                      onChange={(e) => onUpdateNode(node.id, { chapterRange: e.target.value })}
                    />
                  </Table.Td>

                  <Table.Td>
                    <Select
                      size="xs"
                      variant="unstyled"
                      value={node.status || "planned"}
                      data={[
                        { value: "planned", label: "规划中" },
                        { value: "in_progress", label: "进行中" },
                        { value: "completed", label: "已完成" },
                      ]}
                      onChange={(val) => onUpdateNode(node.id, { status: (val || "planned") as MasterOutlineStatus })}
                    />
                  </Table.Td>

                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="添加子节点">
                        <ActionIcon variant="subtle" color="cyan" size={24} onClick={() => onAddChild(node.id)}>
                          <FiPlus size={13} />
                        </ActionIcon>
                      </Tooltip>

                      {!isRoot ? (
                        <>
                          <Tooltip label="上移">
                            <ActionIcon variant="subtle" color="gray" size={24} disabled={siblingIndex === 0} onClick={() => onMoveNode(node.id, "up")}>
                              <FiArrowUp size={13} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="下移">
                            <ActionIcon variant="subtle" color="gray" size={24} disabled={siblingIndex === siblingCount - 1} onClick={() => onMoveNode(node.id, "down")}>
                              <FiArrowDown size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      ) : null}

                      {node.chapterRange?.trim() ? (
                        <Tooltip label="跳转 AI 区间诊断">
                          <ActionIcon variant="subtle" color="cyan" size={24} onClick={() => onJumpToAiAnalysis(node.chapterRange || "", node.title)}>
                            <FiCpu size={13} />
                          </ActionIcon>
                        </Tooltip>
                      ) : null}

                      {!isRoot ? (
                        <Tooltip label="删除节点及子项">
                          <ActionIcon variant="subtle" color="red" size={24} onClick={() => onDeleteNode(node.id)}>
                            <FiTrash2 size={13} />
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        <datalist id="master-outline-tag-presets">
          {TAG_PRESETS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Box>
    </ScrollArea>
  );
}
