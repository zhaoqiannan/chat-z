"use client";

import React, { useMemo } from "react";
import dayjs from "dayjs";
import { Badge, Box, Button, Flex, Group, Modal, Paper, ScrollArea, SimpleGrid, Stack, Text } from "@mantine/core";
import { FiAlertCircle, FiAlertTriangle, FiArrowRight, FiBookOpen, FiCheck, FiCheckCircle, FiCopy, FiGitMerge, FiList, FiPlus, FiRefreshCw, FiSliders, FiZap } from "react-icons/fi";
import { MasterOutlineNode, MasterOutlineRecommendedStep } from "@/rest/master-outline";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";
import { findNode } from "./tree-utils";

interface ModalLogicDeductionProps {
  opened: boolean;
  onClose: () => void;
  node: MasterOutlineNode | null;
  loading: boolean;
  onReDeduce: () => void;
  onAdoptNodeChange: (targetNodeId: string, patch: { title: string; note: string }) => void;
  onAdoptNewChild: (parentId: string, title: string, note: string) => void;
}

function resolveMatchedNode(rootSubtree: MasterOutlineNode, step: MasterOutlineRecommendedStep, idx: number): MasterOutlineNode | null {
  if (step.nodeId) {
    const byId = findNode(rootSubtree, step.nodeId);
    if (byId) return byId;
  }
  const origTitle = step.originalTitle?.trim();
  if (origTitle) {
    if (rootSubtree.title.trim() === origTitle) return rootSubtree;
    const stack: MasterOutlineNode[] = [...rootSubtree.children];
    while (stack.length > 0) {
      const cur = stack.shift()!;
      if (cur.title.trim() === origTitle) return cur;
      if (cur.children.length > 0) stack.push(...cur.children);
    }
  }
  // 兼容旧版未返回 nodeId 的推算缓存：仅在未显式声明新增且索引落在直属子节点范围内时兜底匹配
  if (step.nodeId === undefined && !origTitle && idx < rootSubtree.children.length) {
    return rootSubtree.children[idx];
  }
  return null;
}

