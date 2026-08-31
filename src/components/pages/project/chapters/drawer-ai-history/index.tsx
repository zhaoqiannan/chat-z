"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Modal,
  Box,
  Flex,
  Text,
  Button,
  Badge,
  ActionIcon,
  Tooltip,
  Paper,
  Stack,
  LoadingOverlay,
  ScrollArea,
  Group,
} from "@mantine/core";
import {
  FiClock,
  FiFileText,
  FiTrash2,
  FiCheck,
  FiCopy,
  FiEye,
  FiZap,
  FiColumns,
  FiCalendar,
} from "react-icons/fi";
import {
  ChapterAiHistoryItem,
  getChapterAiHistoryList,
  deleteChapterAiHistory,
} from "@/rest/chapter";

interface DrawerAiHistoryProps {
  opened: boolean;
  onClose: () => void;
  chapterId: number | string | null;
  workId: string;
  chapterTitle?: string;
  onApplyHistory: (content: string) => void;
}

export default function DrawerAiHistory({
  opened,
  onClose,
  chapterId,
  workId,
  chapterTitle = "",
  onApplyHistory,
}: DrawerAiHistoryProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ChapterAiHistoryItem[]>([]);

  // 查看详情 Modal
  const [previewModalOpened, setPreviewModalOpened] = useState(false);
  const [activeItem, setActiveItem] = useState<ChapterAiHistoryItem | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchHistory = async () => {
    if (!chapterId) return;
    try {
      setLoading(true);
      const res = await getChapterAiHistoryList(chapterId, workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取章节 AI 历史记录失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened && chapterId) {
      fetchHistory();
    }
  }, [opened, chapterId]);

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("确定要删除该条 AI 生成历史记录吗？")) {
      const res = await deleteChapterAiHistory(id);
      if (res && res.success) {
        if (activeItem?.id === id) {
          setPreviewModalOpened(false);
        }
        await fetchHistory();
      }
    }
  };

  const handleOpenPreview = (item: ChapterAiHistoryItem) => {
    setActiveItem(item);
    setCopied(false);
    setPreviewModalOpened(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = (content: string) => {
    if (confirm("确定要采纳该历史版本并填入当前章节正文吗？(当前未保存的修改将被覆盖)")) {
      onApplyHistory(content);
      setPreviewModalOpened(false);
      onClose();
    }
  };

  const formatDate = (raw: string | number) => {
    if (!raw) return "";
    const date = typeof raw === "number" ? new Date(raw) : new Date(raw);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case "draft":
        return <Badge color="violet" variant="light" size="xs">初稿生成</Badge>;
      case "optimize":
        return <Badge color="teal" variant="light" size="xs">全文润色</Badge>;
      case "selection_ai":
        return <Badge color="cyan" variant="light" size="xs">局部改写</Badge>;
      default:
        return <Badge color="gray" variant="light" size="xs">AI版本</Badge>;
    }
  };

  return (
    <>
      {/* 右侧滑出历史版本列表抽屉 */}
      <Drawer
        opened={opened}
        onClose={onClose}
        title={
          <Flex align="center" gap={8}>
            <FiClock color="#00c9ff" size={18} />
            <Text fw={700} fz={15}>
              AI 创作历史版本 · {chapterTitle || "本章"}
            </Text>
          </Flex>
        }
        position="right"
        size="440px"
        padding="md"
      >
        <Box pos="relative" style={{ minHeight: 300 }}>
          <LoadingOverlay visible={loading} />

          {list.length === 0 && !loading ? (
            <Flex direction="column" align="center" justify="center" p={40} c="#94a3b8" gap={8}>
              <FiFileText size={36} strokeWidth={1.2} />
              <Text fz={14} fw={600}>暂无历史版本记录</Text>
              <Text fz={12} ta="center">
                使用「AI 生成初稿」或「全文润色」后，每次生成的版本都会自动归档在此
              </Text>
            </Flex>
          ) : (
            <Stack gap="12px">
              {list.map((item) => (
                <Paper
                  key={item.id}
                  p="12px 14px"
                  withBorder
                  bg="#ffffff"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    border: "1px solid #e2e8f0",
                  }}
                  onClick={() => handleOpenPreview(item)}
                >
                  <Flex justify="space-between" align="center" mb={6}>
                    <Flex align="center" gap={6}>
                      {getModeBadge(item.mode)}
                      <Text fz={13} fw={700} c="#1e293b">
                        {item.title}
                      </Text>
                    </Flex>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={(e) => handleDelete(item.id, e)}
                    >
                      <FiTrash2 size={13} />
                    </ActionIcon>
                  </Flex>

                  {item.promptSummary && (
                    <Text fz={12} c="#64748b" lineClamp={2} mb={6}>
                      大纲诉求：{item.promptSummary}
                    </Text>
                  )}

                  <Flex justify="space-between" align="center" fz={11} c="#94a3b8" pt={6} style={{ borderTop: "1px dashed #f1f5f9" }}>
                    <Flex align="center" gap={4}>
                      <FiCalendar size={11} />
                      <span>{formatDate(item.createdAt)}</span>
                    </Flex>
                    <span>{item.wordCount} 字</span>
                  </Flex>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* 70vw 宽屏舒适白底 查看与采纳历史版本 Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={() => setPreviewModalOpened(false)}
        title={
          activeItem && (
            <Flex align="center" gap={10}>
              <FiFileText color="#00c9ff" size={18} />
              <Text fw={700} fz={16} c="#0f172a">
                {activeItem.title}
              </Text>
              {getModeBadge(activeItem.mode)}
              <Badge color="gray" variant="light" size="sm">
                {activeItem.wordCount} 字
              </Badge>
              <Text fz={12} c="#94a3b8">
                生成于 {formatDate(activeItem.createdAt)}
              </Text>
            </Flex>
          )
        }
        centered
        size="70vw"
        radius="md"
      >
        {activeItem && (
          <Stack gap="16px">
            {activeItem.promptSummary && (
              <Box p="10px 14px" bg="#f8fafc" style={{ borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <Text fz={12} fw={700} c="#475569" mb={2}>
                  当时生成诉求与大纲背景：
                </Text>
                <Text fz={13} c="#334155">
                  {activeItem.promptSummary}
                </Text>
              </Box>
            )}

            <Paper
              p="20px 24px"
              bg="#ffffff"
              withBorder
              radius="md"
              style={{
                maxHeight: "55vh",
                overflowY: "auto",
                lineHeight: 1.9,
                fontSize: 16,
                letterSpacing: "0.3px",
                color: "#1e293b",
                whiteSpace: "pre-wrap",
                fontFamily: `-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif`,
              }}
            >
              {activeItem.content}
            </Paper>

            <Flex justify="space-between" align="center" mt={6}>
              <Button
                variant="subtle"
                color="red"
                size="sm"
                leftSection={<FiTrash2 size={14} />}
                onClick={() => handleDelete(activeItem.id)}
              >
                删除此版本
              </Button>

              <Group gap={10}>
                <Button
                  variant="default"
                  size="sm"
                  leftSection={<FiCopy size={14} />}
                  onClick={() => handleCopy(activeItem.content)}
                >
                  {copied ? "已复制全文" : "复制正文"}
                </Button>

                <Button
                  color="cyan"
                  size="sm"
                  leftSection={<FiCheck size={14} />}
                  onClick={() => handleApply(activeItem.content)}
                >
                  采纳此版本填入正文
                </Button>
              </Group>
            </Flex>
          </Stack>
        )}
      </Modal>
    </>
  );
}
