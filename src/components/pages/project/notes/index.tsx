"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Text,
  Button,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  SegmentedControl,
  Group,
  Card,
  ScrollArea,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiCheckSquare,
  FiSquare,
  FiSearch,
  FiEdit3,
} from "react-icons/fi";
import {
  NoteData,
  getNoteList,
  createNote,
  updateNote,
  deleteNote,
} from "@/rest/project-extensions";

export default function NotesPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<NoteData[]>([]);
  const [filterMode, setFilterMode] = useState<string>("all");
  const [searchKey, setSearchKey] = useState("");

  // Modal 状态
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<NoteData | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 表单状态
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("memo");
  const [isTodo, setIsTodo] = useState(false);
  const [priority, setPriority] = useState("medium");

  const fetchNotes = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getNoteList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取笔记失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle("");
    setContent("");
    setCategory("memo");
    setIsTodo(false);
    setPriority("medium");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: NoteData) => {
    setEditingItem(item);
    setTitle(item.title || "");
    setContent(item.content || "");
    setCategory(item.category || "memo");
    setIsTodo(Boolean(item.isTodo));
    setPriority(item.priority || "medium");
    setModalOpened(true);
  };

  const handleToggleComplete = async (item: NoteData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateNote({
        id: item.id,
        isCompleted: item.isCompleted ? 0 : 1,
      });
      await fetchNotes();
    } catch (e: any) {
      console.error("更新状态失败", e);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("请输入便签标题！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateNote({
          id: editingItem.id,
          title: title.trim(),
          content: content.trim() || undefined,
          category,
          isTodo: isTodo ? 1 : 0,
          priority,
        });
      } else {
        await createNote({
          workId: Number(workId),
          title: title.trim(),
          content: content.trim() || undefined,
          category,
          isTodo: isTodo ? 1 : 0,
          priority,
        });
      }
      setModalOpened(false);
      await fetchNotes();
    } catch (e: any) {
      alert("保存笔记失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("确定要删除该笔记吗？")) {
      const res = await deleteNote(id);
      if (res && res.success) {
        await fetchNotes();
      }
    }
  };

  const filteredList = list.filter((item) => {
    const matchSearch =
      !searchKey ||
      item.title.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.content && item.content.toLowerCase().includes(searchKey.toLowerCase()));

    if (filterMode === "todo") return matchSearch && item.isTodo && !item.isCompleted;
    if (filterMode === "completed") return matchSearch && item.isCompleted;
    if (filterMode === "idea") return matchSearch && item.category === "idea";
    if (filterMode === "memo") return matchSearch && item.category === "memo";
    return matchSearch;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "idea":
        return <Badge color="violet" variant="light" size="xs">💡 灵感</Badge>;
      case "plot":
        return <Badge color="orange" variant="light" size="xs">📖 伏笔</Badge>;
      case "character":
        return <Badge color="cyan" variant="light" size="xs">👤 人设</Badge>;
      case "world":
        return <Badge color="teal" variant="light" size="xs">🌍 设定</Badge>;
      default:
        return <Badge color="blue" variant="light" size="xs">📝 随笔</Badge>;
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "high":
        return <Badge color="red" variant="filled" size="xs">高优</Badge>;
      case "low":
        return <Badge color="gray" variant="light" size="xs">低</Badge>;
      default:
        return null;
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <ScrollArea style={{ flex: 1 }} p={{ base: "md", md: "xl" }}>
        <Group justify="space-between" align="center" mb="lg" wrap="wrap">
          <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 580 }}>
            <TextInput
              placeholder="搜索随笔、灵感或待办备忘..."
              leftSection={<FiSearch size={14} />}
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              style={{ flex: 1 }}
            />

            <SegmentedControl
              value={filterMode}
              onChange={setFilterMode}
              data={[
                { label: "全部", value: "all" },
                { label: "待办任务", value: "todo" },
                { label: "已完成", value: "completed" },
                { label: "灵感火花", value: "idea" },
                { label: "随笔备忘", value: "memo" },
              ]}
            />
          </Group>

          <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreate}>
            新建笔记
          </Button>
        </Group>

        <Box pos="relative" style={{ minHeight: 300 }}>
          <LoadingOverlay visible={loading} />

          {filteredList.length === 0 && !loading ? (
            <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
              <FiEdit3 size={40} strokeWidth={1.2} />
              <Text fz={15} fw={600}>暂无笔记备忘</Text>
              <Text fz={13}>点击右上角「新建笔记」记录你的创作随笔与待办计划</Text>
            </Stack>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
              {filteredList.map((item) => {
                const isDone = Boolean(item.isCompleted);
                return (
                  <Card
                    key={item.id}
                    shadow="sm"
                    radius="md"
                    withBorder
                    p="md"
                    onClick={() => handleOpenEdit(item)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      backgroundColor: isDone ? "var(--mantine-color-gray-0)" : "#ffffff",
                      opacity: isDone ? 0.7 : 1,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
                      <Group gap={6} align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                        {item.isTodo ? (
                          <ActionIcon
                            variant="subtle"
                            color={isDone ? "teal" : "gray"}
                            size="sm"
                            onClick={(e) => handleToggleComplete(item, e)}
                          >
                            {isDone ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}
                          </ActionIcon>
                        ) : null}

                        <Text
                          fz={15}
                          fw={700}
                          c={isDone ? "dimmed" : "dark.7"}
                          truncate="end"
                          style={{
                            textDecoration: isDone ? "line-through" : "none",
                          }}
                        >
                          {item.title}
                        </Text>
                      </Group>

                      <Group gap={4} align="center" wrap="nowrap">
                        {getPriorityBadge(item.priority)}
                        {getCategoryBadge(item.category)}
                      </Group>
                    </Group>

                    <Text
                      fz={13}
                      c={isDone ? "dimmed" : "dark.5"}
                      mb="md"
                      lineClamp={4}
                      style={{
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.6,
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {item.content || "（暂无具体内容）"}
                    </Text>

                    <Group justify="space-between" align="center" mt="auto" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                      <Text fz={11} c="dimmed">
                        {item.isTodo ? (isDone ? "✅ 已办" : "⏳ 待办") : "📝 随笔"}
                      </Text>

                      <Group gap={4}>
                        <ActionIcon variant="subtle" color="cyan" size="xs" onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}>
                          <FiEdit size={13} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" size="xs" onClick={(e) => handleDelete(item.id, e)}>
                          <FiTrash2 size={13} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Box>
      </ScrollArea>

      {/* 70vw 宽屏舒适创建/编辑笔记 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiEdit3 color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑笔记 - ${editingItem.title}` : "新建创作灵感 / 便签备忘"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="便签标题"
              placeholder="例如：第三卷伏笔：主角身世之谜"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Select
              label="分类标签"
              value={category}
              onChange={(v) => setCategory(v || "memo")}
              data={[
                { value: "memo", label: "📝 随笔备忘" },
                { value: "idea", label: "💡 灵感火花" },
                { value: "plot", label: "📖 剧情伏笔" },
                { value: "character", label: "👤 人设立意" },
                { value: "world", label: "🌍 世界观脑洞" },
              ]}
            />
            <Select
              label="优先级"
              value={priority}
              onChange={(v) => setPriority(v || "medium")}
              data={[
                { value: "high", label: "🔥 高优先级 (急需处理)" },
                { value: "medium", label: "🌿 普通优先级" },
                { value: "low", label: "☕ 低优先级 (灵感沉淀)" },
              ]}
            />
          </SimpleGrid>

          <Checkbox
            label="标记为待办任务 (可在卡片上勾选完成)"
            checked={isTodo}
            onChange={(e) => setIsTodo(e.currentTarget.checked)}
            color="cyan"
          />

          <Textarea
            label="便签详细内容"
            placeholder="写下你的突发奇想、段子、大纲要点或写作提醒..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={6}
            autosize
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认添加便签"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
