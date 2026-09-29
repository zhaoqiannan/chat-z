// 组件：素材智能提炼与设定管理弹窗（支持自定义指令再次提炼、采纳写入笔记、独立链接查阅与上下文管理）
"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Box,
  Flex,
  Text,
  Button,
  Badge,
  ActionIcon,
  TextInput,
  Textarea,
  Switch,
  Stack,
  Paper,
  Group,
  Tooltip,
} from "@mantine/core";
import {
  FiZap,
  FiRefreshCw,
  FiSave,
  FiTag,
  FiSliders,
  FiLink,
  FiExternalLink,
  FiCornerDownLeft,
  FiCheckCircle,
} from "react-icons/fi";
import { BsPinAngle, BsPinFill } from "react-icons/bs";
import { useAlert } from "@/hooks/useAlert";
import { MaterialData, updateMaterial, extractMaterialAiSummary } from "@/rest/project-extensions";

interface ModalMaterialSummaryProps {
  opened: boolean;
  material: MaterialData | null;
  onClose: () => void;
  onUpdateSuccess: (updated: MaterialData) => void;
}

const PROMPT_PRESETS = [
  { label: "🖼️ 描述图片细节与服饰", prompt: "请详细描述该图片中的视觉元素、角色外貌、服饰特征与场景氛围，提炼小说描写词句。" },
  { label: "📜 提炼世界观与核心设定", prompt: "请深入分析该资料，提炼核心的世界观法则、力量机制或科学原理，分条清晰列出。" },
  { label: "💡 总结核心论点与剧情启发", prompt: "请对该素材进行精炼总结，说明核心用处，并给出 3 条可结合到小说剧情冲突中的具体灵感。" },
  { label: "🔍 提取硬核数据与专有名词", prompt: "请提取出现的专有名词、硬核参数数值、时间线索及关键术语。" },
];

