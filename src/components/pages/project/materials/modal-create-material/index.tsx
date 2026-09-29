// 组件：新建素材与文件智能提炼弹窗（文件上传与独立查阅、AI自定义指令提炼、独立素材笔记编辑器）
"use client";

import React, { useState, useRef } from "react";
import {
  Flex,
  Text,
  Button,
  Modal,
  TextInput,
  Select,
  Stack,
  Group,
  SimpleGrid,
  Paper,
  Box,
  Textarea,
  Badge,
  Switch,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  FiUploadCloud,
  FiFileText,
  FiLink,
  FiTag,
  FiCheckCircle,
  FiZap,
  FiExternalLink,
  FiCornerDownLeft,
  FiImage,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { BsPinAngle, BsPinFill } from "react-icons/bs";
import { useAlert } from "@/hooks/useAlert";
import { MaterialData, createMaterial, updateMaterial, extractMaterialAiSummary } from "@/rest/project-extensions";
import { uploadImageFile } from "@/rest/world";
import { RichTextEditor } from "@/components/common/rich-text";

interface ModalCreateMaterialProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  initialData?: MaterialData | null;
  onSuccess: (material: MaterialData) => void;
}

const PROMPT_PRESETS = [
  { label: "🖼️ 描绘图片意境与细节", prompt: "请根据此素材主题，构思并描述画面中的角色外貌、服饰特征、环境光影与氛围，提炼适合小说的生动描写词句。" },
  { label: "📜 提炼世界观与核心设定", prompt: "请深入分析该资料，提炼出其中的世界观设定、核心运行法则、力量体系或科技机制，分条清晰列出。" },
  { label: "💡 总结核心论点与剧情启发", prompt: "请对该文件进行精炼总结，阐明主要论点与核心用处，并给出 3 条可结合到小说剧情冲突中的具体创作灵感。" },
  { label: "🔍 提取硬核数据与专有名词", prompt: "请提取文件中出现的专有名词、硬核数值指标、历史事件线索及关键术语，保持严谨与准确。" },
];

