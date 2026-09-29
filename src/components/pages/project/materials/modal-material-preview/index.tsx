// 组件：素材笔记查看预览弹窗（顶部支持展开收起AI分析提炼、展示笔记内容与复制全文、编辑、关闭操作）
"use client";

import React, { useState, useEffect } from "react";
import { Modal, Box, Flex, Text, Button, Paper, Group } from "@mantine/core";
import { FiCopy, FiEdit, FiFileText, FiZap, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useAlert } from "@/hooks/useAlert";
import { MaterialData } from "@/rest/project-extensions";
import { RichTextViewer } from "@/components/common/rich-text";

interface ModalMaterialPreviewProps {
  opened: boolean;
  material: MaterialData | null;
  onClose: () => void;
  onOpenEditModal?: () => void;
}

export default function ModalMaterialPreview({
  opened,
  material,
  onClose,
  onOpenEditModal,
}: ModalMaterialPreviewProps) {
  const [aiSectionOpened, setAiSectionOpened] = useState(false);

  useEffect(() => {
    if (opened) {
      setAiSectionOpened(false);
    }
  }, [opened]);

  if (!material) return null;

  const rawNoteContent = material.content || "";
  const plainText = rawNoteContent.replace(/<[^>]+>/g, "").trim();

  const handleCopyNote = () => {
    if (!rawNoteContent) {
      useAlert.warning("暂无素材笔记可供复制");
      return;
    }
    navigator.clipboard.writeText(plainText || rawNoteContent);
    useAlert.success("素材笔记内容已复制到剪贴板");
  };

  const hasAiResult = Boolean(material.aiSummary || material.extractedLore);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={8}>
          <FiFileText size={18} color="#0284c7" />
          <Text fw={700} fz={16} c="#0f172a">
            素材笔记 — {material.title}
          </Text>
        </Group>
      }
      size="70vw"
      centered
      radius="md"
      styles={{
        content: {
          maxWidth: "1000px",
          minWidth: "320px",
          maxHeight: "90vh",
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
      <Box style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* 顶部 AI 分析与提炼结果（展开收起，默认收起） */}
        {hasAiResult && (
          <Paper p="sm" bg="#f0f9ff" withBorder radius="md" style={{ borderColor: "#bae6fd" }}>
            <Flex
              justify="space-between"
              align="center"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setAiSectionOpened((prev) => !prev)}
            >
              <Group gap={8}>
                <FiZap size={15} color="#0284c7" />
                <Text fz={13} fw={700} c="#0369a1">
                  AI 分析与提炼结果
                </Text>
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
                {aiSectionOpened ? "收起" : "展开查看"}
              </Button>
            </Flex>

            {aiSectionOpened && (
              <Box mt="xs" pt="xs" style={{ borderTop: "1px dashed #bae6fd" }}>
                {material.aiSummary && (
                  <Box mb={material.extractedLore ? "xs" : undefined}>
                    <Text fz={11.5} fw={700} c="#0369a1" mb={2}>
                      【用途说明 / 摘要】：
                    </Text>
                    <Text fz={12.5} c="#0c4a6e" style={{ lineHeight: 1.6 }}>
                      {material.aiSummary}
                    </Text>
                  </Box>
                )}

                {material.extractedLore && (
                  <Box
                    mt={material.aiSummary ? "xs" : undefined}
                    pt={material.aiSummary ? "xs" : undefined}
                    style={material.aiSummary ? { borderTop: "1px dashed #bae6fd" } : undefined}
                  >
                    <Text fz={11.5} fw={700} c="#0369a1" mb={2}>
                      【提炼设定点 / 描写建议】：
                    </Text>
                    <Text fz={12.5} c="#0c4a6e" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {material.extractedLore}
                    </Text>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        )}

        {/* 笔记内容展示 */}
        <Paper
          p="md"
          bg="#ffffff"
          withBorder
          radius="sm"
          style={{ borderColor: "#e2e8f0", minHeight: 220, maxHeight: "60vh", overflowY: "auto" }}
        >
          {rawNoteContent ? (
            <RichTextViewer content={rawNoteContent} />
          ) : (
            <Box style={{ textAlign: "center", padding: "60px 0" }}>
              <Text fz={13.5} c="#94a3b8">
                该素材暂未录入作者笔记
              </Text>
            </Box>
          )}
        </Paper>

        {/* 底部按钮栏：复制全文、编辑、关闭 */}
        <Flex justify="flex-end" align="center" gap="xs" pt={12} style={{ borderTop: "1px solid #f1f5f9" }}>
          {rawNoteContent ? (
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<FiCopy size={13} />}
              onClick={handleCopyNote}
            >
              复制全文
            </Button>
          ) : null}

          {onOpenEditModal && (
            <Button
              size="xs"
              color="blue"
              leftSection={<FiEdit size={13} />}
              onClick={() => {
                onClose();
                onOpenEditModal();
              }}
            >
              编辑
            </Button>
          )}

          <Button variant="default" size="xs" onClick={onClose}>
            关闭
          </Button>
        </Flex>
      </Box>
    </Modal>
  );
}
