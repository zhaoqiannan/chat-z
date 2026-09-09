// 组件：素材正文与文档查看预览弹窗（60vw 宽屏，支持正文阅读、字数统计、复制全文与 Office 在线预览）
"use client";

import React from "react";
import { Modal, Box, Flex, Text, Button, Badge, ActionIcon, Paper, Group, Stack } from "@mantine/core";
import { FiEye, FiCopy, FiExternalLink, FiFileText, FiImage, FiLink, FiDownloadCloud } from "react-icons/fi";
import { MaterialData } from "@/rest/project-extensions";

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

  const contentText = material.content || material.extractedLore || "";
  const charCount = contentText.length;
  const targetUrl = material.sourceUrl || material.fileUrl || "";

  const isWordDoc =
    /\.(docx|doc|dotx|dot)$/i.test(material.fileName || material.title || "") ||
    /\.(docx|doc)$/i.test(targetUrl);

  const handleCopy = () => {
    if (!contentText) return;
    navigator.clipboard.writeText(contentText);
    alert("素材全文内容已复制到剪贴板");
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
    } else if (contentText) {
      const blob = new Blob([contentText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".txt") || filename.endsWith(".md") ? filename : `${filename}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (targetUrl) {
      window.open(targetUrl, "_blank");
    } else {
      alert("暂无可供下载的附件或正文内容");
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
            <Text fw={700} fz={15} c="#0f172a">
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
        {/* 工具操作栏 */}
        <Flex justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap={6}>
            <Badge size="sm" variant="light" color="blue">
              {charCount > 0 ? `${charCount} 字符` : "无本地文本"}
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
            {(contentText || material.fileUrl || targetUrl) && (
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

            {contentText && (
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

        {/* 图片预览 */}
        {material.fileType === "image" && (material.fileUrl || targetUrl) && (
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

        {/* 文本内容查看区 */}
        <Paper p="md" bg="#f8fafc" withBorder radius="md" style={{ borderColor: "#e2e8f0" }}>
          <Flex justify="space-between" align="center" mb={8}>
            <Text fz={13} fw={700} c="#334155">
              素材正文 / 提炼内容
            </Text>
            {material.aiSummary && (
              <Badge size="xs" color="teal" variant="light">
                已生成 AI 摘要
              </Badge>
            )}
          </Flex>

          {contentText ? (
            <Box
              style={{
                maxHeight: 400,
                overflowY: "auto",
                padding: "12px 14px",
                borderRadius: 6,
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                fontFamily: "Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 13,
                lineHeight: 1.7,
                color: "#1e293b",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {contentText}
            </Box>
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
          <Paper p="sm" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
            <Text fz={12.5} fw={700} c="#0284c7" mb={4}>
              💡 AI 智能提炼摘要
            </Text>
            <Text fz={12.5} c="#0369a1" style={{ lineHeight: 1.6 }}>
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
