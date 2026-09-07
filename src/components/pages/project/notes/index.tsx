// 组件：灵感随笔与小说笔记系统（左侧树状菜单 + Splitter 拖拽调节 + 沉浸式编辑区）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import { NoteData, NoteListResult, getNoteList, createNote, updateNote, deleteNote } from "@/rest/project-extensions";
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

  const handleCreateNewNote = async (category: string = "idea") => {
    if (!workId) return;
    try {
      setSaving(true);
      const res = await createNote({
        workId: Number(workId),
        title: "未命名灵感随笔",
        content: "",
        category: category || "idea",
      });

      if (res && res.success && res.result) {
        await fetchNotes();
        setActiveNote(res.result);
      }
    } catch (e: any) {
      alert("创建笔记失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async () => {
    if (!activeNote) return;
    const nextPin = !activeNote.isPinned;
    try {
      await updateNote({ id: activeNote.id, isPinned: nextPin });
      setActiveNote((prev) => (prev ? { ...prev, isPinned: nextPin } : null));
      await fetchNotes();
    } catch (e: any) {
      alert("操作失败: " + (e?.message || "网络异常"));
    }
  };

  const handleToggleArchive = async () => {
    if (!activeNote) return;
    const nextArchive = !activeNote.isArchived;
    try {
      await updateNote({ id: activeNote.id, isArchived: nextArchive });
      setActiveNote(null);
      await fetchNotes();
    } catch (e: any) {
      alert("操作失败: " + (e?.message || "网络异常"));
    }
  };

  const handleDelete = async () => {
    if (!activeNote) return;
    if (confirm("确定要删除这条笔记吗？此操作不可撤销。")) {
      try {
        await deleteNote(activeNote.id);
        setActiveNote(null);
        await fetchNotes();
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
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
            onCreateNewNote={handleCreateNewNote}
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
    </Box>
  );
}