export default function ModalMaterialSummary({
  opened,
  material,
  onClose,
  onUpdateSuccess,
}: ModalMaterialSummaryProps) {
  const [aiSummary, setAiSummary] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [extractedLore, setExtractedLore] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [includeInAi, setIncludeInAi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);

  useEffect(() => {
    if (material) {
      setAiSummary(material.aiSummary || "");
      setCustomPrompt(material.aiPrompt || "");
      setSourceUrl(material.sourceUrl || "");
      setTags(material.tags || "");
      setExtractedLore(material.extractedLore || "");
      setIsPinned(material.isPinned === 1 || material.isPinned === true);
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
        aiPrompt: customPrompt.trim() || undefined,
        sourceUrl,
        tags,
        extractedLore,
        isPinned: isPinned ? 1 : 0,
        includeInAiContext: includeInAi ? 1 : 0,
      });

      if (res && res.success) {
        onUpdateSuccess({
          ...material,
          aiSummary,
          aiPrompt: customPrompt.trim() || undefined,
          sourceUrl,
          tags,
          extractedLore,
          isPinned: isPinned ? 1 : 0,
          includeInAiContext: includeInAi ? 1 : 0,
          updatedAt: new Date().toISOString(),
        });
        useAlert.success("素材设定与智能提炼已成功保存");
        onClose();
      }
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleAiAutoSummary = async () => {
    try {
      setAiExtracting(true);
      const res = await extractMaterialAiSummary({
        title: material.title,
        fileName: material.fileName || undefined,
        fileType: material.fileType || undefined,
        fileUrl: material.fileUrl || undefined,
        content: material.content || extractedLore || "",
        customPrompt: customPrompt.trim(),
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
        useAlert.success("AI 智能提炼完成！");
      }
    } catch (e: any) {
      useAlert.error("AI 提炼异常: " + (e?.message || "网络错误"));
    } finally {
      setAiExtracting(false);
    }
  };

  const handleAdoptToNote = async () => {
    const textToInsert = extractedLore || aiSummary;
    if (!textToInsert) {
      useAlert.warning("暂无 AI 提炼结果可供采纳");
      return;
    }

    const formattedHtml = textToInsert
      .split(/\r?\n\r?\n/)
      .map((para) => `<p>${para.replace(/\r?\n/g, "<br>")}</p>`)
      .join("");

    const prevNote = material.content || "";
    const nextNote = prevNote.trim()
      ? `${prevNote}<br><hr><p><strong>【AI 提炼采纳】：</strong></p>${formattedHtml}`
      : formattedHtml;

    try {
      setSaving(true);
      const res = await updateMaterial({
        id: material.id,
        content: nextNote,
        aiSummary,
        aiPrompt: customPrompt.trim() || undefined,
        extractedLore,
      });
      if (res && res.success) {
        onUpdateSuccess({
          ...material,
          content: nextNote,
          aiSummary,
          aiPrompt: customPrompt.trim() || undefined,
          extractedLore,
          updatedAt: new Date().toISOString(),
        });
        useAlert.success("已将 AI 提炼内容采纳并追加保存至素材笔记！");
      }
    } catch (e: any) {
      useAlert.error("采纳保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
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
            素材智能提炼与设定管理 — {material.title}
          </Text>
        </Group>
      }
      size="65vw"
      centered
      radius="md"
      styles={{
        content: {
          maxWidth: "1080px",
          minWidth: "360px",
          maxHeight: "92vh",
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
        {/* 文件信息与外部独立打开栏 */}
        {(material.fileUrl || material.sourceUrl) && (
          <Paper p="sm" bg="#f8fafc" withBorder radius="md" style={{ borderColor: "#e2e8f0" }}>
            <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap={8}>
                <Badge size="sm" color="blue" variant="light">
                  {material.fileType || "document"}
                </Badge>
                <Text fz={13} fw={600} c="#334155">
                  关联附件源：{material.fileName || material.title}
                </Text>
                {material.fileSize && (
                  <Text fz={11} c="#94a3b8">
                    ({material.fileSize})
                  </Text>
                )}
              </Group>
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<FiExternalLink size={13} />}
                onClick={() =>
                  window.open(material.fileUrl || material.sourceUrl || "", "_blank", "noopener,noreferrer")
                }
              >
                在新标签页单独查看文件 ↗
              </Button>
            </Flex>
          </Paper>
        )}

        {/* AI 智能提炼模块（含自定义指令与预设） */}
        <Paper p="md" bg="#faf5ff" withBorder radius="md" style={{ borderColor: "#e9d5ff" }}>
          <Flex justify="space-between" align="center" mb={8}>
            <Group gap={6}>
              <FiZap size={16} color="#9333ea" />
              <Text fz={13.5} fw={700} c="#7e22ce">
                AI 结合文件与自定义指令提炼
              </Text>
            </Group>
            <Button
              size="xs"
              variant="filled"
              color="grape"
              leftSection={<FiRefreshCw size={12} />}
              loading={aiExtracting}
              onClick={handleAiAutoSummary}
            >
              {aiSummary ? "重新结合指令提炼" : "一键开始 AI 提炼"}
            </Button>
          </Flex>

          {/* 预设指令标签 */}
          <Group gap={6} mb={8} wrap="wrap">
            {PROMPT_PRESETS.map((preset, idx) => (
              <Button
                key={idx}
                size="compact-xs"
                variant="light"
                color="grape"
                onClick={() => setCustomPrompt(preset.prompt)}
                style={{ fontSize: 11.5 }}
              >
                {preset.label}
              </Button>
            ))}
          </Group>

          <Textarea
            size="xs"
            minRows={2}
            autosize
            placeholder="输入您的自定义分析指令（例如：请帮我提取该文档中的关键硬核数据，或描述人物外貌特征）..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            styles={{
              input: {
                backgroundColor: "#ffffff",
                borderColor: "#d8b4fe",
                fontSize: 12.5,
                color: "#581c87",
              },
            }}
          />
        </Paper>

        {/* AI 智能摘要卡片 */}
        <Paper p="md" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
          <Flex justify="space-between" align="center" mb={6}>
            <Text fz={13} fw={700} c="#0284c7">
              AI 智能提炼摘要（用途说明）
            </Text>
          </Flex>
          <Textarea
            variant="unstyled"
            autosize
            minRows={2}
            placeholder="AI 提炼的简明摘要与用途说明..."
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

        {/* 提取的硬核设定 / 描述结果 */}
        <Box>
          <Flex justify="space-between" align="center" mb={4}>
            <Text fz={12.5} fw={600} c="#475569">
              提取的要点 / 设定描述与分析结果
            </Text>
            {extractedLore && (
              <Button
                size="compact-xs"
                variant="light"
                color="blue"
                leftSection={<FiCornerDownLeft size={12} />}
                loading={saving}
                onClick={handleAdoptToNote}
              >
                追加至素材笔记
              </Button>
            )}
          </Flex>
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
            <Text fz={12.5} fw={600} c="#475569">
              标签管理
            </Text>
          </Group>
          <TextInput
            size="xs"
            placeholder="逗号或空格隔开，如：天文学, 科技, 设定参考"
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

        {/* 原始链接与开关设置 */}
        <Paper p="sm" bg="#fafbfc" withBorder radius="md" style={{ borderColor: "#e2e8f0" }}>
          <Flex justify="space-between" align="center" wrap="wrap" gap="md">
            <Flex align="center" gap="xl">
              <Switch
                label="📌 置顶此素材"
                size="xs"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.currentTarget.checked)}
              />
              <Switch
                label="🤖 加入 AI 写作大模型上下文"
                size="xs"
                checked={includeInAi}
                onChange={(e) => setIncludeInAi(e.currentTarget.checked)}
              />
            </Flex>
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
