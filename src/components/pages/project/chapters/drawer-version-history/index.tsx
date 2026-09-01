// 组件：章节修改版本历史抽屉（30vw 侧边抽屉、时间倒序版本快照列表与纯文本查看弹窗）
"use client";

import React, { useState, useEffect } from "react";
import { Drawer, Box, Text, Button, ActionIcon, Group, Stack, Paper, ScrollArea, LoadingOverlay, Modal, Badge } from "@mantine/core";
import { FiClock, FiFileText, FiTrash2, FiRotateCcw, FiCopy, FiCheck } from "react-icons/fi";
import { ChapterVersionItem, getChapterVersionList, deleteChapterVersion } from "@/rest/chapter";

interface DrawerVersionHistoryProps {
  opened: boolean;
  onClose: () => void;
  chapterId: number | string;
  onRestoreVersion: (content: string) => void;
}

export default function DrawerVersionHistory({
  opened,
  onClose,
  chapterId,
  onRestoreVersion,
}: DrawerVersionHistoryProps) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<ChapterVersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ChapterVersionItem | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchVersions = async () => {
    if (!chapterId || !opened) return;
    try {
      setLoading(true);
      const res = await getChapterVersionList(chapterId);
      if (res && res.success && Array.isArray(res.result)) {
        setVersions(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      fetchVersions();
    }
  }, [opened, chapterId]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该历史版本快照吗？")) {
      const res = await deleteChapterVersion(id);
      if (res && res.success) {
        setVersions((prev) => prev.filter((v) => v.id !== id));
        if (selectedVersion?.id === id) {
          setSelectedVersion(null);
        }
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatTime = (time: string | number) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="30vw"
        title={
          <Group gap={6} align="center">
            <FiClock size={16} color="#0284c7" />
            <Text fw={700} fz={15} c="#1e293b">章节修改版本历史</Text>
          </Group>
        }
        styles={{
          content: { minWidth: 320 },
          body: { height: "calc(100vh - 60px)", padding: "12px 16px", display: "flex", flexDirection: "column" },
        }}
      >
        <Box pos="relative" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <LoadingOverlay visible={loading} />

          {versions.length === 0 && !loading ? (
            <Stack align="center" justify="center" p={40} c="#94a3b8" gap={8} style={{ flex: 1 }}>
              <FiFileText size={36} strokeWidth={1.2} />
              <Text fz={13} fw={600}>暂无版本快照</Text>
              <Text fz={11.5} ta="center">每次在正文编辑区点击「保存」按钮时，系统会自动记录一份纯文本修改快照</Text>
            </Stack>
          ) : (
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap={8}>
                {versions.map((ver, idx) => (
                  <Paper
                    key={ver.id}
                    p="10px 12px"
                    radius="md"
                    withBorder
                    bg="#fafbfc"
                    style={{
                      cursor: "pointer",
                      borderColor: "#e2e8f0",
                      transition: "border-color 0.15s ease",
                    }}
                    onClick={() => setSelectedVersion(ver)}
                  >
                    <Group justify="space-between" align="center" mb={4}>
                      <Group gap={6}>
                        <Badge size="xs" color="gray" variant="filled">v{versions.length - idx}</Badge>
                        <Text fz={12.5} fw={600} c="#1e293b" truncate="end" style={{ maxWidth: 140 }}>
                          {ver.title}
                        </Text>
                      </Group>
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => handleDelete(ver.id, e)}>
                        <FiTrash2 size={12} />
                      </ActionIcon>
                    </Group>

                    <Text fz={11.5} c="#64748b" lineClamp={2} style={{ lineHeight: 1.4, marginBottom: 6 }}>
                      {ver.content || "（空白内容）"}
                    </Text>

                    <Group justify="space-between" align="center" fz={10.5} c="#94a3b8">
                      <Text fz={10.5}>{formatTime(ver.createdAt)}</Text>
                      <Text fz={10.5}>字数：{ver.wordCount} 字</Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Box>
      </Drawer>

      <Modal
        opened={Boolean(selectedVersion)}
        onClose={() => setSelectedVersion(null)}
        title={
          <Group gap={6} align="center">
            <FiFileText size={16} color="#0284c7" />
            <Text fw={700} fz={15}>
              版本快照纯文本详情 ({selectedVersion?.wordCount || 0} 字)
            </Text>
          </Group>
        }
        size="lg"
        centered
        radius="md"
      >
        <Stack gap="md">
          <Paper p="md" bg="#f8fafc" withBorder radius="md" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <Text fz={13.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {selectedVersion?.content}
            </Text>
          </Paper>

          <Group justify="space-between" align="center">
            <Text fz={11.5} c="#94a3b8">
              保存时间：{selectedVersion ? formatTime(selectedVersion.createdAt) : ""}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                leftSection={copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
                onClick={() => selectedVersion && handleCopy(selectedVersion.content)}
              >
                {copied ? "已复制" : "复制纯文本"}
              </Button>
              <Button
                size="xs"
                color="cyan"
                leftSection={<FiRotateCcw size={12} />}
                onClick={() => {
                  if (selectedVersion) {
                    if (confirm("确定要将当前章节正文恢复为该版本的内容吗？")) {
                      onRestoreVersion(selectedVersion.content);
                      setSelectedVersion(null);
                      onClose();
                    }
                  }
                }}
              >
                恢复此版本
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
