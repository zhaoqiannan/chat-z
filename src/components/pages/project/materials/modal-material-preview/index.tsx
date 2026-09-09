// 组件：素材正文与文档查看预览弹窗（80vw 宽屏，支持富文本回显、表格渲染、图片放大、字数统计与文档下载）
"use client";

import React from "react";
import { Modal, Box, Flex, Text, Button, Badge, ActionIcon, Paper, Group, Stack } from "@mantine/core";
import { FiEye, FiCopy, FiExternalLink, FiFileText, FiImage, FiLink, FiDownloadCloud, FiZap } from "react-icons/fi";
import { useAlert } from "@/hooks/useAlert";
import { MaterialData } from "@/rest/project-extensions";
import { RichTextViewer } from "@/components/common/rich-text";

interface ModalMaterialPreviewProps {
  opened: boolean;
  material: MaterialData | null;
  onClose: () => void;
  onOpenSummaryModal?: () => void;
}

export default function ModalMaterialPreview({
  opened,
  material,
  onClose,
  onOpenSummaryModal,
}: ModalMaterialPreviewProps) {
  if (!material) return null;

  const rawContent = material.content || material.extractedLore || "";
  const plainText = rawContent.replace(/<[^>]+>/g, "").trim();
  const charCount = plainText.length;
  const targetUrl = material.sourceUrl || material.fileUrl || "";

  const isWordDoc =
    /\.(docx|doc|dotx|dot)$/i.test(material.fileName || material.title || "") ||
    /\.(docx|doc)$/i.test(targetUrl);

  const handleCopy = () => {
    if (!rawContent) return;
    navigator.clipboard.writeText(plainText || rawContent);
    useAlert.success("素材正文内容已复制到剪贴板");
  };

  const handleOpenSource = () => {
    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenOfficeViewer = () => {
    if (targetUrl) {
      const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(targetUrl)}`;
      window.open(viewerUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = () => {
    const filename = material.fileName || `${material.title || "素材"}.txt`;
    if (material.fileUrl && !material.fileUrl.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = material.fileUrl;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      useAlert.success("正在下载附件文件");
    } else if (rawContent) {
      const blob = new Blob([plainText || rawContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".txt") || filename.endsWith(".md") || filename.endsWith(".html") ? filename : `${filename}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      useAlert.success("正文内容文本已下载");
    } else if (targetUrl) {
      window.open(targetUrl, "_blank");
    } else {
      useAlert.warning("暂无可供下载的附件或正文内容");
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={8}>
          <FiFileText size={18} color="#0284c7" />
          <Box>
            <Text fw={700} fz={16} c="#0f172a">
              {material.title}
            </Text>
            {material.fileSize && (
              <Text fz={11} c="#94a3b8">
                文件大小：{material.fileSize}
              </Text>
            )}
          </Box>
        </Group>
      }
      size="80vw"
      centered
      radius="md"
      styles={{
        content: {
          maxWidth: "1350px",
          minWidth: "360px",
          maxHeight: "92vh",
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
        {/* 工具操作栏 */}
        <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap={6}>
            <Badge size="sm" variant="light" color="blue">
              {charCount > 0 ? `${charCount} 字` : "无本地文本"}
            </Badge>
            {material.tags && (
              <Group gap={4}>
                {material.tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
                  <Badge key={idx} size="sm" variant="outline" color="gray">
                    {t}
                  </Badge>
                ))}
              </Group>
            )}
          </Group>

          <Group gap="xs">
            {(rawContent || material.fileUrl || targetUrl) && (
              <Button
                size="xs"
                variant="light"
                color="indigo"
                leftSection={<FiDownloadCloud size={13} />}
                onClick={handleDownload}
              >
                下载附件/正文
              </Button>
            )}

            {rawContent && (
              <Button
                size="xs"
                variant="light"
                color="gray"
                leftSection={<FiCopy size={12} />}
                onClick={handleCopy}
              >
                复制全文
              </Button>
            )}

            {targetUrl && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<FiExternalLink size={12} />}
                onClick={handleOpenSource}
              >
                打开原始文档/链接
              </Button>
            )}

            {isWordDoc && targetUrl && (
              <Button
                size="xs"
                variant="light"
                color="teal"
                leftSection={<FiEye size={12} />}
                onClick={handleOpenOfficeViewer}
                title="通过微软 Office 在线云预览渲染完整排版"
              >
                Office 在线预览
              </Button>
            )}
          </Group>
        </Flex>

        {/* 独立图片附件预览 (如果类型为 image 且未内嵌在 html 中) */}
        {material.fileType === "image" && (material.fileUrl || targetUrl) && !rawContent.includes("<img") && (
          <Paper p="sm" bg="#f8fafc" withBorder radius="md" style={{ textAlign: "center" }}>
            <Box
              component="img"
              src={material.fileUrl || targetUrl}
              alt={material.title}
              style={{
                maxWidth: "100%",
                maxHeight: "450px",
                objectFit: "contain",
                borderRadius: 6,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            />
          </Paper>
        )}

        {/* 富文本正文查看区 */}
        <Paper p="md" bg="#f8fafc" withBorder radius="md" style={{ borderColor: "#e2e8f0" }}>
          <Flex justify="space-between" align="center" mb={8}>
            <Text fz={13.5} fw={700} c="#334155">
              素材正文与排版内容
            </Text>
            {material.aiSummary && (
              <Badge size="xs" color="teal" variant="light">
                已生成 AI 摘要
              </Badge>
            )}
          </Flex>

          {rawContent ? (
            <Paper
              p="md"
              bg="#ffffff"
              withBorder
              radius="sm"
              style={{ borderColor: "#e2e8f0", minHeight: 180, maxHeight: 480, overflowY: "auto" }}
            >
              <RichTextViewer content={rawContent} />
            </Paper>
          ) : (
            <Box style={{ textAlign: "center", padding: "40px 0" }}>
              <Text fz={13} c="#94a3b8">
                该素材暂无本地文本正文
              </Text>
              {targetUrl && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="blue"
                  mt="xs"
                  leftSection={<FiExternalLink size={12} />}
                  onClick={handleOpenSource}
                >
                  点击访问外部原始链接
                </Button>
              )}
            </Box>
          )}
        </Paper>

        {/* AI 智能摘要展示 */}
        {material.aiSummary && (
          <Paper p="md" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
            <Flex justify="space-between" align="center" mb={6}>
              <Group gap={6}>
                <FiZap size={14} color="#0284c7" />
                <Text fz={13} fw={700} c="#0284c7">
                  AI 智能提炼摘要
                </Text>
              </Group>
            </Flex>
            <Text fz={13} c="#0369a1" style={{ lineHeight: 1.65 }}>
              {material.aiSummary}
            </Text>
          </Paper>
        )}

        <Flex justify="flex-end" gap="xs" mt="sm" pt={12} style={{ borderTop: "1px solid #f1f5f9" }}>
          {onOpenSummaryModal && (
            <Button
              size="xs"
              variant="light"
              color="blue"
              onClick={() => {
                onClose();
                onOpenSummaryModal();
              }}
            >
              编辑设定与 AI 摘要
            </Button>
          )}
          <Button variant="default" size="xs" onClick={onClose}>
            关闭
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
