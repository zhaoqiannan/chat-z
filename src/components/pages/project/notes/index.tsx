// 组件：灵感随笔与小说笔记系统（左侧树状菜单 + Splitter 拖拽调节 + 沉浸式编辑区）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay, Modal, TextInput, Select, Button, Group, Stack, Text } from "@mantine/core";
import { NoteData, NoteListResult, getNoteList, createNote, updateNote, deleteNote } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import NoteTreeMenu from "./note-tree-menu";
import NoteSplitter from "./splitter";
import NoteEditor from "./note-editor";

export default function NotesPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [activeNote, setActiveNote] = useState<NoteData | null>(null);

  // 侧边树状菜单宽度与折叠状态
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 新建笔记弹窗状态
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("idea");
  const [titleError, setTitleError] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchNotes = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getNoteList(workId, "all", "");
      if (res && res.success && res.result) {
        const resultData = res.result as NoteListResult;
        const list = Array.isArray(resultData.list) ? resultData.list : [];
        setNotes(list);

        if (activeNote) {
          const matched = list.find((n) => n.id === activeNote.id);
          setActiveNote(matched || (list.length > 0 ? list[0] : null));
        } else if (list.length > 0) {
          setActiveNote(list[0]);
        } else {
          setActiveNote(null);
        }
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

  const handleOpenCreateModal = (category: string = "idea") => {
    setNewNoteCategory(category && category !== "archived" ? category : "idea");
    setNewNoteTitle("");
    setTitleError("");
    setCreateModalOpened(true);
  };

  const handleConfirmCreate = async () => {
    const trimmedTitle = newNoteTitle.trim();
    if (!trimmedTitle) {
      setTitleError("请输入笔记名称");
      return;
    }
    if (!workId) return;

    try {
      setCreating(true);
      const res = await createNote({
        workId: Number(workId),
        title: trimmedTitle,
        content: "",
        category: newNoteCategory || "idea",
      });

      if (res && res.success && res.result) {
        useAlert.success("笔记创建成功！");
        setCreateModalOpened(false);
        await fetchNotes();
        setActiveNote(res.result);
      }
    } catch (e: any) {
      useAlert.error("创建笔记失败: " + (e?.message || "网络异常"));
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePin = async () => {
    if (!activeNote) return;
    const nextPin = !activeNote.isPinned;
    try {
      await updateNote({ id: activeNote.id, isPinned: nextPin });
      setActiveNote((prev) => (prev ? { ...prev, isPinned: nextPin ? 1 : 0 } : null));
      useAlert.success(nextPin ? "已置顶笔记" : "已取消置顶");
      await fetchNotes();
    } catch (e: any) {
      useAlert.error("操作失败: " + (e?.message || "网络异常"));
    }
  };

  const handleToggleArchive = async () => {
    if (!activeNote) return;
    const nextArchive = !activeNote.isArchived;
    try {
      await updateNote({ id: activeNote.id, isArchived: nextArchive });
      setActiveNote((prev) => (prev ? { ...prev, isArchived: nextArchive ? 1 : 0 } : null));
      useAlert.success(nextArchive ? "已归档，可在左侧「归档备忘」中查看" : "已取消归档");
      await fetchNotes();
    } catch (e: any) {
      useAlert.error("操作失败: " + (e?.message || "网络异常"));
    }
  };

  const handleDelete = async (targetNote?: NoteData | null) => {
    const noteToDelete = targetNote || activeNote;
    if (!noteToDelete) return;
    const isConfirmed = await showConfirm({
      title: "删除笔记",
      message: `确定要删除笔记「${noteToDelete.title || "未命名笔记"}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deleteNote(noteToDelete.id);
        if (activeNote?.id === noteToDelete.id) {
          setActiveNote(null);
        }
        useAlert.success("笔记已删除");
        await fetchNotes();
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  return (
    <Box
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <LoadingOverlay visible={loading && notes.length === 0} />

      {/* 1. 左侧树状菜单 */}
      {!sidebarCollapsed && (
        <Box
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            maxWidth: sidebarWidth,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <NoteTreeMenu
            notes={notes}
            activeNoteId={activeNote?.id || null}
            loading={loading}
            onSelectNote={(n) => setActiveNote(n)}
            onCreateNewNote={handleOpenCreateModal}
            onDeleteNote={(n) => handleDelete(n)}
          />
        </Box>
      )}

      {/* 2. Splitter 拖拽调节器 */}
      <NoteSplitter
        width={sidebarWidth}
        onResize={setSidebarWidth}
        minWidth={220}
        maxWidth={480}
        defaultWidth={280}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 3. 右侧沉浸式编辑与多维实体转换区 */}
      <NoteEditor
        workId={workId}
        activeNote={activeNote}
        saving={saving}
        categorySidebarCollapsed={sidebarCollapsed}
        onToggleCategorySidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onUpdateSuccess={fetchNotes}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onDelete={handleDelete}
      />

      {/* 新建笔记弹窗 */}
      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title={<Text fw={700} fz={15}>新建笔记</Text>}
        centered
        radius="md"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="笔记名称"
            placeholder="请输入..."
            value={newNoteTitle}
            onChange={(e) => {
              setNewNoteTitle(e.target.value);
              if (titleError) setTitleError("");
            }}
            error={titleError}
            data-autofocus
            required
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmCreate();
              }
            }}
          />

          <Select
            label="所属分类"
            value={newNoteCategory}
            onChange={(val) => setNewNoteCategory(val || "idea")}
            data={[
              { value: "idea", label: "灵感脑洞" },
              { value: "plot", label: "大纲情节" },
              { value: "character", label: "角色随笔" },
              { value: "world", label: "世界设定" },
              { value: "research", label: "资料考据" },
              { value: "memo", label: "随想杂记" },
            ]}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setCreateModalOpened(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmCreate} loading={creating}>
              确定创建
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
