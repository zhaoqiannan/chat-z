"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Flex,
  Text,
  Button,
  Stack,
  Checkbox,
  Paper,
  Badge,
  ScrollArea,
  Divider,
} from "@mantine/core";
import { FiCheck, FiX, FiInfo, FiLayers, FiAlertCircle } from "react-icons/fi";
import { CreateOutlinePayload, OutlineNodeType, PlotPointType } from "@/rest/outline";

export interface PreviewData {
  action: string;
  summary: string;
  generatedTree?: any[];
  expandedData?: Partial<CreateOutlinePayload>;
  splitScenes?: any[];
  chapterPlans?: any[];
  diagnosis?: {
    title: string;
    score: number;
    totalNodes: number;
    pros: string[];
    suggestions: string[];
  };
  alternatives?: {
    name: string;
    description: string;
    advantage: string;
    risk: string;
  }[];
}

interface ModalAiPreviewProps {
  opened: boolean;
  onClose: () => void;
  previewData: PreviewData | null;
  targetNodeId?: string | null;
  onApplyAll: (data: PreviewData) => Promise<void>;
  onApplySelected: (selectedItems: any[]) => Promise<void>;
}

export default function ModalAiPreview({
  opened,
  onClose,
  previewData,
  onApplyAll,
  onApplySelected,
}: ModalAiPreviewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (previewData) {
      if (previewData.splitScenes) {
        setSelectedIds(previewData.splitScenes.map((s) => s.id));
      } else if (previewData.generatedTree) {
        setSelectedIds(previewData.generatedTree.map((g) => g.id));
      } else {
        setSelectedIds([]);
      }
    }
  }, [previewData]);

  if (!previewData) return null;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmAll = async () => {
    try {
      setLoading(true);
      await onApplyAll(previewData);
      onClose();
    } catch (e) {
      console.error("全量采纳失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSelected = async () => {
    try {
      setLoading(true);
      let itemsToApply: any[] = [];
      if (previewData.splitScenes) {
        itemsToApply = previewData.splitScenes.filter((s) => selectedIds.includes(s.id));
      } else if (previewData.generatedTree) {
        itemsToApply = previewData.generatedTree.filter((s) => selectedIds.includes(s.id));
      }
      await onApplySelected(itemsToApply);
      onClose();
    } catch (e) {
      console.error("部分采纳失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    // 1. 拆解出的情节点预览
    if (previewData.splitScenes && previewData.splitScenes.length > 0) {
      return (
        <Stack gap="12px">
          <Text fz={13} c="#64748b">
            以下为 AI 拆解出的紧凑情节点，您可以勾选需要保留的节点后点击“部分采纳”或“全部采纳”：
          </Text>
          {previewData.splitScenes.map((scene) => {
            const isChecked = selectedIds.includes(scene.id);
            return (
              <Paper
                key={scene.id}
                p="12px 16px"
                bg={isChecked ? "#f0fdf4" : "#ffffff"}
                bd={isChecked ? "1px solid #86efac" : "1px solid #e2e8f0"}
                radius="md"
              >
                <Flex align="flex-start" gap={12}>
                  <Checkbox
                    checked={isChecked}
                    onChange={() => handleToggleSelect(scene.id)}
                    mt={4}
                  />
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap={8} mb={4}>
                      <Badge size="sm" color="teal" variant="light">
                        {scene.pointType === "climax"
                          ? "🔥 高潮"
                          : scene.pointType === "twist"
                          ? "🔄 转折"
                          : scene.pointType === "conflict"
                          ? "⚡ 冲突"
                          : scene.pointType === "foreshadow"
                          ? "🌱 伏笔"
                          : "📍 情节"}
                      </Badge>
                      <Text fz={14} fw={700} c="#1e293b">
                        {scene.title}
                      </Text>
                    </Flex>
                    <Text fz={12} c="#475569" mb={2}>
                      <b>目标：</b>{scene.goal}
                    </Text>
                    <Text fz={12} c="#64748b">
                      <b>事件脉络：</b>{scene.eventDescription}
                    </Text>
                    {scene.foreshadowing && (
                      <Text fz={11} c="#0891b2" mt={4}>
                        🌱 伏笔：{scene.foreshadowing}
                      </Text>
                    )}
                  </Box>
                </Flex>
              </Paper>
            );
          })}
        </Stack>
      );
    }

    // 2. 一句话生大纲树预览
    if (previewData.generatedTree && previewData.generatedTree.length > 0) {
      return (
        <Stack gap="12px">
          <Text fz={13} c="#64748b">
            以下为 AI 构建的完整故事大纲骨架（含卷、幕与情节点）：
          </Text>
          {previewData.generatedTree.map((story) => (
            <Paper key={story.id} p="14px 18px" bg="#f8fafc" bd="1px solid #e2e8f0" radius="md">
              <Flex align="center" gap={8} mb={6}>
                <Badge color="violet" variant="filled" size="sm">
                  故事主线
                </Badge>
                <Text fz={15} fw={700} c="#1e293b">
                  {story.title}
                </Text>
              </Flex>
              <Text fz={13} c="#475569" mb={10}>
                <b>核心主旨与目标：</b>{story.goal}
              </Text>

              {story.children && story.children.length > 0 && (
                <Stack gap="8px" pl={16} style={{ borderLeft: "2px solid #cbd5e1" }}>
                  {story.children.map((vol: any) => (
                    <Box key={vol.id} p="8px 12px" bg="#ffffff" bd="1px solid #e2e8f0" style={{ borderRadius: 6 }}>
                      <Flex align="center" gap={6} mb={4}>
                        <Badge size="xs" color="indigo">分卷</Badge>
                        <Text fz={13} fw={600} c="#1e293b">{vol.title}</Text>
                      </Flex>
                      <Text fz={12} c="#64748b">{vol.goal}</Text>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          ))}
        </Stack>
      );
    }

    // 3. 扩写当前节点预览
    if (previewData.expandedData) {
      const d = previewData.expandedData;
      return (
        <Paper p="16px 20px" bg="#f8fafc" bd="1px solid #e2e8f0" radius="md">
          <Text fz={15} fw={700} c="#1e293b" mb={12}>
            节点细化扩写方案：《{d.title}》
          </Text>
          <Stack gap="10px">
            <Box>
              <Text fz={12} fw={600} c="#64748b">🎯 细化故事目标</Text>
              <Text fz={13} c="#1e293b">{d.goal}</Text>
            </Box>
            <Box>
              <Text fz={12} fw={600} c="#64748b">⚡ 核心冲突深化</Text>
              <Text fz={13} c="#1e293b">{d.conflict}</Text>
            </Box>
            <Box>
              <Text fz={12} fw={600} c="#64748b">📖 事件发生描述</Text>
              <Text fz={13} c="#1e293b">{d.eventDescription}</Text>
            </Box>
            <Box>
              <Text fz={12} fw={600} c="#64748b">🌱 埋设与回收伏笔</Text>
              <Text fz={13} c="#0891b2">{d.foreshadowing}</Text>
            </Box>
            <Box>
              <Text fz={12} fw={600} c="#64748b">🎁 结局状态变化</Text>
              <Text fz={13} c="#1e293b">{d.expectedOutcome}</Text>
            </Box>
          </Stack>
        </Paper>
      );
    }

    // 4. 大纲诊断报告预览
    if (previewData.diagnosis) {
      const dg = previewData.diagnosis;
      return (
        <Paper p="18px 22px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
          <Flex justify="space-between" align="center" mb={14}>
            <Text fz={16} fw={700} c="#1e293b">{dg.title}</Text>
            <Badge size="lg" color={dg.score >= 80 ? "green" : "orange"} variant="light">
              综合评分：{dg.score} 分
            </Badge>
          </Flex>

          <Box mb={14}>
            <Text fz={13} fw={700} c="#16a34a" mb={6}>✅ 故事架构亮点：</Text>
            {dg.pros.map((p, idx) => (
              <Text key={idx} fz={12} c="#475569" mb={2}>• {p}</Text>
            ))}
          </Box>

          <Box>
            <Text fz={13} fw={700} c="#d97706" mb={6}>💡 AI 改进建议与优化空间：</Text>
            {dg.suggestions.map((s, idx) => (
              <Text key={idx} fz={12} c="#475569" mb={2}>• {s}</Text>
            ))}
          </Box>
        </Paper>
      );
    }

    // 5. 替代剧情方案预览
    if (previewData.alternatives && previewData.alternatives.length > 0) {
      return (
        <Stack gap="12px">
          {previewData.alternatives.map((alt, idx) => (
            <Paper key={idx} p="14px 18px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
              <Text fz={14} fw={700} c="#1e293b" mb={6}>{alt.name}</Text>
              <Text fz={13} c="#475569" mb={8}>{alt.description}</Text>
              <Flex gap={12}>
                <Badge size="xs" color="teal" variant="light">优势：{alt.advantage}</Badge>
                <Badge size="xs" color="orange" variant="light">注意：{alt.risk}</Badge>
              </Flex>
            </Paper>
          ))}
        </Stack>
      );
    }

    return null;
  };

  const hasSelection =
    (previewData.splitScenes && previewData.splitScenes.length > 0) ||
    (previewData.generatedTree && previewData.generatedTree.length > 0);

  const isDiagnosisOnly = !!previewData.diagnosis || !!previewData.alternatives;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <Text fw={700} fz={16}>
            AI 推演结果安全预览与采纳
          </Text>
          <Badge color="violet" variant="light">
            预览态·数据未覆盖
          </Badge>
        </Flex>
      }
      centered
      size="lg"
      radius="md"
    >
      <Stack gap="14px">
        <Box p="10px 14px" bg="#f1f5f9" style={{ borderRadius: 6 }}>
          <Flex align="center" gap={6} c="#475569" fz={12}>
            <FiInfo size={14} color="#00c9ff" />
            <span>{previewData.summary}</span>
          </Flex>
        </Box>

        <ScrollArea.Autosize mah={440}>
          {renderContent()}
        </ScrollArea.Autosize>

        <Divider my="sm" />

        <Flex justify="flex-end" gap={10}>
          <Button variant="outline" color="gray" onClick={onClose} disabled={loading}>
            <FiX size={14} style={{ marginRight: 4 }} />
            放弃修改 (拒绝)
          </Button>

          {hasSelection && (
            <Button
              variant="light"
              color="teal"
              disabled={selectedIds.length === 0 || loading}
              loading={loading}
              onClick={handleConfirmSelected}
            >
              部分采纳所选 ({selectedIds.length})
            </Button>
          )}

          {!isDiagnosisOnly && (
            <Button
              color="violet"
              loading={loading}
              onClick={handleConfirmAll}
            >
              <FiCheck size={14} style={{ marginRight: 4 }} />
              全部采纳写入大纲
            </Button>
          )}
        </Flex>
      </Stack>
    </Modal>
  );
}
