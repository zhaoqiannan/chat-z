// 组件：推演历史抽屉（独立展示 A➔B 推演历史方案、支持查看展开各方案步骤、一键采纳至大纲、宽度 55vw）
"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Badge,
  ActionIcon,
  Stack,
  Paper,
  Group,
  Text,
  Button,
  Flex,
  Box,
  Collapse,
  Divider,
} from "@mantine/core";
import {
  FiClock,
  FiTrash2,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiZap,
  FiArrowRight,
  FiCornerDownRight,
} from "react-icons/fi";
import {
  PlotDeductionRecord,
  PlotDeductionPath,
  getPlotDeductions,
  deletePlotDeduction,
  batchCreateOutlineNodes,
} from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";

interface DrawerPlotDeductionHistoryProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  onOutlineUpdated: () => Promise<void>;
  onLoadToDeduct?: (record: PlotDeductionRecord) => void;
}

export default function DrawerPlotDeductionHistory({
  opened,
  onClose,
  workId,
  onOutlineUpdated,
  onLoadToDeduct,
}: DrawerPlotDeductionHistoryProps) {
  const [loading, setLoading] = useState(false);
  const [historyList, setHistoryList] = useState<PlotDeductionRecord[]>([]);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<number, boolean>>({});
  const [adoptingPathKey, setAdoptingPathKey] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getPlotDeductions(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setHistoryList(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened && workId) {
      fetchHistory();
    }
  }, [opened, workId]);

  const toggleExpandRecord = (recId: number) => {
    setExpandedRecordIds((prev) => ({
      ...prev,
      [recId]: !prev[recId],
    }));
  };

  const handleDeleteHistory = async (id: number) => {
    const isConfirmed = await showConfirm({
      title: "删除推演历史",
      message: "确定要删除这条推演历史记录吗？",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deletePlotDeduction(id);
        setHistoryList((prev) => prev.filter((h) => h.id !== id));
        useAlert.success("已删除该推演记录");
      } catch (e) {
        useAlert.error("删除失败");
      }
    }
  };

  // 一键采纳历史推演中的某套方案到大纲 (作为 1 个一级主纲节点 + N 个二级步骤)
  const handleAdoptPath = async (rec: PlotDeductionRecord, path: PlotDeductionPath) => {
    const key = `${rec.id}_${path.id}`;
    try {
      setAdoptingPathKey(key);
      const parentTitle = `推演：从「${rec.startPoint.slice(0, 15)}」到「${rec.targetPoint.slice(0, 15)}」· ${path.title}`;

      // 组装 1 个 Level-1 节点，包含 children (Level-2)
      const level1NodePayload = {
        workId: Number(workId),
        category: "deduction",
        level: 1,
        title: parentTitle,
        summary: path.summary || "推演桥梁总括",
        deductionOrigin: `从「${rec.startPoint}」➔「${rec.targetPoint}」· ${path.title}`,
        deductionPremise: rec.startPoint,
        deductionTarget: rec.targetPoint,
        deductionPathTitle: path.title,
        content: path.summary || "",
        event: path.summary || "",
        wordCountEstimate: 10000,
        type: "bridge",
        status: "planned",
        children: Array.isArray(path.steps)
          ? path.steps.map((step, idx) => {
              const stepNum = idx + 1;
              const stepContent = step.event || step.content || "";
              return {
                workId: Number(workId),
                category: "deduction",
                level: 2,
                title: step.title || `第 ${stepNum} 阶段`,
                deductionOrigin: `从「${rec.startPoint.slice(0, 20)}」➔「${rec.targetPoint.slice(0, 20)}」· ${path.title} · 第 ${stepNum} 阶段`,
                deductionPremise: rec.startPoint,
                deductionTarget: rec.targetPoint,
                deductionPathTitle: path.title,
                deductionStepIndex: stepNum,
                event: stepContent,
                twist: step.twist || step.keyConflict || "",
                nextGoal: step.nextGoal || "",
                suspense: step.suspense || "",
                content: stepContent,
                wordCountEstimate: step.estimatedWords || 2500,
                type: "scene",
                status: "planned",
                orderIndex: idx,
              };
            })
          : [],
      };

      await batchCreateOutlineNodes({
        workId: Number(workId),
        nodes: [level1NodePayload],
        batch: true,
      });

      useAlert.success(`已成功采纳方案「${path.title}」至剧情推演大纲！`);
      await onOutlineUpdated();
    } catch (e: any) {
      useAlert.error("采纳方案失败: " + (e?.message || "网络异常"));
    } finally {
      setAdoptingPathKey(null);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <FiClock size={16} color="#2563eb" />
          <Text fw={700} fz={16} c="#0f172a">
            剧情推演历史记录
          </Text>
          <Badge variant="light" color="blue" size="sm">
            共 {historyList.length} 条
          </Badge>
        </Group>
      }
      position="right"
      size="55vw"
    >
      <Stack gap="md" pb="xl">
        <Text fz={13} c="dimmed">
          记录过往所有 A➔B 剧情推演生成方案。你可以展开查看各套方案的具体阶段细则，或直接将方案采纳为大纲节点。
        </Text>

        {historyList.length === 0 ? (
          <Paper p="xl" withBorder radius="md" ta="center" bg="gray.0" my="md">
            <Text fz={13} c="dimmed">
              暂无历史推演记录，请在【A➔B 剧情推演】中生成方案。
            </Text>
          </Paper>
        ) : (
          historyList.map((rec) => {
            const isExpanded = !!expandedRecordIds[rec.id];
            const paths = Array.isArray(rec.generatedPaths) ? rec.generatedPaths : [];

            return (
              <Paper key={rec.id} p="md" withBorder radius="md" bg="#ffffff">
                <Flex justify="space-between" align="flex-start" wrap="wrap" gap="xs">
                  <Box style={{ flex: 1, minWidth: 260 }}>
                    <Group gap="xs" align="center" mb={4}>
                      <Badge variant="filled" color="blue" size="xs">
                        起点 A
                      </Badge>
                      <Text fz={13} fw={700} c="#0f172a">
                        {rec.startPoint}
                      </Text>
                    </Group>
                    <Group gap="xs" align="center" mb={6}>
                      <Badge variant="filled" color="teal" size="xs">
                        终点 B
                      </Badge>
                      <Text fz={13} fw={700} c="#0f172a">
                        {rec.targetPoint}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text fz={11} c="dimmed">
                        {new Date(rec.createdAt).toLocaleString("zh-CN")}
                      </Text>
                      <Text fz={11} c="dimmed">
                        · 包含 {paths.length} 套方案
                      </Text>
                      {rec.pacePreference && (
                        <Badge variant="outline" color="gray" size="xs">
                          {rec.pacePreference}
                        </Badge>
                      )}
                    </Group>
                  </Box>

                  <Group gap="xs">
                    {onLoadToDeduct && (
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        leftSection={<FiZap size={12} />}
                        onClick={() => {
                          onLoadToDeduct(rec);
                          onClose();
                        }}
                      >
                        载入推演台
                      </Button>
                    )}

                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      rightSection={isExpanded ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                      onClick={() => toggleExpandRecord(rec.id)}
                    >
                      {isExpanded ? "收起方案" : `查看方案 (${paths.length})`}
                    </Button>

                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteHistory(rec.id)}
                      title="删除记录"
                    >
                      <FiTrash2 size={13} />
                    </ActionIcon>
                  </Group>
                </Flex>

                {/* 展开查看包含的方案与步骤 */}
                <Collapse expanded={isExpanded}>
                  <Box mt="md" pt="sm" style={{ borderTop: "1px dashed #e2e8f0" }}>
                    <Stack gap="sm">
                      {paths.map((p, pIdx) => {
                        const key = `${rec.id}_${p.id}`;
                        const isAdopting = adoptingPathKey === key;

                        return (
                          <Paper key={p.id || pIdx} p="sm" withBorder radius="sm" bg="gray.0">
                            <Flex justify="space-between" align="center" mb="xs">
                              <Group gap="xs">
                                <Badge variant="light" color="indigo" size="sm">
                                  方案 {pIdx + 1}
                                </Badge>
                                <Text fz={14} fw={700} c="#0f172a">
                                  {p.title}
                                </Text>
                                {p.style && (
                                  <Badge variant="outline" color="blue" size="xs">
                                    {p.style}
                                  </Badge>
                                )}
                              </Group>

                              <Button
                                size="xs"
                                variant="filled"
                                color="teal"
                                leftSection={<FiCheck size={12} />}
                                loading={isAdopting}
                                onClick={() => handleAdoptPath(rec, p)}
                              >
                                采纳此方案为大纲
                              </Button>
                            </Flex>

                            {p.summary && (
                              <Text fz={12} c="#475569" mb="xs" style={{ lineHeight: 1.6 }}>
                                <b>方案总述：</b>
                                {p.summary}
                              </Text>
                            )}

                            {/* 步骤序列 */}
                            <Stack gap={6} pl="xs">
                              {Array.isArray(p.steps) &&
                                p.steps.map((step, sIdx) => (
                                  <Paper key={sIdx} p="xs" withBorder radius="xs" bg="#ffffff">
                                    <Flex align="center" gap="xs" mb={4}>
                                      <FiCornerDownRight size={12} color="#64748b" />
                                      <Badge variant="light" color="gray" size="xs">
                                        阶段 {sIdx + 1}
                                      </Badge>
                                      <Text fz={12} fw={700} c="#0f172a">
                                        {step.title}
                                      </Text>
                                      {step.estimatedWords && (
                                        <Text fz={11} c="dimmed">
                                          约 {step.estimatedWords} 字
                                        </Text>
                                      )}
                                    </Flex>
                                    <Text fz={12} c="#334155" style={{ lineHeight: 1.5 }}>
                                      {step.event || step.content}
                                    </Text>
                                    {step.twist && (
                                      <Text fz={11} c="orange.8" mt={2}>
                                        ⚡ 推进冲突: {step.twist}
                                      </Text>
                                    )}
                                  </Paper>
                                ))}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                </Collapse>
              </Paper>
            );
          })
        )}
      </Stack>
    </Drawer>
  );
}
