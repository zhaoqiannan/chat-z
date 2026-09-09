// 组件：素材智能摘要与设定弹窗（60vw 居中浮层，AI 提炼、硬核设定点与大模型上下文注入）
"use client";

import React, { useState, useEffect } from "react";
import { Modal, Box, Flex, Text, Button, Badge, ActionIcon, TextInput, Textarea, Switch, Stack, Paper, Group, Tooltip } from "@mantine/core";
import { FiZap, FiRefreshCw, FiSave, FiTag, FiSliders, FiLink } from "react-icons/fi";
import { MaterialData, updateMaterial, extractMaterialAiSummary } from "@/rest/project-extensions";

interface ModalMaterialSummaryProps {
  opened: boolean;
  material: MaterialData | null;
  onClose: () => void;
  onUpdateSuccess: (updated: MaterialData) => void;
}

export default function ModalMaterialSummary({
  opened,
  material,
  onClose,
  onUpdateSuccess,
}: ModalMaterialSummaryProps) {
  const [aiSummary, setAiSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [extractedLore, setExtractedLore] = useState("");
  const [includeInAi, setIncludeInAi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);

  useEffect(() => {
    if (material) {
      setAiSummary(material.aiSummary || "");
      setSourceUrl(material.sourceUrl || "");
      setTags(material.tags || "");
      setExtractedLore(material.extractedLore || "");
      setIncludeInAi(material.includeInAiContext !== 0 && material.includeInAiContext !== false);
    }
  }, [material]);

  if (!material) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await updateMaterial({
        id: material.id,
        aiSummary,
        sourceUrl,
        tags,
        extractedLore,
        includeInAiContext: includeInAi ? 1 : 0,
      });

      if (res && res.success) {
        onUpdateSuccess({
          ...material,
          aiSummary,
          sourceUrl,
          tags,
          extractedLore,
          includeInAiContext: includeInAi ? 1 : 0,
          updatedAt: new Date().toISOString(),
        });
        onClose();
      }
    } catch (e: any) {
      alert("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleAiAutoSummary = async () => {
    try {
      setAiExtracting(true);
      const res = await extractMaterialAiSummary({
        title: material.title,
        content: material.content || extractedLore || "",
        sourceUrl: sourceUrl || material.sourceUrl || "",
      });

      if (res && res.success && res.result) {
        if (res.result.aiSummary) setAiSummary(res.result.aiSummary);
        if (res.result.extractedLore) setExtractedLore(res.result.extractedLore);
        if (Array.isArray(res.result.suggestedTags) && res.result.suggestedTags.length > 0) {
          const existing = tags ? tags.split(/[,，\s]+/).filter(Boolean) : [];
          const combinedTags = Array.from(new Set([...existing, ...res.result.suggestedTags])).join(", ");
          setTags(combinedTags);
        }
      }
    } catch (e: any) {
      alert("AI 提取摘要异常: " + (e?.message || "网络错误"));
    } finally {
      setAiExtracting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={8}>
          <FiZap size={18} color="#0284c7" />
          <Text fw={700} fz={16} c="#0f172a">
            素材智能摘要与设定管理 — {material.title}
          </Text>
        </Group>
      }
      size="60vw"
      centered
      radius="md"
      styles={{
        content: {
          maxWidth: "1000px",
          minWidth: "360px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        },
        header: {
          borderBottom: "1px solid #f1f5f9",
          padding: "16px 24px",
        },
        body: {
          padding: "20px 24px",
          overflowY: "auto",
          flex: 1,
        },
      }}
    >
      <Stack gap="md">
        {/* AI 智能摘要卡片 */}
        <Paper p="md" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
          <Flex justify="space-between" align="center" mb={8}>
            <Group gap={6}>
              <FiZap size={15} color="#0284c7" />
              <Text fz={13.5} fw={700} c="#0284c7">AI 智能提炼摘要</Text>
            </Group>
            <Button
              size="xs"
              variant="filled"
              color="blue"
              leftSection={<FiRefreshCw size={12} />}
              loading={aiExtracting}
              onClick={handleAiAutoSummary}
            >
              {aiSummary ? "重新提炼摘要" : "一键生成智能摘要"}
            </Button>
          </Flex>
          <Textarea
            variant="unstyled"
            autosize
            minRows={3}
            placeholder="点击右上角「一键生成智能摘要」，AI 将自动分析素材正文提炼核心要点..."
            value={aiSummary}
            onChange={(e) => setAiSummary(e.target.value)}
            styles={{
              input: {
                fontSize: 13,
                color: "#0369a1",
                lineHeight: 1.6,
                padding: "8px 12px",
                backgroundColor: "#ffffff",
                borderRadius: 6,
                border: "1px solid #e0f2fe",
              },
            }}
          />
        </Paper>

        {/* 提取的硬核设定 */}
        <Box>
          <Text fz={12.5} fw={600} c="#475569" mb={4}>提取的硬核设定 / 核心机制要点</Text>
          <Textarea
            size="xs"
            autosize
            minRows={4}
            placeholder="● 分条列出提炼的硬核机制、关键数据与剧情结合点..."
            value={extractedLore}
            onChange={(e) => setExtractedLore(e.target.value)}
          />
        </Box>

        {/* 标签管理 */}
        <Box>
          <Group gap={6} mb={4}>
            <FiTag size={13} color="#64748b" />
            <Text fz={12.5} fw={600} c="#475569">标签管理</Text>
          </Group>
          <TextInput
            size="xs"
            placeholder="逗号或空格隔开，如：天文学, 货币体系, 设定参考"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          {tags && (
            <Group gap={4} mt={6} wrap="wrap">
              {tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
                <Badge key={idx} size="sm" variant="light" color="blue">
                  {t}
                </Badge>
              ))}
            </Group>
          )}
        </Box>

        {/* 物理来源 / 原始链接 */}
        <Box>
          <Group gap={6} mb={4}>
            <FiLink size={13} color="#64748b" />
            <Text fz={12.5} fw={600} c="#475569">物理来源 / 原始链接</Text>
          </Group>
          <TextInput
            size="xs"
            placeholder="https://..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            rightSection={
              sourceUrl ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="blue"
                  onClick={() => window.open(sourceUrl, "_blank")}
                  title="在新标签页打开"
                >
                  <FiLink size={12} />
                </ActionIcon>
              ) : null
            }
          />
        </Box>

        {/* 大模型上下文注入 */}
        <Paper p="sm" bg="#fafbfc" withBorder radius="md" style={{ borderColor: "#e2e8f0" }}>
          <Flex justify="space-between" align="center">
            <Group gap={8}>
              <Box style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: includeInAi ? "#0284c7" : "#94a3b8" }} />
              <Box>
                <Text fz={13} fw={600} c="#1e293b">加入 AI 写作大模型上下文</Text>
                <Text fz={11} c="#94a3b8">开启后，在章节协同创作时 AI 将自动参考此素材设定的提炼内容</Text>
              </Box>
            </Group>
            <Switch
              size="sm"
              checked={includeInAi}
              onChange={(e) => setIncludeInAi(e.currentTarget.checked)}
            />
          </Flex>
        </Paper>

        <Flex justify="flex-end" gap="xs" mt="sm" pt={12} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={onClose}>
            取消
          </Button>
          <Button size="xs" leftSection={<FiSave size={12} />} loading={saving} onClick={handleSave}>
            保存更改
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
