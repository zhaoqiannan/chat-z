"use client";

import React, { useState } from "react";
import {
  Modal,
  Tabs,
  Textarea,
  TextInput,
  Select,
  Button,
  Stack,
  Flex,
  Text,
  Paper,
  SimpleGrid,
} from "@mantine/core";
import {
  FiZap,
  FiCompass,
  FiScissors,
  FiCheckCircle,
  FiTrendingUp,
  FiGitBranch,
} from "react-icons/fi";
import { requestOutlineAi, OutlineAiAction, OutlineNode } from "@/rest/outline";
import { PreviewData } from "../modal-ai-preview";

interface ModalAiAssistantProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  currentNode: OutlineNode | null;
  allNodes: OutlineNode[];
  onOpenPreview: (data: PreviewData) => void;
}

export default function ModalAiAssistant({
  opened,
  onClose,
  workId,
  currentNode,
  allNodes,
  onOpenPreview,
}: ModalAiAssistantProps) {
  const [activeTab, setActiveTab] = useState<string | null>("generation");
  const [premise, setPremise] = useState("");
  const [targetNodeId, setTargetNodeId] = useState<string>(currentNode?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (opened) {
      setTargetNodeId(currentNode?.id || (allNodes.length > 0 ? allNodes[0].id : ""));
      setError("");
    }
  }, [opened, currentNode, allNodes]);

  const handleExecuteAction = async (action: OutlineAiAction) => {
    try {
      setLoading(true);
      setError("");
      const targetObj = allNodes.find((n) => n.id === targetNodeId) || currentNode || undefined;

      const res = await requestOutlineAi({
        workId,
        action,
        premise: premise.trim(),
        targetNodeId: targetObj?.id,
        targetNode: targetObj,
      });

      if (res && res.success && res.result) {
        onClose();
        onOpenPreview(res.result);
      } else {
        setError(res?.message || "AI 处理失败");
      }
    } catch (err: any) {
      setError(err?.message || "网络请求失败");
    } finally {
      setLoading(false);
    }
  };

  const nodeOptions = allNodes.map((n) => ({
    value: n.id,
    label: `${n.type === "volume" ? "📁" : n.type === "act" ? "🎬" : "📍"} ${n.title}`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <FiZap color="#00c9ff" size={18} />
          <Text fw={700} fz={16}>
            大纲 AI 智能工作台
          </Text>
        </Flex>
      }
      centered
      size="lg"
      radius="md"
    >
      <Tabs value={activeTab} onChange={setActiveTab} color="cyan">
        <Tabs.List mb="md">
          <Tabs.Tab value="generation" leftSection={<FiCompass size={14} />}>
            大纲生成与规划
          </Tabs.Tab>
          <Tabs.Tab value="refinement" leftSection={<FiScissors size={14} />}>
            节点细化与拆解
          </Tabs.Tab>
          <Tabs.Tab value="diagnosis" leftSection={<FiCheckCircle size={14} />}>
            大纲体检与诊断
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: 大纲生成与规划 */}
        <Tabs.Panel value="generation">
          <Stack gap="14px">
            <Paper p="14px" bg="#f8fafc" withBorder radius="md">
              <Text fz={14} fw={700} c="#1e293b" mb={6}>
                🌟 一句话故事推演大纲
              </Text>
              <Text fz={12} c="#64748b" mb={10}>
                输入核心创意梗概，AI 将自动架构全书主线、多卷格局及第一卷核心情节点。
              </Text>
              <Textarea
                placeholder="例如：被废弃的帝国皇子，获得上古星图遗物，逆袭重夺王座..."
                value={premise}
                onChange={(e) => setPremise(e.currentTarget.value)}
                minRows={3}
                mb={12}
              />
              <Flex justify="flex-end">
                <Button
                  color="violet"
                  loading={loading}
                  onClick={() => handleExecuteAction("generate_from_premise")}
                >
                  推演全书大纲体系
                </Button>
              </Flex>
            </Paper>

            <Paper p="14px" bg="#f8fafc" withBorder radius="md">
              <Text fz={14} fw={700} c="#1e293b" mb={6}>
                📖 卷大纲自动生成章节规划
              </Text>
              <Text fz={12} c="#64748b" mb={10}>
                选择一个分卷节点，AI 将把本卷大纲拆解为 5~10 个具体的正文章节节拍。
              </Text>
              <Select
                label="选择目标分卷"
                placeholder="请选择要规划章节的分卷"
                data={nodeOptions}
                value={targetNodeId}
                onChange={(val) => setTargetNodeId(val || "")}
                mb={12}
              />
              <Flex justify="flex-end">
                <Button
                  color="teal"
                  loading={loading}
                  onClick={() => handleExecuteAction("plan_chapters")}
                >
                  生成章节规划
                </Button>
              </Flex>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* Tab 2: 节点细化与拆解 */}
        <Tabs.Panel value="refinement">
          <Stack gap="14px">
            <Select
              label="🎯 当前操作的剧情节点"
              data={nodeOptions}
              value={targetNodeId}
              onChange={(val) => setTargetNodeId(val || "")}
            />

            <SimpleGrid cols={2} spacing="12px">
              <Paper p="14px" bg="#f8fafc" withBorder radius="md">
                <Text fz={14} fw={700} c="#1e293b" mb={4}>
                  ⚡ 扩写当前节点
                </Text>
                <Text fz={12} c="#64748b" mb={12}>
                  为所选节点补全主要冲突、事件描述、状态变化及伏笔设计。
                </Text>
                <Button
                  fullWidth
                  variant="light"
                  color="blue"
                  loading={loading}
                  onClick={() => handleExecuteAction("expand_node")}
                >
                  扩写细化节点
                </Button>
              </Paper>

              <Paper p="14px" bg="#f8fafc" withBorder radius="md">
                <Text fz={14} fw={700} c="#1e293b" mb={4}>
                  ✂️ 拆分为多个情节点
                </Text>
                <Text fz={12} c="#64748b" mb={12}>
                  按“起承转合”将单个节点精准拆解为 4 个连贯的情景点。
                </Text>
                <Button
                  fullWidth
                  variant="light"
                  color="teal"
                  loading={loading}
                  onClick={() => handleExecuteAction("split_node")}
                >
                  一键拆解情节点
                </Button>
              </Paper>
            </SimpleGrid>

            <Paper p="14px" bg="#f8fafc" withBorder radius="md">
              <Flex justify="space-between" align="center">
                <div>
                  <Text fz={14} fw={700} c="#1e293b">
                    🌿 提供替代剧情方案
                  </Text>
                  <Text fz={12} c="#64748b">
                    发散碾压流、智谋借势、绝地反转等 3 种完全不同的故事分支。
                  </Text>
                </div>
                <Button
                  variant="outline"
                  color="grape"
                  loading={loading}
                  onClick={() => handleExecuteAction("alternative_plots")}
                >
                  发散替代方案
                </Button>
              </Flex>
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* Tab 3: 大纲诊断与评估 */}
        <Tabs.Panel value="diagnosis">
          <Stack gap="12px">
            <Text fz={13} c="#64748b">
              AI 将对全书大纲进行深度结构体检，识别主线断层、冲突平淡或节奏拖沓等问题：
            </Text>

            <Paper p="14px" bg="#f8fafc" withBorder radius="md">
              <Flex justify="space-between" align="center">
                <div>
                  <Text fz={14} fw={700} c="#1e293b">
                    🎯 检查主线完整度
                  </Text>
                  <Text fz={12} c="#64748b">
                    评估起因、动机、高潮与终局逻辑链条是否完整。
                  </Text>
                </div>
                <Button
                  variant="light"
                  color="blue"
                  loading={loading}
                  onClick={() => handleExecuteAction("check_mainline")}
                >
                  诊断主线
                </Button>
              </Flex>
            </Paper>

            <Paper p="14px" bg="#f8fafc" withBorder radius="md">
              <Flex justify="space-between" align="center">
                <div>
                  <Text fz={14} fw={700} c="#1e293b">
                    ⚡ 检查冲突密度
                  </Text>
                  <Text fz={12} c="#64748b">
                    分析各节点阻碍与危机分布，避免平淡流水账。
                  </Text>
                </div>
                <Button
                  variant="light"
                  color="orange"
                  loading={loading}
                  onClick={() => handleExecuteAction("check_conflict")}
                >
                  诊断冲突
                </Button>
              </Flex>
            </Paper>

            <Paper p="14px" bg="#f8fafc" withBorder radius="md">
              <Flex justify="space-between" align="center">
                <div>
                  <Text fz={14} fw={700} c="#1e293b">
                    📈 检查故事节奏 (Pacing)
                  </Text>
                  <Text fz={12} c="#64748b">
                    分析悬念设置、爽点释放频率与过渡节拍合理性。
                  </Text>
                </div>
                <Button
                  variant="light"
                  color="teal"
                  loading={loading}
                  onClick={() => handleExecuteAction("check_pacing")}
                >
                  诊断节奏
                </Button>
              </Flex>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {error && (
        <Text c="red" fz="xs" mt={10}>
          {error}
        </Text>
      )}
    </Modal>
  );
}
