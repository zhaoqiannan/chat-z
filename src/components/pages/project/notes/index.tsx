"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Flex,
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
  Paper,
  Group,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiCheckSquare,
  FiSquare,
  FiSearch,
  FiEdit3,
  FiCheckCircle,
  FiClock,
  FiTag,
} from "react-icons/fi";
import {
  NoteData,
  getNoteList,
  createNote,
  updateNote,
  deleteNote,
} from "@/rest/project-extensions";
import styles from "./style.module.scss";

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
    const nextCompleted = item.isCompleted ? 0 : 1;
    await updateNote({ id: item.id, isCompleted: nextCompleted });
    await fetchNotes();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("笔记标题不能为空");
      return;
    }
    try {
      setFormLoading(true);
      if (editingItem) {
        await updateNote({
          id: editingItem.id,
          title: title.trim(),
          content: content.trim(),
          category,
          isTodo: isTodo ? 1 : 0,
          priority,
        });
      } else {
        await createNote({
          workId: Number(workId),
          title: title.trim(),
          content: content.trim(),
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
    if (confirm("确定要删除这条笔记吗？")) {
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
      item.content.toLowerCase().includes(searchKey.toLowerCase());

    let matchFilter = true;
    if (filterMode === "todo") matchFilter = Boolean(item.isTodo && !item.isCompleted);
    if (filterMode === "completed") matchFilter = Boolean(item.isTodo && item.isCompleted);
    if (filterMode === "memo") matchFilter = item.category === "memo";
    if (filterMode === "idea") matchFilter = item.category === "idea";

    return matchSearch && matchFilter;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "idea":
        return <Badge color="violet" variant="light" size="xs">💡 灵感</Badge>;
      case "todo":
        return <Badge color="orange" variant="light" size="xs">📌 待办</Badge>;
      case "outline_ref":
        return <Badge color="cyan" variant="light" size="xs">📖 备忘</Badge>;
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
    <Box className={styles.container}>
      <Flex justify="space-between" align="center" mb={16} gap={12} wrap="wrap">
        <Flex gap={12} align="center" style={{ flex: 1, maxWidth: 580 }}>
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
        </Flex>

        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
          新建笔记
        </Button>
      </Flex>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiEdit3 size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无笔记备忘</Text>
            <Text fz={13}>点击右上角「新建笔记」记录你的创作随笔与待办计划</Text>
          </Flex>
        ) : (
          <div className={styles.cardGrid}>
            {filteredList.map((item) => {
              const isDone = Boolean(item.isCompleted);
              return (
                <div
                  key={item.id}
                  className={`${styles.noteCard} ${isDone ? styles.completed : ""}`}
                  onClick={() => handleOpenEdit(item)}
                >
                  <Flex justify="space-between" align="center" mb={8}>
                    <Flex align="center" gap={6}>
                      {item.isTodo ? (
                        <ActionIcon
                          variant="subtle"
                          color={isDone ? "green" : "gray"}
                          size="sm"
                          onClick={(e) => handleToggleComplete(item, e)}
                        >
                          {isDone ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}
                        </ActionIcon>
                      ) : null}

                      <Text
                        fz={15}
                        fw={700}
                        c="#1e293b"
                        style={{
                          textDecoration: isDone ? "line-through" : "none",
                          color: isDone ? "#94a3b8" : "#1e293b",
                        }}
                      >
                        {item.title}
                      </Text>
                    </Flex>

                    <Flex gap={4} align="center">
                      {getPriorityBadge(item.priority)}
                      {getCategoryBadge(item.category)}
                    </Flex>
                  </Flex>

                  <Text
                    fz={13}
                    c="#475569"
                    mb={12}
                    lineClamp={4}
                    style={{
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                      textDecoration: isDone ? "line-through" : "none",
                      color: isDone ? "#94a3b8" : "#475569",
                    }}
                  >
                    {item.content || "（暂无具体内容）"}
                  </Text>

                  <Flex justify="space-between" align="center" mt="auto" pt={8} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <Text fz={11} c="#94a3b8">
                      {item.isTodo ? (isDone ? "✅ 已办" : "⏳ 待办") : "📝 随笔"}
                    </Text>

                    <Flex gap={4}>
                      <ActionIcon variant="subtle" color="blue" size="xs" onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}>
                        <FiEdit size={13} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" size="xs" onClick={(e) => handleDelete(item.id, e)}>
                        <FiTrash2 size={13} />
                      </ActionIcon>
                    </Flex>
                  </Flex>
                </div>
              );
            })}
          </div>
        )}
      </Box>

      {/* 70vw 宽屏舒适编辑/创建笔记 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiEdit3 color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑笔记 - ${editingItem.title}` : "新建随笔与待办备忘"}
            </Text>
          </Flex>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="16px">
          <SimpleGrid cols={3}>
            <TextInput
              label="笔记标题"
              placeholder="例如：关于反派身世的突然灵感..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ gridColumn: "span 2" }}
            />

            <Select
              label="笔记分类"
              value={category}
              onChange={(val) => setCategory(val || "memo")}
              data={[
                { value: "memo", label: "📝 随笔杂记" },
                { value: "idea", label: "💡 灵感火花" },
                { value: "todo", label: "📌 待办任务" },
                { value: "outline_ref", label: "📖 剧情备忘" },
              ]}
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <Checkbox
              label="标记为待办任务清单 (支持一键勾选完成)"
              checked={isTodo}
              onChange={(e) => setIsTodo(e.currentTarget.checked)}
              mt={8}
            />

            <Select
              label="优先级"
              value={priority}
              onChange={(val) => setPriority(val || "medium")}
              data={[
                { value: "high", label: "🔥 高优紧急" },
                { value: "medium", label: "⚡ 中等常规" },
                { value: "low", label: "☕ 较低随缘" },
              ]}
            />
          </SimpleGrid>

          <Textarea
            label="笔记正文内容"
            placeholder="随时记录下脑海中的细枝末节、剧情推演与备忘待办..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            minRows={7}
            required
          />

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
