// 组件：灵感随笔与小说笔记系统（三栏工作台整合调度：分类导航、列表流与沉浸编辑区）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import { NoteData, NoteListResult, getNoteList, createNote, updateNote, deleteNote } from "@/rest/project-extensions";
import CategorySidebar from "./category-sidebar";
import NotesList from "./notes-list";
import NoteEditor from "./note-editor";

export default function NotesPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [counts, setCounts] = useState({ all: 0, idea: 0, plot: 0, character: 0, world: 0, research: 0, archived: 0 });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchKey, setSearchKey] = useState("");
  const [activeNote, setActiveNote] = useState<NoteData | null>(null);

  const fetchNotes = async (categoryToFetch = selectedCategory, keyword = searchKey) => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getNoteList(workId, categoryToFetch, keyword);
      if (res && res.success && res.result) {
        const resultData = res.result as NoteListResult;
        const list = Array.isArray(resultData.list) ? resultData.list : [];
        setNotes(list);
        if (resultData.counts) {
          setCounts(resultData.counts);
        }

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
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes(selectedCategory, searchKey);
  }, [workId, selectedCategory]);

  const handleCreateNewNote = async () => {
    if (!workId) return;
    try {
      setSaving(true);
      const newCategory = selectedCategory !== "all" && selectedCategory !== "archived" ? selectedCategory : "idea";
      const res = await createNote({
        workId: Number(workId),
        title: "未命名灵感笔记",
        content: "",
        category: newCategory,
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
      }}
    >
      <LoadingOverlay visible={loading && notes.length === 0} />

      <CategorySidebar
        selectedCategory={selectedCategory}
        counts={counts}
        onSelectCategory={setSelectedCategory}
        onCreateNewNote={handleCreateNewNote}
      />

      <NotesList
        category={selectedCategory}
        notes={notes}
        activeNoteId={activeNote?.id || null}
        searchKey={searchKey}
        loading={loading}
        onSearchChange={(val) => {
          setSearchKey(val);
          fetchNotes(selectedCategory, val);
        }}
        onSelectNote={(n) => setActiveNote(n)}
      />

      <NoteEditor
        workId={workId}
        activeNote={activeNote}
        saving={saving}
        onUpdateSuccess={() => fetchNotes()}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onDelete={handleDelete}
      />
    </Box>
  );
}