export default function ModalLogicDeduction({
  opened,
  onClose,
  node,
  loading,
  onReDeduce,
  onAdoptNodeChange,
  onAdoptNewChild,
}: ModalLogicDeductionProps) {
  const deduction = node?.logicDeduction || null;

  const resolvedSteps = useMemo(() => {
    if (!node || !deduction?.recommendedLogicLine?.length) return [];
    return deduction.recommendedLogicLine.map((step, idx) => {
      const matched = resolveMatchedNode(node, step, idx);
      const isAdopted = Boolean(
        matched &&
          matched.title.trim() === step.title.trim() &&
          (matched.note || "").trim() === (step.note || "").trim()
      );
      return { step, idx, matched, isAdopted };
    });
  }, [node, deduction]);

  const handleCopyRecommendedLine = () => {
    if (!deduction?.recommendedLogicLine?.length) return;
    const text = deduction.recommendedLogicLine
      .map((item, idx) => `${item.step || idx + 1}. ${item.title}\n   ${item.note}`)
      .join("\n\n");
    navigator.clipboard
      ?.writeText(text)
      .then(() => useAlert.success("已复制建议最终修改逻辑线"))
      .catch(() => useAlert.error("复制失败，请手动选中复制"));
  };

  const handleAdoptAll = () => {
    if (!node || resolvedSteps.length === 0) return;
    let updatedCount = 0;
    let addedCount = 0;
    resolvedSteps.forEach(({ step, matched, isAdopted }) => {
      if (isAdopted) return;
      if (matched) {
        onAdoptNodeChange(matched.id, { title: step.title, note: step.note });
        updatedCount += 1;
      } else {
        onAdoptNewChild(node.id, step.title, step.note);
        addedCount += 1;
      }
    });
    if (updatedCount === 0 && addedCount === 0) {
      useAlert.info("所有建议修改均已同步到对应卡片");
      return;
    }
    const parts: string[] = [];
    if (updatedCount > 0) parts.push(`同步修改 ${updatedCount} 个节点`);
    if (addedCount > 0) parts.push(`新增 ${addedCount} 个子节点`);
    useAlert.success(`已${parts.join("，")}，确认无误后请点击「保存总纲」`);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="80vw"
      scrollAreaComponent={ScrollArea.Autosize}
      title={
        <Flex align="center" gap={8}>
          <FiGitMerge size={17} color="#00c9ff" />
          <Text fz={16} fw={700} c="#0f172a">AI 大纲逻辑推算</Text>
          {node ? <Badge size="sm" variant="light" color="cyan">{node.title}</Badge> : null}
        </Flex>
      }
    >
      <Box pos="relative" mih={260}>
        <LoadingMask visible={loading} label="AI 正在梳理当前节点与子节点的剧情发展及逻辑脉络..." />

        {node ? (
          <Stack gap={14} pt={4}>
            {/* 顶部信息条：上次推算时间 + 重新推算按钮 */}
            <Paper p={10} radius="md" bg="#f8fafc" bd="1px solid #e2e8f0">
              <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                <Group gap={8}>
                  <Text fz={12} c="#475569">
                    包含下属子节点：<Text span fw={700} c="#0f172a">{node.children.length}</Text> 个
                  </Text>
                  {deduction?.updatedAt ? (
                    <Text fz={12} c="#64748b">
                      · 上次推算：{dayjs(deduction.updatedAt).format("YYYY-MM-DD HH:mm:ss")}
                    </Text>
                  ) : null}
                </Group>

                <Button size="xs" leftSection={<FiRefreshCw size={13} />} loading={loading} onClick={onReDeduce}>
                  {deduction ? "重新推算" : "开始推算"}
                </Button>
              </Flex>
            </Paper>

            {deduction ? (
              <Stack gap={12}>
                {/* 1. 逻辑线梳理 */}
                <Paper p={12} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                  <Flex align="center" gap={6} mb={6}>
                    <FiList size={14} color="#00a8d6" />
                    <Text fz={13} fw={700} c="#0f172a">逻辑线梳理</Text>
                  </Flex>
                  <Text fz={13} c="#334155" lh={1.7} style={{ whiteSpace: "pre-wrap" }}>
                    {deduction.logicLine}
                  </Text>
                </Paper>

                {/* 2. 建议章节与字数篇幅控制 */}
                <Paper p={12} radius="md" bg="#f8fafc" bd="1px solid #e2e8f0">
                  <Flex align="center" gap={6} mb={6}>
                    <FiBookOpen size={14} color="#00a8d6" />
                    <Text fz={13} fw={700} c="#0f172a">建议章节与篇幅控制</Text>
                  </Flex>
                  {deduction.suggestedChapterPacing ? (
                    <Text fz={13} c="#334155" lh={1.65} style={{ whiteSpace: "pre-wrap" }}>
                      {deduction.suggestedChapterPacing}
                    </Text>
                  ) : (
                    <Text fz={12} c="#64748b">上次推算未包含建议章节与字数篇幅，点击上方「重新推算」即可生成。</Text>
                  )}
                </Paper>

                {/* 3. 是否有问题 */}
                <Paper p={12} radius="md" bg={deduction.hasIssues ? "#fffbeb" : "#f0fdf4"} bd={deduction.hasIssues ? "1px solid #fde68a" : "1px solid #bbf7d0"}>
                  <Flex align="center" justify="space-between" gap={8} mb={6}>
                    <Flex align="center" gap={6}>
                      {deduction.hasIssues ? <FiAlertCircle size={15} color="#d97706" /> : <FiCheckCircle size={15} color="#16a34a" />}
                      <Text fz={13} fw={700} c="#0f172a">是否有问题</Text>
                    </Flex>
                    <Badge size="sm" variant="light" color={deduction.hasIssues ? "orange" : "green"}>
                      {deduction.hasIssues ? "存在需关注问题" : "逻辑整体自洽"}
                    </Badge>
                  </Flex>
                  <Text fz={13} c="#334155" lh={1.65} style={{ whiteSpace: "pre-wrap" }}>
                    {deduction.issueConclusion}
                  </Text>
                </Paper>

                {/* 4 & 5. 逻辑漏洞与可优化部分并排展示（宽屏更清爽） */}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing={12}>
                  <Paper p={12} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                    <Flex align="center" gap={6} mb={8}>
                      <FiAlertTriangle size={14} color="#ef4444" />
                      <Text fz={13} fw={700} c="#0f172a">是否存在逻辑漏洞</Text>
                    </Flex>
                    {deduction.logicHoles.length > 0 ? (
                      <Stack gap={6}>
                        {deduction.logicHoles.map((hole, idx) => (
                          <Flex key={idx} align="flex-start" gap={8}>
                            <Badge size="xs" variant="light" color="red" mt={3}>{idx + 1}</Badge>
                            <Text fz={13} c="#334155" lh={1.6} flex={1}>{hole}</Text>
                          </Flex>
                        ))}
                      </Stack>
                    ) : (
                      <Text fz={12} c="#16a34a">未发现明显逻辑漏洞，当前子节点因果链条基本闭合。</Text>
                    )}
                  </Paper>

                  <Paper p={12} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                    <Flex align="center" gap={6} mb={8}>
                      <FiSliders size={14} color="#00a8d6" />
                      <Text fz={13} fw={700} c="#0f172a">是否存在可优化部分</Text>
                    </Flex>
                    {deduction.optimizablePoints.length > 0 ? (
                      <Stack gap={6}>
                        {deduction.optimizablePoints.map((point, idx) => (
                          <Flex key={idx} align="flex-start" gap={8}>
                            <Badge size="xs" variant="light" color="cyan" mt={3}>{idx + 1}</Badge>
                            <Text fz={13} c="#334155" lh={1.6} flex={1}>{point}</Text>
                          </Flex>
                        ))}
                      </Stack>
                    ) : (
                      <Text fz={12} c="#64748b">当前节点编排较为紧凑，暂无明显待优化部分。</Text>
                    )}
                  </Paper>
                </SimpleGrid>

                {/* 6. 有问题的地方的优化建议 */}
                <Paper p={12} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                  <Flex align="center" gap={6} mb={8}>
                    <FiZap size={14} color="#2563eb" />
                    <Text fz={13} fw={700} c="#0f172a">有问题的地方的优化建议</Text>
                  </Flex>
                  {deduction.optimizationSuggestions.length > 0 ? (
                    <Stack gap={8}>
                      {deduction.optimizationSuggestions.map((item, idx) => (
                        <Paper key={idx} p={10} radius="sm" bg="#f8fafc" bd="1px solid #f1f5f9">
                          <Group gap={6} mb={4}>
                            <Badge size="xs" variant="filled" color="blue">{item.targetNodeTitle || "节点优化"}</Badge>
                          </Group>
                          {item.problem ? (
                            <Text fz={12} c="#64748b" lh={1.55} mb={4}>
                              <Text span fw={600} c="#475569">问题定位：</Text>{item.problem}
                            </Text>
                          ) : null}
                          <Text fz={13} c="#1e293b" lh={1.6}>
                            <Text span fw={600} c="#00a8d6">优化建议：</Text>{item.suggestion}
                          </Text>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text fz={12} c="#64748b">暂无需要强制修改的节点问题。</Text>
                  )}
                </Paper>

                {/* 7. 建议最终修改逻辑线（逐卡片对比 + 一键采纳同步） */}
                <Paper p={12} radius="md" bg="#f0fcff" bd="1px solid rgba(0, 201, 255, 0.35)">
                  <Flex align="center" justify="space-between" gap={8} mb={10} wrap="wrap">
                    <Flex align="center" gap={8}>
                      <FiGitMerge size={14} color="#00a8d6" />
                      <Text fz={13} fw={700} c="#0f172a">建议最终修改逻辑线（卡片改动对照）</Text>
                      <Text fz={11} c="#64748b">点击「采纳」立即同步卡片标题与要点，最终请点击「保存总纲」落库</Text>
                    </Flex>
                    {resolvedSteps.length > 0 ? (
                      <Group gap={6}>
                        <Button size="compact-xs" variant="light" leftSection={<FiCopy size={12} />} onClick={handleCopyRecommendedLine}>
                          复制逻辑线
                        </Button>
                        <Button size="compact-xs" leftSection={<FiCheck size={12} />} onClick={handleAdoptAll}>
                          全部采纳
                        </Button>
                      </Group>
                    ) : null}
                  </Flex>

                  {resolvedSteps.length > 0 ? (
                    <Stack gap={10}>
                      {resolvedSteps.map(({ step, idx, matched, isAdopted }) => {
                        const beforeTitle = matched ? matched.title : step.originalTitle || "";
                        const beforeNote = matched ? matched.note || "" : step.originalNote || "";

                        return (
                          <Paper key={idx} p={12} radius="sm" bg="#ffffff" bd="1px solid rgba(0, 201, 255, 0.22)">
                            <Flex align="center" justify="space-between" gap={8} mb={8} wrap="wrap">
                              <Flex align="center" gap={8} wrap="wrap">
                                <Badge size="xs" variant="filled" color="cyan">步骤 {step.step || idx + 1}</Badge>
                                {matched ? (
                                  <Badge size="xs" variant="light" color="blue">对应卡片：{matched.title}</Badge>
                                ) : (
                                  <Badge size="xs" variant="light" color="grape">建议新增子节点</Badge>
                                )}
                                {step.changeSummary ? (
                                  <Text fz={12} c="#64748b">· {step.changeSummary}</Text>
                                ) : null}
                              </Flex>

                              {matched ? (
                                <Button
                                  size="compact-xs"
                                  variant={isAdopted ? "light" : "filled"}
                                  color={isAdopted ? "green" : undefined}
                                  leftSection={<FiCheck size={12} />}
                                  disabled={isAdopted}
                                  onClick={() => {
                                    onAdoptNodeChange(matched.id, { title: step.title, note: step.note });
                                    useAlert.success(`已采纳并同步卡片「${step.title}」，记得保存总纲`);
                                  }}
                                >
                                  {isAdopted ? "已采纳" : "采纳"}
                                </Button>
                              ) : (
                                <Button
                                  size="compact-xs"
                                  variant="light"
                                  leftSection={<FiPlus size={12} />}
                                  onClick={() => {
                                    onAdoptNewChild(node.id, step.title, step.note);
                                    useAlert.success(`已新增子节点「${step.title}」，记得保存总纲`);
                                  }}
                                >
                                  采纳并新增
                                </Button>
                              )}
                            </Flex>

                            <Flex align="stretch" gap={10} direction={{ base: "column", md: "row" }}>
                              {/* 左侧：原卡片内容 */}
                              <Box flex={1} p={10} bdrs={6} bg="#f8fafc" bd="1px solid #e2e8f0">
                                <Text fz={11} fw={600} c="#64748b" mb={4}>
                                  {matched ? "当前卡片原内容" : "原节点"}
                                </Text>
                                {beforeTitle || beforeNote ? (
                                  <>
                                    <Text fz={13} fw={600} c="#334155" mb={4}>{beforeTitle || "（无标题）"}</Text>
                                    <Text fz={12} c="#64748b" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>
                                      {beforeNote || "（原节点暂未填写要点说明）"}
                                    </Text>
                                  </>
                                ) : (
                                  <Text fz={12} c="#94a3b8">（当前总纲中无此节点，建议新增衔接）</Text>
                                )}
                              </Box>

                              <Flex align="center" justify="center" px={2}>
                                <FiArrowRight size={16} color="#00a8d6" />
                              </Flex>

                              {/* 右侧：建议修改为 */}
                              <Box flex={1} p={10} bdrs={6} bg="#f0fcff" bd="1px solid rgba(0, 201, 255, 0.35)">
                                <Text fz={11} fw={600} c="#00a8d6" mb={4}>建议修改为</Text>
                                <Text fz={13} fw={700} c="#0f172a" mb={4}>{step.title}</Text>
                                <Text fz={12} c="#334155" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>{step.note}</Text>
                              </Box>
                            </Flex>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Text fz={12} c="#64748b">当前原有逻辑线即可作为最终版本，无需大幅调整。</Text>
                  )}
                </Paper>
              </Stack>
            ) : !loading ? (
              <Flex direction="column" align="center" justify="center" py={48} gap={10}>
                <Text fz={13} c="#64748b">该节点暂无推算记录，点击上方「开始推算」生成当前节点与子节点的剧情逻辑梳理。</Text>
              </Flex>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    </Modal>
  );
}
