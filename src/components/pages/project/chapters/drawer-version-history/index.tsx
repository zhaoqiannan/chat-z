// 组件：章节修改版本历史抽屉（极简线条列表、纯文本快照弹窗与一键回滚）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Drawer, Badge, ActionIcon, Stack, ScrollArea, Modal, LoadingOverlay, Group } from "@mantine/core";
import { FiClock, FiRotateCcw, FiCopy, FiCheck, FiTrash2, FiFileText } from "react-icons/fi";
import { ChapterVersionItem, getChapterVersionList, deleteChapterVersion } from "@/rest/chapter";

interface DrawerVersionHistoryProps {
  opened: boolean;
  onClose: () => void;
  chapterId: number | string | null;
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
    if (!chapterId) return;
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
    if (opened && chapterId) {
      fetchVersions();
    }
  }, [opened, chapterId]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该历史版本快照吗？")) {
      try {
        await deleteChapterVersion(id);
        setVersions((prev) => prev.filter((v) => v.id !== id));
        if (selectedVersion?.id === id) {
          setSelectedVersion(null);
        }
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络错误"));
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
            <FiClock size={15} color="#0284c7" />
            <Text fw={700} fz={14} c="#1e293b">修改版本历史</Text>
          </Group>
        }
        styles={{
          content: { minWidth: 300 },
          header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
          body: { height: "calc(100vh - 60px)", padding: "12px 14px", display: "flex", flexDirection: "column" },
        }}
      >
        <Box pos="relative" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <LoadingOverlay visible={loading} />

          {versions.length === 0 && !loading ? (
            <Stack align="center" justify="center" p={40} c="#94a3b8" gap={6} style={{ flex: 1 }}>
              <FiFileText size={32} strokeWidth={1.2} />
              <Text fz={13} fw={600}>暂无版本快照</Text>
              <Text fz={11} ta="center">每次在正文编辑区点击「保存」按钮时，系统会自动记录一份纯文本修改快照</Text>
            </Stack>
          ) : (
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap={6}>
                {versions.map((ver, idx) => (
                  <Box
                    key={ver.id}
                    p="8px 10px"
                    style={{
                      cursor: "pointer",
                      border: "1px solid #f1f5f9",
                      borderRadius: 4,
                      backgroundColor: "#ffffff",
                      transition: "border-color 0.15s ease",
                    }}
                    onClick={() => setSelectedVersion(ver)}
                  >
                    <Group justify="space-between" align="center" mb={4}>
                      <Group gap={6}>
                        <Badge size="xs" color="gray" variant="outline" styles={{ root: { height: 16, fontSize: 10 } }}>
                          v{versions.length - idx}
                        </Badge>
                        <Text fz={12} fw={600} c="#1e293b" truncate="end" style={{ maxWidth: 140 }}>
                          {ver.title}
                        </Text>
                      </Group>
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => handleDelete(ver.id, e)}>
                        <FiTrash2 size={11} />
                      </ActionIcon>
                    </Group>

                    <Text fz={11} c="#64748b" lineClamp={2} style={{ lineHeight: 1.4, marginBottom: 4 }}>
                      {ver.content || "（空白内容）"}
                    </Text>

                    <Group justify="space-between" align="center" fz={10} c="#94a3b8">
                      <Text fz={10}>{formatTime(ver.createdAt)}</Text>
                      <Text fz={10}>{ver.wordCount} 字</Text>
                    </Group>
                  </Box>
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
            <FiFileText size={15} color="#0284c7" />
            <Text fw={700} fz={14} c="#0f172a">
              版本快照纯文本 ({selectedVersion?.wordCount || 0} 字)
            </Text>
          </Group>
        }
        size="lg"
        centered
        radius="sm"
        styles={{
          header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
          body: { paddingTop: 14 },
        }}
      >
        <Stack gap="sm">
          <Box p="12px 14px" style={{ maxHeight: "55vh", overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 4, backgroundColor: "#fafbfc" }}>
            <Text fz={13} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {selectedVersion?.content}
            </Text>
          </Box>

          <Flex justify="space-between" align="center" pt={8} style={{ borderTop: "1px solid #f1f5f9" }}>
            <Text fz={11} c="#94a3b8">
              保存时间：{selectedVersion ? formatTime(selectedVersion.createdAt) : ""}
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                leftSection={copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
                onClick={() => selectedVersion && handleCopy(selectedVersion.content)}
              >
                {copied ? "已复制" : "复制纯文本"}
              </Button>
              <Button
                size="xs"
                color="cyan"
                leftSection={<FiRotateCcw size={11} />}
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
                恢复此版本正文
              </Button>
            </Group>
          </Flex>
        </Stack>
      </Modal>
    </>
  );
}
