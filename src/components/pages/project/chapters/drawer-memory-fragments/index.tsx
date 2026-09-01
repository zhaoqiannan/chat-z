// 组件：记忆碎片灵感知识库抽屉（80vw 大屏抽屉、瀑布流文本 Card 滚动展示、插入正文与新建管理）
"use client";

import React, { useState, useEffect } from "react";
import { Drawer, Box, Flex, Text, Button, ActionIcon, Group, Stack, Card, ScrollArea, LoadingOverlay, Modal, TextInput, Textarea, Badge, SimpleGrid, Tooltip } from "@mantine/core";
import { FiBookmark, FiPlus, FiSearch, FiTrash2, FiCopy, FiCheck, FiCornerDownLeft, FiZap, FiEdit3 } from "react-icons/fi";
import { MemoryFragmentItem, getMemoryFragmentList, createMemoryFragment, deleteMemoryFragment } from "@/rest/chapter";

interface DrawerMemoryFragmentsProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  chapterId?: number | string;
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
  const [fragments, setFragments] = useState<MemoryFragmentItem[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFragments = async () => {
    if (!workId || !opened) return;
    try {
      setLoading(true);
      const res = await getMemoryFragmentList(workId, searchKey);
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
  }, [opened, workId, searchKey]);

  const handleCreateSubmit = async () => {
    if (!newContent.trim()) {
      alert("请输入记忆碎片内容！");
      return;
    }

    try {
      setSaving(true);
      const res = await createMemoryFragment({
        workId,
        chapterId,
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
        tags: newTags.trim() || undefined,
        sourceType: "manual",
      });

      if (res && res.success) {
        setCreateModalOpened(false);
        setNewTitle("");
        setNewContent("");
        setNewTags("");
        await fetchFragments();
      }
    } catch (e: any) {
      alert("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除这条记忆碎片吗？")) {
      const res = await deleteMemoryFragment(id);
      if (res && res.success) {
        setFragments((prev) => prev.filter((f) => f.id !== id));
      }
    }
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatTime = (time: string | number) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="80vw"
        title={
          <Group gap={8} align="center">
            <FiBookmark size={18} color="#0284c7" />
            <Text fw={700} fz={16} c="#1e293b">记忆碎片灵感库</Text>
            <Badge size="sm" variant="light" color="cyan">{fragments.length} 个碎片</Badge>
          </Group>
        }
        styles={{
          body: { height: "calc(100vh - 60px)", padding: "16px 24px", display: "flex", flexDirection: "column" },
        }}
      >
        <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Flex justify="space-between" align="center" mb="md" gap="md" wrap="wrap">
            <TextInput
              placeholder="搜索记忆碎片标题、正文、标签..."
              leftSection={<FiSearch size={14} />}
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              style={{ flex: 1, maxWidth: 400 }}
              size="sm"
            />
            <Button
              size="sm"
              color="cyan"
              leftSection={<FiPlus size={14} />}
              onClick={() => setCreateModalOpened(true)}
            >
              新建记忆碎片
            </Button>
          </Flex>

          <Box pos="relative" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <LoadingOverlay visible={loading} />

            {fragments.length === 0 && !loading ? (
              <Stack align="center" justify="center" p={60} c="#94a3b8" gap={8} style={{ flex: 1 }}>
                <FiBookmark size={44} strokeWidth={1.2} />
                <Text fz={15} fw={600}>暂无记忆碎片</Text>
                <Text fz={13}>可在 AI 协同助手的推演回答下方点击「存为碎片」，或点击右上角「新建记忆碎片」记录闪光灵感</Text>
              </Stack>
            ) : (
              <ScrollArea style={{ flex: 1 }}>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" pb="xl">
                  {fragments.map((frag) => (
                    <Card
                      key={frag.id}
                      p="md"
                      radius="md"
                      withBorder
                      bg="#ffffff"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        borderColor: "#e2e8f0",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <Group justify="space-between" align="center" mb={6}>
                        <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            size="xs"
                            variant="light"
                            color={frag.sourceType === "ai_chat" ? "teal" : "cyan"}
                            leftSection={frag.sourceType === "ai_chat" ? <FiZap size={9} /> : <FiEdit3 size={9} />}
                          >
                            {frag.sourceType === "ai_chat" ? "AI推演" : "灵感碎片"}
                          </Badge>
                          <Text fz={13} fw={700} c="#1e293b" truncate="end" style={{ flex: 1 }}>
                            {frag.title}
                          </Text>
                        </Group>
                        <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => handleDelete(frag.id, e)}>
                          <FiTrash2 size={12} />
                        </ActionIcon>
                      </Group>

                      <Box
                        p="xs"
                        bg="#f8fafc"
                        style={{
                          borderRadius: 6,
                          flex: 1,
                          minHeight: 100,
                          maxHeight: 220,
                          overflowY: "auto",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                          {frag.content}
                        </Text>
                      </Box>

                      {frag.tags && (
                        <Group gap={4} mt={8} wrap="wrap">
                          {frag.tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
                            <Badge key={idx} size="xs" variant="outline" color="gray">
                              #{t}
                            </Badge>
                          ))}
                        </Group>
                      )}

                      <Flex justify="space-between" align="center" mt="sm" pt={6} style={{ borderTop: "1px dashed #f1f5f9" }}>
                        <Text fz={11} c="#94a3b8">{formatTime(frag.createdAt)}</Text>
                        <Group gap={4}>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            leftSection={copiedId === frag.id ? <FiCheck size={11} /> : <FiCopy size={11} />}
                            onClick={() => handleCopy(frag.id, frag.content)}
                          >
                            {copiedId === frag.id ? "已复制" : "复制"}
                          </Button>
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="cyan"
                            leftSection={<FiCornerDownLeft size={11} />}
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
        title={<Text fw={700} fz={15}>新建记忆碎片</Text>}
        centered
        size="md"
        radius="md"
      >
        <Stack gap="sm">
          <TextInput
            label="碎片主题 (选填)"
            placeholder="例如：林晓月破解协议关键密码 / 万剑宗伏笔"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            label="碎片正文内容"
            placeholder="在此记录闪光灵感、重要台词、伏笔细节或设定片段..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            minRows={5}
            autosize
            required
          />
          <TextInput
            label="标签 (选填，空格或逗号分隔)"
            placeholder="例如：科技设定 伏笔 决战"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />
          <Group justify="flex-end" gap="xs" mt="sm">
            <Button variant="outline" color="gray" onClick={() => setCreateModalOpened(false)}>取消</Button>
            <Button color="cyan" loading={saving} onClick={handleCreateSubmit}>确认保存碎片</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