export default function ModalCreateMaterial({
  opened,
  onClose,
  workId,
  initialData,
  onSuccess,
}: ModalCreateMaterialProps) {
  const [title, setTitle] = useState("");
  const [fileType, setFileType] = useState("document");
  const [content, setContent] = useState(""); // 素材笔记（作者自己提炼的心得与重点）
  const [rawFileText, setRawFileText] = useState(""); // 原始文件解析文本（仅供AI分析，安全截断）
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [includeInAi, setIncludeInAi] = useState(true);

  // AI 提取相关状态
  const [aiSectionOpened, setAiSectionOpened] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [extractedLore, setExtractedLore] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setFileType("document");
    setContent("");
    setRawFileText("");
    setSourceUrl("");
    setTags("");
    setFileName("");
    setFileSize("");
    setFileUrl("");
    setIsPinned(false);
    setIncludeInAi(true);
    setCustomPrompt("");
    setAiSummary("");
    setExtractedLore("");
  };

  React.useEffect(() => {
    if (opened) {
      if (initialData) {
        setTitle(initialData.title || "");
        setFileType(initialData.fileType || "document");
        setContent(initialData.content || "");
        setRawFileText("");
        setSourceUrl(initialData.sourceUrl || "");
        setTags(initialData.tags || "");
        setFileName(initialData.fileName || "");
        setFileSize(initialData.fileSize || "");
        setFileUrl(initialData.fileUrl || "");
        setIsPinned(initialData.isPinned === 1 || initialData.isPinned === true);
        setIncludeInAi(initialData.includeInAiContext !== 0 && initialData.includeInAiContext !== false);
        setCustomPrompt(initialData.aiPrompt || "");
        setAiSummary(initialData.aiSummary || "");
        setExtractedLore(initialData.extractedLore || "");
      } else {
        resetForm();
      }
    }
  }, [initialData, opened]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      if (!title.trim()) {
        setTitle(nameWithoutExt);
      }
      setFileName(file.name);

      let detectedType = "document";
      if (file.type.startsWith("image/")) detectedType = "image";
      else if (file.type.startsWith("audio/")) detectedType = "audio";
      else if (file.type.startsWith("video/")) detectedType = "video";
      setFileType(detectedType);

      // 上传到服务端并获取持久化的 URL /api/files/[id]
      const uploadRes = await uploadImageFile(file);
      if (uploadRes && uploadRes.success && uploadRes.url) {
        setFileUrl(uploadRes.url);
        if (uploadRes.fileSize) setFileSize(uploadRes.fileSize);
        useAlert.success("文件已成功上传并生成独立预览地址");
      } else {
        useAlert.error("文件上传失败: " + (uploadRes?.message || "网络异常"));
      }

      // 如果是纯文本类型，读取部分文本供 AI 上下文参考（最多 4000 字，安全截断）
      const isTextLike =
        file.type.startsWith("text/") ||
        /\.(txt|md|markdown|json|csv|log|xml|html|js|ts|py|yaml|yml)$/i.test(file.name);

      if (isTextLike) {
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(((ev.target?.result as string) || "").slice(0, 4000));
          reader.onerror = () => resolve("");
          reader.readAsText(file);
        });
        if (text) {
          setRawFileText(text);
        }
        if (!customPrompt) setCustomPrompt(PROMPT_PRESETS[1].prompt);
      } else if (detectedType === "image") {
        if (!customPrompt) setCustomPrompt(PROMPT_PRESETS[0].prompt);
      }
    } catch (err: any) {
      useAlert.error("文件上传失败: " + (err?.message || "未知错误"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRunAiExtract = async () => {
    if (!title.trim() && !fileName && !rawFileText && !customPrompt) {
      useAlert.warning("请先上传文件或输入素材名称 / 提炼指令");
      return;
    }

    try {
      setAiExtracting(true);
      const res = await extractMaterialAiSummary({
        title: title.trim() || fileName,
        fileName,
        fileType,
        content: rawFileText ? rawFileText.slice(0, 3000) : content ? content.replace(/<[^>]+>/g, "").slice(0, 3000) : undefined,
        customPrompt: customPrompt.trim(),
        sourceUrl: sourceUrl.trim(),
      });

      if (res && res.success && res.result) {
        if (res.result.aiSummary) setAiSummary(res.result.aiSummary);
        if (res.result.extractedLore) setExtractedLore(res.result.extractedLore);
        if (Array.isArray(res.result.suggestedTags) && res.result.suggestedTags.length > 0) {
          const existing = tags ? tags.split(/[,，\s]+/).filter(Boolean) : [];
          const combined = Array.from(new Set([...existing, ...res.result.suggestedTags])).join(", ");
          setTags(combined);
        }
        useAlert.success("AI 提炼完成！您可以点击下方「追加至素材笔记」将内容追加进笔记");
      } else {
        useAlert.error(res?.message || "AI 提炼失败");
      }
    } catch (e: any) {
      useAlert.error("AI 提炼失败: " + (e?.message || "网络异常"));
    } finally {
      setAiExtracting(false);
    }
  };

  const handleAppendToNote = () => {
    const textToInsert = extractedLore || aiSummary;
    if (!textToInsert) {
      useAlert.warning("暂无 AI 提炼结果可供追加");
      return;
    }

    const formattedHtml = textToInsert
      .split(/\r?\n\r?\n/)
      .map((para) => `<p>${para.replace(/\r?\n/g, "<br>")}</p>`)
      .join("");

    if (content.trim()) {
      setContent((prev) => `${prev}<br><hr><p><strong>【AI 提炼采纳】：</strong></p>${formattedHtml}`);
    } else {
      setContent(formattedHtml);
    }
    useAlert.success("已将 AI 提炼内容追加至素材笔记！");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      useAlert.warning("素材名称不能为空");
      return;
    }

    try {
      setSaving(true);
      if (initialData?.id) {
        const res = await updateMaterial({
          id: initialData.id,
          title: title.trim(),
          fileType,
          fileName: fileName || title.trim(),
          fileSize: fileSize || undefined,
          fileUrl: fileUrl || undefined,
          content: content.trim(),
          aiSummary: aiSummary || undefined,
          aiPrompt: customPrompt.trim() || undefined,
          extractedLore: extractedLore || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          tags: tags.trim() || undefined,
          isPinned: isPinned ? 1 : 0,
          includeInAiContext: includeInAi ? 1 : 0,
          status: "processed",
        });

        if (res && res.success) {
          resetForm();
          onClose();
          onSuccess({
            ...initialData,
            title: title.trim(),
            fileType,
            fileName: fileName || title.trim(),
            fileSize: fileSize || undefined,
            fileUrl: fileUrl || undefined,
            content: content.trim(),
            aiSummary: aiSummary || undefined,
            aiPrompt: customPrompt.trim() || undefined,
            extractedLore: extractedLore || undefined,
            sourceUrl: sourceUrl.trim() || undefined,
            tags: tags.trim() || undefined,
            isPinned: isPinned ? 1 : 0,
            includeInAiContext: includeInAi ? 1 : 0,
            updatedAt: new Date().toISOString(),
          });
        } else {
          useAlert.error(res?.message || "保存素材失败");
        }
      } else {
        const res = await createMaterial({
          workId: Number(workId),
          title: title.trim(),
          fileType,
          fileName: fileName || title.trim(),
          fileSize: fileSize || undefined,
          fileUrl: fileUrl || undefined,
          content: content.trim(),
          aiSummary: aiSummary || undefined,
          aiPrompt: customPrompt.trim() || undefined,
          extractedLore: extractedLore || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          tags: tags.trim() || undefined,
          isPinned: isPinned ? 1 : 0,
          includeInAiContext: includeInAi ? 1 : 0,
          status: "processed",
        });

        if (res && res.success && res.result) {
          resetForm();
          onClose();
          onSuccess(res.result);
        } else {
          useAlert.error(res?.message || "创建素材失败");
        }
      }
    } catch (e: any) {
      useAlert.error((initialData ? "保存素材失败: " : "创建素材失败: ") + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={
        <Group gap={8}>
          <FiFileText size={18} color="#0284c7" />
          <Text fw={700} fz={16} c="#0f172a">
            {initialData ? `编辑素材资料 — ${initialData.title}` : "新建素材资料（文件上传、AI 智能提炼与沉淀笔记）"}
          </Text>
        </Group>
      }
      centered
      size="85vw"
      radius="md"
      styles={{
        content: {
          maxWidth: "1400px",
          minWidth: "360px",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
        },
        header: {
          borderBottom: "1px solid #f1f5f9",
          padding: "16px 24px",
          flexShrink: 0,
        },
        body: {
          padding: "20px 24px",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        },
      }}
    >
      <Stack gap="md">
        {/* 1. 文件上传与独立链接区域 */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
        <Paper
          p="md"
          withBorder
          radius="md"
          style={{
            borderColor: fileName ? "#0284c7" : "#cbd5e1",
            backgroundColor: fileName ? "#f0f9ff" : "#f8fafc",
            transition: "all 0.2s ease",
          }}
        >
          {fileName ? (
            <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
              <Group gap={10}>
                <FiCheckCircle size={22} color="#0284c7" />
                <Box>
                  <Flex align="center" gap={8}>
                    <Text fz={13.5} fw={700} c="#0284c7">
                      已上传文件：{fileName}
                    </Text>
                    {fileSize && (
                      <Badge size="xs" color="blue" variant="light">
                        {fileSize}
                      </Badge>
                    )}
                    <Badge size="xs" color="gray" variant="outline">
                      {fileType}
                    </Badge>
                  </Flex>
                  <Text fz={11.5} c="#64748b" mt={2}>
                    已生成独立文件链接：{fileUrl || "已生成"}，原文件内容作为源参考，不会直接污染您的笔记
                  </Text>
                </Box>
              </Group>

              <Group gap="xs">
                {fileUrl && (
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    leftSection={<FiExternalLink size={13} />}
                    onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}
                  >
                    在新标签页单独查看文件 ↗
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  更换文件
                </Button>
              </Group>
            </Flex>
          ) : (
            <Box
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: "pointer", textAlign: "center", padding: "16px 0" }}
            >
              <Flex direction="column" align="center" justify="center" gap={4}>
                <FiUploadCloud size={28} color="#0284c7" />
                <Text fz={13.5} fw={700} c="#334155">
                  {uploading ? "正在上传解析文件..." : "点击选择或拖入本地文件（图片、TXT、MD、PDF、DOCX 等）"}
                </Text>
                <Text fz={11.5} c="#94a3b8">
                  上传后系统将生成独立预览 URL，并支持结合您的自定义指令一键交由 AI 提取总结
                </Text>
              </Flex>
            </Box>
          )}
        </Paper>

        {/* 2. AI 智能提取与自定义指令模块（支持折叠/展开，默认收起） */}
        <Paper p="sm" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
          <Flex
            justify="space-between"
            align="center"
            style={{ cursor: "pointer", userSelect: "none" }}
            onClick={() => setAiSectionOpened((prev) => !prev)}
          >
            <Group gap={8}>
              <FiZap size={16} color="#0284c7" />
              <Text fz={13.5} fw={700} c="#0369a1">
                AI 结合文件提取与智能分析
              </Text>
              {(aiSummary || extractedLore) ? (
                <Badge size="xs" color="blue" variant="filled">
                  已提炼
                </Badge>
              ) : (
                <Text fz={11.5} c="#0284c7" style={{ opacity: 0.8 }}>
                  (可选 · 自定义指令提炼设定与写作启发)
                </Text>
              )}
            </Group>
            <Button
              size="compact-xs"
              variant="subtle"
              color="blue"
              rightSection={aiSectionOpened ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                setAiSectionOpened((prev) => !prev);
              }}
            >
              {aiSectionOpened ? "收起" : "展开提炼"}
            </Button>
          </Flex>

          {aiSectionOpened && (
            <Box mt="xs" pt="xs" style={{ borderTop: "1px dashed #bae6fd" }}>
              <Flex justify="space-between" align="center" mb={6}>
                <Text fz={11.5} c="#0369a1">
                  快速选用提炼指令或输入具体诉求（如：分析图片意境、提取硬核机制、总结特定段落）：
                </Text>
                <Button
                  size="xs"
                  variant="filled"
                  color="blue"
                  leftSection={<FiZap size={13} />}
                  loading={aiExtracting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunAiExtract();
                  }}
                >
                  结合文件与指令 AI 提炼
                </Button>
              </Flex>

              {/* 预设指令标签 */}
              <Group gap={6} mb={8} wrap="wrap">
                {PROMPT_PRESETS.map((preset, idx) => (
                  <Button
                    key={idx}
                    size="compact-xs"
                    variant="light"
                    color="blue"
                    onClick={() => setCustomPrompt(preset.prompt)}
                    style={{ fontSize: 11.5 }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </Group>

              <Textarea
                placeholder="输入您的自定义提取指令，例如：请帮我描述该素材的服饰风格与环境光影，或总结其中关于星舰引擎的输出功率与机制..."
                size="xs"
                minRows={2}
                autosize
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                styles={{
                  input: {
                    backgroundColor: "#ffffff",
                    borderColor: "#bae6fd",
                    fontSize: 12.5,
                  },
                }}
              />

              {/* AI 返回的结果预览与采纳按钮 */}
              {(aiSummary || extractedLore) && (
                <Box mt="sm" pt="sm" style={{ borderTop: "1px dashed #bae6fd" }}>
                  <Flex justify="space-between" align="center" mb={6}>
                    <Text fz={12.5} fw={700} c="#0369a1">
                      AI 分析与提炼结果：
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={<FiCornerDownLeft size={13} />}
                      onClick={handleAppendToNote}
                    >
                      追加至素材笔记
                    </Button>
                  </Flex>

                  {aiSummary && (
                    <Box p="xs" bg="#ffffff" style={{ borderRadius: 6, border: "1px solid #e0f2fe", marginBottom: 6 }}>
                      <Text fz={11.5} fw={700} c="#0284c7" mb={2}>
                        【智能摘要 / 用途说明】
                      </Text>
                      <Text fz={12} c="#374151" style={{ lineHeight: 1.5 }}>
                        {aiSummary}
                      </Text>
                    </Box>
                  )}

                  {extractedLore && (
                    <Box p="xs" bg="#ffffff" style={{ borderRadius: 6, border: "1px solid #e0f2fe", maxHeight: 180, overflowY: "auto" }}>
                      <Text fz={11.5} fw={700} c="#0284c7" mb={2}>
                        【提炼要点 / 设定描述】
                      </Text>
                      <Text fz={12} c="#374151" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                        {extractedLore}
                      </Text>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Paper>

        {/* 3. 基础信息配置 */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <TextInput
            label="素材名称 / 笔记主题"
            placeholder="例如：反物质驱动原理 / 第四军团制服参考"
            size="xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            styles={{ input: { fontWeight: 600 } }}
          />

          <Select
            label="素材类型"
            size="xs"
            value={fileType}
            onChange={(val) => setFileType(val || "document")}
            data={[
              { value: "document", label: "文档 (TXT/MD/DOC/文献)" },
              { value: "image", label: "图片 (图鉴/设计稿)" },
              { value: "data", label: "数据表 (参数/数值)" },
              { value: "link", label: "外部链接" },
              { value: "audio", label: "音频" },
              { value: "video", label: "视频" },
            ]}
          />

          <TextInput
            label="标签 (逗号或空格隔开)"
            placeholder="例如：科技, 军事, 设定参考"
            size="xs"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="物理来源 / 原始链接 (选填)"
            placeholder="https://..."
            size="xs"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />

          {/* 置顶与上下文注入开关 */}
          <Flex align="center" gap="lg" mt={22}>
            <Switch
              label="📌 置顶该素材卡片"
              size="xs"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.currentTarget.checked)}
            />
            <Switch
              label="🤖 注入 AI 写作大模型上下文"
              size="xs"
              checked={includeInAi}
              onChange={(e) => setIncludeInAi(e.currentTarget.checked)}
            />
          </Flex>
        </SimpleGrid>

        {/* 4. 素材笔记编辑器（作者自己提炼的重点与笔记心得） */}
        <Box>
          <Flex justify="space-between" align="center" mb={6}>
            <Group gap={6}>
              <FiFileText size={15} color="#0284c7" />
              <Text fz={13} fw={700} c="#0f172a">
                素材笔记 (作者重点提炼与沉淀心得)
              </Text>
            </Group>
            {content.length > 0 && (
              <Text fz={11} c="#64748b">
                笔记字数约 {content.replace(/<[^>]+>/g, "").length} 字符
              </Text>
            )}
          </Flex>

          <RichTextEditor
            value={content}
            onChange={(html) => setContent(html)}
            placeholder="在此书写您提炼的重点要点、小说剧情结合构想，或采纳上方 AI 分析的精要内容..."
            minHeight={220}
            maxHeight={360}
          />
        </Box>

        {/* 底部提交栏 */}
        <Flex justify="flex-end" gap="xs" mt="sm" pt={12} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button
            variant="default"
            size="xs"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            取消
          </Button>
          <Button size="xs" loading={saving} onClick={handleSubmit}>
            确认保存素材与笔记
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
