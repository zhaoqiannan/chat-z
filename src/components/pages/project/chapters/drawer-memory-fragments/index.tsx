// 组件：记忆碎片灵感知识库抽屉（极简线条卡片流、正文插入与新建碎片弹窗）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Drawer, Badge, ActionIcon, Stack, SimpleGrid, Card, ScrollArea, Modal, TextInput, Textarea, LoadingOverlay, Group } from "@mantine/core";
import { FiBookmark, FiPlus, FiTrash2, FiCopy, FiCheck, FiCornerDownLeft, FiZap, FiEdit3 } from "react-icons/fi";
import { MemoryFragmentItem, getMemoryFragmentList, createMemoryFragment, deleteMemoryFragment } from "@/rest/chapter";

interface DrawerMemoryFragmentsProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  chapterId?: number | string | null;
  onInsertToContent: (text: string) => void;
}

export default function DrawerMemoryFragments({
  opened,
  onClose,
  workId,
  chapterId,
  onInsertToContent,
}: DrawerMemoryFragmentsProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fragments, setFragments] = useState<MemoryFragmentItem[]>([]);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  const fetchFragments = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getMemoryFragmentList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setFragments(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      fetchFragments();
    }
  }, [opened, workId]);

  const handleCreateSubmit = async () => {
    if (!newContent.trim()) {
      alert("碎片内容不能为空");
      return;
    }

    try {
      setSaving(true);
      const res = await createMemoryFragment({
        workId,
        chapterId: chapterId ? Number(chapterId) : undefined,
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
        tags: newTags.trim() || undefined,
        sourceType: "custom",
      });

      if (res && res.success) {
        setCreateModalOpened(false);
        setNewTitle("");
        setNewContent("");
        setNewTags("");
        fetchFragments();
      }
    } catch (e: any) {
      alert("保存碎片失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除这条记忆碎片吗？")) {
      try {
        await deleteMemoryFragment(id);
        setFragments((prev) => prev.filter((f) => f.id !== id));
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const handleCopy = (id: number, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const d = new Date(time);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="75vw"
        title={
          <Group gap={8} align="center">
            <FiBookmark size={15} color="#0284c7" />
            <Text fw={700} fz={15} c="#1e293b">记忆碎片灵感库</Text>
            <Badge size="xs" color="gray" variant="outline" styles={{ root: { borderColor: "#e2e8f0" } }}>
              {fragments.length} 条碎片
            </Badge>
          </Group>
        }
        styles={{
          content: { minWidth: 600 },
          header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
          body: { height: "calc(100vh - 60px)", padding: "16px 20px", display: "flex", flexDirection: "column" },
        }}
      >
        <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Flex justify="space-between" align="center" mb="md">
            <Text fz={12} c="#64748b">
              记录大纲、推演灵感或 AI 协同助手的闪光片段，随时一键插入到正在写作的章节中
            </Text>
            <Button
              size="xs"
              color="cyan"
              leftSection={<FiPlus size={12} />}
              onClick={() => setCreateModalOpened(true)}
            >
              新建记忆碎片
            </Button>
          </Flex>

          <Box pos="relative" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <LoadingOverlay visible={loading} />

            {fragments.length === 0 && !loading ? (
              <Stack align="center" justify="center" p={60} c="#94a3b8" gap={6} style={{ flex: 1 }}>
                <FiBookmark size={36} strokeWidth={1.2} />
                <Text fz={14} fw={600}>暂无记忆碎片</Text>
                <Text fz={12}>可在 AI 助手的回答下方点击「存为碎片」，或点击右上角「新建记忆碎片」</Text>
              </Stack>
            ) : (
              <ScrollArea style={{ flex: 1 }}>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm" pb="xl">
                  {fragments.map((frag) => (
                    <Card
                      key={frag.id}
                      p="10px 12px"
                      radius="sm"
                      withBorder
                      bg="#ffffff"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        borderColor: "#f1f5f9",
                      }}
                    >
                      <Group justify="space-between" align="center" mb={6}>
                        <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            size="xs"
                            variant="outline"
                            color={frag.sourceType === "ai_chat" ? "teal" : "cyan"}
                            styles={{ root: { height: 16, fontSize: 9.5 } }}
                          >
                            {frag.sourceType === "ai_chat" ? "AI推演" : "灵感碎片"}
                          </Badge>
                          <Text fz={12.5} fw={700} c="#1e293b" truncate="end" style={{ flex: 1 }}>
                            {frag.title}
                          </Text>
                        </Group>
                        <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => handleDelete(frag.id, e)}>
                          <FiTrash2 size={11} />
                        </ActionIcon>
                      </Group>

                      <Text fz={12} c="#334155" lineClamp={6} style={{ lineHeight: 1.6, flex: 1, marginBottom: 8, whiteSpace: "pre-wrap" }}>
                        {frag.content}
                      </Text>

                      {frag.tags && (
                        <Group gap={4} mb={6} wrap="wrap">
                          {frag.tags.split(/[,，\s]+/).filter(Boolean).map((tag, idx) => (
                            <Badge key={idx} size="xs" variant="outline" color="gray" styles={{ root: { fontSize: 9.5, height: 16, borderColor: "#f1f5f9" } }}>
                              #{tag}
                            </Badge>
                          ))}
                        </Group>
                      )}

                      <Flex justify="space-between" align="center" pt={6} style={{ borderTop: "1px solid #f8fafc" }}>
                        <Text fz={10} c="#94a3b8">{formatTime(frag.createdAt)}</Text>
                        <Group gap={4}>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color={copiedId === frag.id ? "teal" : "gray"}
                            onClick={() => handleCopy(frag.id, frag.content)}
                          >
                            {copiedId === frag.id ? <FiCheck size={11} /> : <FiCopy size={11} />}
                          </ActionIcon>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="cyan"
                            leftSection={<FiCornerDownLeft size={10} />}
                            onClick={() => {
                              onInsertToContent(frag.content);
                              onClose();
                            }}
                          >
                            插入章节
                          </Button>
                        </Group>
                      </Flex>
                    </Card>
                  ))}
                </SimpleGrid>
              </ScrollArea>
            )}
          </Box>
        </Box>
      </Drawer>

      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title={<Text fw={700} fz={15} c="#0f172a">新建记忆碎片</Text>}
        centered
        size="md"
        radius="sm"
        styles={{
          header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
          body: { paddingTop: 14 },
        }}
      >
        <Stack gap="xs">
          <TextInput
            label="碎片主题 (选填)"
            placeholder="例如：林晓月破解协议密码 / 伏笔"
            size="xs"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            label="碎片正文内容"
            placeholder="在此记录闪光灵感、重要台词、伏笔细节或设定片段..."
            size="xs"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            minRows={5}
            autosize
            required
          />
          <TextInput
            label="标签 (选填，空格或逗号分隔)"
            placeholder="例如：科技设定 伏笔 决战"
            size="xs"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />
          <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
            <Button variant="default" size="xs" onClick={() => setCreateModalOpened(false)}>取消</Button>
            <Button color="cyan" size="xs" loading={saving} onClick={handleCreateSubmit}>确认保存碎片</Button>
          </Flex>
        </Stack>
      </Modal>
    </>
  );
}
