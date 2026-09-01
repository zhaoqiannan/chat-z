// 组件：素材详情沉浸侧栏（AI 智能摘要、物理来源、硬核设定提炼与大模型上下文注入 Switch 开关）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, TextInput, Textarea, Switch, Stack, ScrollArea, Paper, Group, Tooltip } from "@mantine/core";
import { FiFileText, FiImage, FiBarChart2, FiMusic, FiVideo, FiLink, FiX, FiRefreshCw, FiSave, FiZap } from "react-icons/fi";
import { MaterialData, updateMaterial, extractMaterialAiSummary } from "@/rest/project-extensions";

interface PanelMaterialDetailProps {
  material: MaterialData;
  onClose: () => void;
  onUpdateSuccess: (updated: MaterialData) => void;
}

export default function PanelMaterialDetail({
  material,
  onClose,
  onUpdateSuccess,
}: PanelMaterialDetailProps) {
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
  }, [material?.id]);

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
          const combinedTags = Array.from(new Set([...tags.split(/[,，\s]+/).filter(Boolean), ...res.result.suggestedTags])).join(", ");
          setTags(combinedTags);
        }
      }
    } catch (e: any) {
      alert("AI 提取摘要异常: " + (e?.message || "网络错误"));
    } finally {
      setAiExtracting(false);
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <FiImage size={24} color="#10b981" />;
      case "data":
        return <FiBarChart2 size={24} color="#f59e0b" />;
      case "audio":
        return <FiMusic size={24} color="#8b5cf6" />;
      case "video":
        return <FiVideo size={24} color="#ec4899" />;
      case "link":
        return <FiLink size={24} color="#06b6d4" />;
      default:
        return <FiFileText size={24} color="#64748b" />;
    }
  };

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case "image":
        return "图片";
      case "data":
        return "数据";
      case "audio":
        return "音频";
      case "video":
        return "视频";
      case "link":
        return "链接";
      default:
        return "文档";
    }
  };

  return (
    <Box
      style={{
        width: 380,
        minWidth: 340,
        borderLeft: "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
      }}
    >
      <Flex justify="space-between" align="center" px="md" py={14} style={{ borderBottom: "1px solid #f8fafc" }}>
        <Group gap={6}>
          <FiFileText size={15} color="#0284c7" />
          <Text fz={14} fw={700} c="#1e293b">素材详情</Text>
        </Group>
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={onClose}>
          <FiX size={14} />
        </ActionIcon>
      </Flex>

      <ScrollArea style={{ flex: 1 }} p="md">
        <Stack gap="md">
          <Paper p="md" bg="#f8fafc" withBorder radius="md" style={{ borderColor: "#e2e8f0", textAlign: "center" }}>
            <Box mb={6}>
              {getFileTypeIcon(material.fileType)}
            </Box>
            <Text fz={13.5} fw={700} c="#1e293b">{material.title}</Text>
            <Text fz={11} c="#94a3b8" mt={2}>
              {getFileTypeLabel(material.fileType)} {material.fileSize ? `(${material.fileSize})` : ""}
            </Text>
          </Paper>

          <Paper p="md" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
            <Flex justify="space-between" align="center" mb={6}>
              <Group gap={4}>
                <FiZap size={13} color="#0284c7" />
                <Text fz={12} fw={700} c="#0284c7">AI 智能摘要</Text>
              </Group>
              <Tooltip label="调用 AI 重新解析与提炼" position="top">
                <ActionIcon size="xs" variant="subtle" color="cyan" loading={aiExtracting} onClick={handleAiAutoSummary}>
                  <FiRefreshCw size={11} />
                </ActionIcon>
              </Tooltip>
            </Flex>
            <Textarea
              variant="unstyled"
              autosize
              minRows={3}
              placeholder="点击右上角刷新图标可由 AI 自动生成智能摘要..."
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              styles={{
                input: {
                  fontSize: 12,
                  color: "#0369a1",
                  lineHeight: 1.6,
                  padding: 0,
                },
              }}
            />
          </Paper>

          <Box>
            <Text fz={11.5} fw={600} c="#64748b" mb={4}>物理来源 / 原始链接</Text>
            <TextInput
              size="xs"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </Box>

          <Box>
            <Text fz={11.5} fw={600} c="#64748b" mb={4}>标签管理</Text>
            <TextInput
              size="xs"
              placeholder="逗号或空格隔开，如：天文学, 星际科学, 参考资料"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            {tags && (
              <Group gap={4} mt={6} wrap="wrap">
                {tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
                  <Badge key={idx} size="xs" variant="outline" color="gray">
                    {t}
                  </Badge>
                ))}
              </Group>
            )}
          </Box>

          <Box>
            <Text fz={11.5} fw={600} c="#64748b" mb={4}>提取的硬核设定</Text>
            <Textarea
              size="xs"
              autosize
              minRows={3}
              placeholder="● 分条列出提炼的硬核机制、关键数据与剧情结合点..."
              value={extractedLore}
              onChange={(e) => setExtractedLore(e.target.value)}
            />
          </Box>

          <Paper p="xs" bg="#fafbfc" withBorder radius="md">
            <Flex justify="space-between" align="center">
              <Group gap={6}>
                <Box style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: includeInAi ? "#0284c7" : "#94a3b8" }} />
                <Text fz={12} fw={600} c="#334155">加入 AI 写作大模型上下文</Text>
              </Group>
              <Switch
                size="xs"
                color="cyan"
                checked={includeInAi}
                onChange={(e) => setIncludeInAi(e.currentTarget.checked)}
              />
            </Flex>
          </Paper>
        </Stack>
      </ScrollArea>

      <Flex justify="flex-end" gap="xs" px="md" py={12} style={{ borderTop: "1px solid #f1f5f9", backgroundColor: "#fafbfc" }}>
        <Button size="xs" variant="default" onClick={onClose}>
          关闭
        </Button>
        <Button size="xs" color="cyan" leftSection={<FiSave size={12} />} loading={saving} onClick={handleSave}>
          保存更改
        </Button>
      </Flex>
    </Box>
  );
}
