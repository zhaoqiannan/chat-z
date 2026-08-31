"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { FiCheck, FiX, FiInfo } from "react-icons/fi";
import { CreateOutlinePayload } from "@/rest/outline";

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
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 格式化带唯一 key 的 splitScenes
  const normalizedSplitScenes = useMemo(() => {
    if (!previewData?.splitScenes || !Array.isArray(previewData.splitScenes)) return [];
    return previewData.splitScenes.map((scene, idx) => ({
      ...scene,
      _previewKey: scene.id ? String(scene.id) : `split_scene_${idx}_${scene.title || ""}`,
    }));
  }, [previewData?.splitScenes]);

  // 格式化带唯一 key 的 generatedTree
  const normalizedGeneratedTree = useMemo(() => {
    if (!previewData?.generatedTree || !Array.isArray(previewData.generatedTree)) return [];
    return previewData.generatedTree.map((vol, vIdx) => ({
      ...vol,
      _previewKey: vol.id ? String(vol.id) : `vol_${vIdx}_${vol.title || ""}`,
      children: (vol.children || []).map((scene: any, sIdx: number) => ({
        ...scene,
        _previewKey: scene.id ? String(scene.id) : `scene_${vIdx}_${sIdx}_${scene.title || ""}`,
      })),
    }));
  }, [previewData?.generatedTree]);

  useEffect(() => {
    if (opened && previewData) {
      if (normalizedSplitScenes.length > 0) {
        setSelectedKeys(normalizedSplitScenes.map((s) => s._previewKey));
      } else if (normalizedGeneratedTree.length > 0) {
        const allKeys: string[] = [];
        normalizedGeneratedTree.forEach((vol) => {
          allKeys.push(vol._previewKey);
          (vol.children || []).forEach((c: any) => allKeys.push(c._previewKey));
        });
        setSelectedKeys(allKeys);
      } else {
        setSelectedKeys([]);
      }
    }
  }, [opened, previewData, normalizedSplitScenes, normalizedGeneratedTree]);

  if (!previewData) return null;

  const handleToggleSelect = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
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
      if (normalizedSplitScenes.length > 0) {
        itemsToApply = normalizedSplitScenes.filter((s) => selectedKeys.includes(s._previewKey));
      } else if (normalizedGeneratedTree.length > 0) {
        itemsToApply = normalizedGeneratedTree
          .filter((vol) => selectedKeys.includes(vol._previewKey))
          .map((vol) => ({
            ...vol,
            children: (vol.children || []).filter((c: any) => selectedKeys.includes(c._previewKey)),
          }));
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
    if (normalizedSplitScenes.length > 0) {
      return (
        <Stack gap="12px">
          <Text fz={13} c="#64748b">
            以下为 AI 拆解出的紧凑情节点，您可以勾选需要保留的节点后点击“部分采纳”或“全部采纳”：
          </Text>
          {normalizedSplitScenes.map((scene, idx) => {
            const isChecked = selectedKeys.includes(scene._previewKey);
            return (
              <Paper
                key={scene._previewKey}
                p="12px 16px"
                bg={isChecked ? "#f0fdf4" : "#ffffff"}
                bd={isChecked ? "1px solid #86efac" : "1px solid #e2e8f0"}
                radius="md"
              >
                <Flex align="flex-start" gap={12}>
                  <Checkbox
                    checked={isChecked}
                    onChange={() => handleToggleSelect(scene._previewKey)}
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
                        {idx + 1}. {scene.title}
                      </Text>
                    </Flex>
                    <Text fz={12} c="#475569" mb={2}>
                      <b>目标：</b>{scene.goal}
                    </Text>
                    {scene.eventDescription && (
                      <Text fz={12} c="#64748b">
                        <b>事件脉络：</b>{scene.eventDescription}
                      </Text>
                    )}
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
    if (normalizedGeneratedTree.length > 0) {
      return (
        <Stack gap="12px">
          <Text fz={13} c="#64748b">
            以下为 AI 构建的完整故事大纲骨架（含分卷与情节点）：
          </Text>
          {normalizedGeneratedTree.map((vol, vIdx) => {
            const isVolChecked = selectedKeys.includes(vol._previewKey);
            return (
              <Paper key={vol._previewKey} p="14px 18px" bg="#f8fafc" bd="1px solid #e2e8f0" radius="md">
                <Flex align="flex-start" gap={10} mb={6}>
                  <Checkbox
                    checked={isVolChecked}
                    onChange={() => handleToggleSelect(vol._previewKey)}
                    mt={3}
                  />
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap={8} mb={4}>
                      <Badge color="indigo" variant="filled" size="sm">
                        分卷 #{vIdx + 1}
                      </Badge>
                      <Text fz={15} fw={700} c="#1e293b">
                        {vol.title}
                      </Text>
                    </Flex>
                    <Text fz={13} c="#475569" mb={10}>
                      <b>本卷总目标：</b>{vol.goal}
                    </Text>
                    {vol.conflict && (
                      <Text fz={12} c="#64748b" mb={10}>
                        <b>主要冲突：</b>{vol.conflict}
                      </Text>
                    )}

                    {vol.children && vol.children.length > 0 && (
                      <Stack gap="8px" pl={12} style={{ borderLeft: "2px solid #cbd5e1" }}>
                        {vol.children.map((scene: any, sIdx: number) => {
                          const isSceneChecked = selectedKeys.includes(scene._previewKey);
                          return (
                            <Box
                              key={scene._previewKey}
                              p="8px 12px"
                              bg={isSceneChecked ? "#ffffff" : "#f1f5f9"}
                              bd={isSceneChecked ? "1px solid #cbd5e1" : "1px dashed #cbd5e1"}
                              style={{ borderRadius: 6 }}
                            >
                              <Flex align="flex-start" gap={8}>
                                <Checkbox
                                  size="xs"
                                  checked={isSceneChecked}
                                  onChange={() => handleToggleSelect(scene._previewKey)}
                                  mt={2}
                                />
                                <Box style={{ flex: 1 }}>
                                  <Flex align="center" gap={6} mb={2}>
                                    <Badge size="xs" color="teal">情节点 {sIdx + 1}</Badge>
                                    <Text fz={13} fw={600} c="#1e293b">{scene.title}</Text>
                                  </Flex>
                                  <Text fz={12} c="#64748b">{scene.goal}</Text>
                                  {scene.eventDescription && (
                                    <Text fz={11} c="#94a3b8" mt={2}>{scene.eventDescription}</Text>
                                  )}
                                </Box>
                              </Flex>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>
                </Flex>
              </Paper>
            );
          })}
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
            {d.conflict && (
              <Box>
                <Text fz={12} fw={600} c="#64748b">⚡ 核心冲突深化</Text>
                <Text fz={13} c="#1e293b">{d.conflict}</Text>
              </Box>
            )}
            {d.eventDescription && (
              <Box>
                <Text fz={12} fw={600} c="#64748b">📖 事件发生描述</Text>
                <Text fz={13} c="#1e293b">{d.eventDescription}</Text>
              </Box>
            )}
            {d.foreshadowing && (
              <Box>
                <Text fz={12} fw={600} c="#64748b">🌱 埋设与回收伏笔</Text>
                <Text fz={13} c="#0891b2">{d.foreshadowing}</Text>
              </Box>
            )}
            {d.expectedOutcome && (
              <Box>
                <Text fz={12} fw={600} c="#64748b">🎁 结局状态变化</Text>
                <Text fz={13} c="#1e293b">{d.expectedOutcome}</Text>
              </Box>
            )}
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
            {(dg.pros || []).map((p, idx) => (
              <Text key={`pro_${idx}`} fz={12} c="#475569" mb={2}>• {p}</Text>
            ))}
          </Box>

          <Box>
            <Text fz={13} fw={700} c="#d97706" mb={6}>💡 AI 改进建议与优化空间：</Text>
            {(dg.suggestions || []).map((s, idx) => (
              <Text key={`sug_${idx}`} fz={12} c="#475569" mb={2}>• {s}</Text>
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
            <Paper key={`alt_${idx}`} p="14px 18px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
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

  const hasSelection = normalizedSplitScenes.length > 0 || normalizedGeneratedTree.length > 0;
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
              disabled={selectedKeys.length === 0 || loading}
              loading={loading}
              onClick={handleConfirmSelected}
            >
              部分采纳所选 ({selectedKeys.length})
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
