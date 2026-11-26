"use client";

import React from "react";
import dayjs from "dayjs";
import { Badge, Box, Button, Flex, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiCopy, FiGitMerge, FiList, FiRefreshCw, FiSliders, FiZap } from "react-icons/fi";
import { MasterOutlineNode } from "@/rest/master-outline";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";

interface ModalLogicDeductionProps {
  opened: boolean;
  onClose: () => void;
  node: MasterOutlineNode | null;
  loading: boolean;
  onReDeduce: () => void;
}

export default function ModalLogicDeduction({ opened, onClose, node, loading, onReDeduce }: ModalLogicDeductionProps) {
  const deduction = node?.logicDeduction || null;

  const handleCopyRecommendedLine = () => {
    if (!deduction?.recommendedLogicLine?.length) return;
    const text = deduction.recommendedLogicLine.map((item, idx) => `${item.step || idx + 1}. ${item.title}\n   ${item.note}`).join("\n\n");
    navigator.clipboard
      ?.writeText(text)
      .then(() => useAlert.success("已复制建议最终修改逻辑线"))
      .catch(() => useAlert.error("复制失败，请手动选中复制"));
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="760px"
      scrollAreaComponent={ScrollArea.Autosize}
      title={
        <Flex align="center" gap={8}>
          <FiGitMerge size={17} color="#00c9ff" />
          <Text fz={16} fw={700} c="#0f172a">AI 大纲逻辑推算</Text>
          {node ? <Badge size="sm" variant="light" color="cyan">{node.title}</Badge> : null}
        </Flex>
      }
    >
      <Box pos="relative" mih={240}>
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

                {/* 2. 是否有问题 */}
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

                {/* 3. 是否存在逻辑漏洞 */}
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

                {/* 4. 是否存在可优化部分 */}
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

                {/* 5. 有问题的地方的优化建议 */}
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

                {/* 6. 建议最终修改逻辑线 */}
                <Paper p={12} radius="md" bg="#f0fcff" bd="1px solid rgba(0, 201, 255, 0.35)">
                  <Flex align="center" justify="space-between" gap={8} mb={10}>
                    <Flex align="center" gap={6}>
                      <FiGitMerge size={14} color="#00a8d6" />
                      <Text fz={13} fw={700} c="#0f172a">建议最终修改逻辑线</Text>
                    </Flex>
                    {deduction.recommendedLogicLine.length > 0 ? (
                      <Button size="compact-xs" variant="light" leftSection={<FiCopy size={12} />} onClick={handleCopyRecommendedLine}>
                        复制逻辑线
                      </Button>
                    ) : null}
                  </Flex>
                  {deduction.recommendedLogicLine.length > 0 ? (
                    <Stack gap={8}>
                      {deduction.recommendedLogicLine.map((step, idx) => (
                        <Paper key={idx} p={10} radius="sm" bg="#ffffff" bd="1px solid rgba(0, 201, 255, 0.2)">
                          <Flex align="center" gap={8} mb={4}>
                            <Badge size="xs" variant="filled" color="cyan">步骤 {step.step || idx + 1}</Badge>
                            <Text fz={13} fw={700} c="#0f172a">{step.title}</Text>
                          </Flex>
                          <Text fz={12} c="#475569" lh={1.6} style={{ whiteSpace: "pre-wrap" }}>{step.note}</Text>
                        </Paper>
                      ))}
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
