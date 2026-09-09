// 组件：新建素材资料弹窗（融合文件上传与文本复制粘贴新建，支持拖拽选择与自动内容提取）
"use client";

import React, { useState, useRef } from "react";
import { Flex, Text, Button, Modal, TextInput, Textarea, Select, Stack, Group, SimpleGrid, Paper, Box } from "@mantine/core";
import { FiUploadCloud, FiFileText, FiLink, FiTag, FiCheckCircle } from "react-icons/fi";
import { useAlert } from "@/hooks/useAlert";
import { MaterialData, createMaterial } from "@/rest/project-extensions";
import { uploadImageFile } from "@/rest/world";

interface ModalCreateMaterialProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  onSuccess: (created: MaterialData) => void;
}

export default function ModalCreateMaterial({
  opened,
  onClose,
  workId,
  onSuccess,
}: ModalCreateMaterialProps) {
  const [title, setTitle] = useState("");
  const [fileType, setFileType] = useState("document");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tags, setTags] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setFileType("document");
    setContent("");
    setSourceUrl("");
    setTags("");
    setFileName("");
    setFileSize("");
    setFileUrl("");
  };

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

      const sizeStr = file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      setFileSize(sizeStr);

      let detectedType = "document";
      if (file.type.startsWith("image/")) detectedType = "image";
      else if (file.type.startsWith("audio/")) detectedType = "audio";
      else if (file.type.startsWith("video/")) detectedType = "video";
      setFileType(detectedType);

      if (detectedType === "image") {
        const uploadRes = await uploadImageFile(file);
        if (uploadRes && uploadRes.success && uploadRes.url) {
          setFileUrl(uploadRes.url);
          useAlert.success("图片上传成功");
        } else {
          useAlert.error("图片上传失败: " + (uploadRes?.message || "未知错误"));
        }
      } else {
        // 读取文本文件内容
        const isTextLike =
          file.type.startsWith("text/") ||
          /\.(txt|md|markdown|json|csv|log|xml|html|js|ts|py|yaml|yml)$/i.test(file.name);

        if (isTextLike) {
          const text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve((ev.target?.result as string) || "");
            reader.onerror = () => resolve("");
            reader.readAsText(file);
          });
          if (text) {
            setContent(text);
          }
        }
      }
    } catch (err: any) {
      useAlert.error("读取文件失败: " + (err?.message || "未知错误"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      useAlert.warning("素材名称不能为空");
      return;
    }

    try {
      setSaving(true);
      const res = await createMaterial({
        workId: Number(workId),
        title: title.trim(),
        fileType,
        fileName: fileName || title.trim(),
        fileSize: fileSize || undefined,
        fileUrl: fileUrl || undefined,
        content: content.trim(),
        extractedLore: content.trim() ? content.trim().slice(0, 1000) : undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        tags: tags.trim() || undefined,
        status: "processed",
      });

      if (res && res.success && res.result) {
        resetForm();
        onClose();
        onSuccess(res.result);
      }
    } catch (e: any) {
      useAlert.error("创建素材失败: " + (e?.message || "网络异常"));
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
          <FiFileText size={16} color="#0284c7" />
          <Text fw={700} fz={15} c="#0f172a">
            新建素材资料
          </Text>
        </Group>
      }
      centered
      size="lg"
      radius="md"
      styles={{
        content: { maxWidth: "680px" },
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 12 },
        body: { paddingTop: 16 },
      }}
    >
      <Stack gap="sm">
        {/* 上传文件或拖拽快捷区域 */}
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
          onClick={() => fileInputRef.current?.click()}
          style={{
            borderStyle: "dashed",
            borderColor: fileName ? "#0284c7" : "#cbd5e1",
            backgroundColor: fileName ? "#f0f9ff" : "#f8fafc",
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.2s ease",
          }}
        >
          <Flex direction="column" align="center" justify="center" gap={4}>
            {fileName ? (
              <>
                <FiCheckCircle size={22} color="#0284c7" />
                <Text fz={12.5} fw={700} c="#0284c7">
                  已加载文件：{fileName} {fileSize ? `(${fileSize})` : ""}
                </Text>
                <Text fz={11} c="#64748b">
                  点击可重新选择更换文件
                </Text>
              </>
            ) : (
              <>
                <FiUploadCloud size={24} color="#64748b" />
                <Text fz={13} fw={600} c="#334155">
                  {uploading ? "正在解析文件..." : "点击选择或拖入本地文件 (TXT, MD, DOCX, CSV, 图片等)"}
                </Text>
                <Text fz={11} c="#94a3b8">
                  选择后将自动提取文件名与文本正文，也可直接在下方手动输入
                </Text>
              </>
            )}
          </Flex>
        </Paper>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <TextInput
            label="素材名称"
            placeholder="例如：空间跃迁理论 / 仙女座参考"
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
              { value: "document", label: "文档 (TXT/MD/DOC)" },
              { value: "image", label: "图片" },
              { value: "data", label: "数据表" },
              { value: "link", label: "外部链接" },
              { value: "audio", label: "音频" },
              { value: "video", label: "视频" },
            ]}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <TextInput
            label="物理来源 / 原始链接 (选填)"
            placeholder="https://..."
            size="xs"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />

          <TextInput
            label="标签 (选填，逗号或空格隔开)"
            placeholder="例如：天文学, 科技, 设定参考"
            size="xs"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </SimpleGrid>

        <Box>
          <Flex justify="space-between" align="center" mb={4}>
            <Text fz={12} fw={600} c="#334155">
              素材详细内容 / 文字提炼 (可直接复制粘贴)
            </Text>
            {content.length > 0 && (
              <Text fz={11} c="#64748b">
                已输入 {content.length} 字符
              </Text>
            )}
          </Flex>
          <Textarea
            placeholder="在此直接粘贴素材全文、核心机制、参数公式或硬核设定..."
            size="xs"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={5}
            autosize
            styles={{
              input: {
                fontFamily: "monospace",
                fontSize: 12,
                lineHeight: 1.6,
              },
            }}
          />
        </Box>

        <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={() => {
            resetForm();
            onClose();
          }}>
            取消
          </Button>
          <Button size="xs" loading={saving} onClick={handleSubmit}>
            确认创建素材
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
