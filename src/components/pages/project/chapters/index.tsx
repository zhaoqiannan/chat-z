// 组件：小说章节创作工作台（三栏联动：极简目录树、沉浸式正文编辑区与右侧 AI 协同助手）
"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";
import { getChapterList, createChapter, updateChapter, deleteChapter, ChapterItem, CreateChapterPayload, UpdateChapterPayload } from "@/rest/chapter";
import TreePanel from "./tree-panel";
import EditorArea from "./editor-area";
import PanelAiAssistant from "./panel-ai-assistant";
import ModalChapterDetail from "./modal-chapter-detail";
import ModalCreateVolume from "./modal-create-volume";
import ModalCreateChapter from "./modal-create-chapter";

export default function ChaptersPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [rawList, setRawList] = useState<ChapterItem[]>([]);
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);

  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [selectedTextForAi, setSelectedTextForAi] = useState("");
  const [insertTextPayload, setInsertTextPayload] = useState<{ text: string; timestamp: number } | null>(null);

  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [modalDetailTarget, setModalDetailTarget] = useState<ChapterItem | null>(null);
  const [volumeModalOpened, setVolumeModalOpened] = useState(false);
  const [chapterModalOpened, setChapterModalOpened] = useState(false);
  const [createChapterVolumeId, setCreateChapterVolumeId] = useState<number | string | null>(null);

  const fetchChapters = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getChapterList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        const list: ChapterItem[] = res.result;
        setRawList(list);

        if (activeChapter) {
          const found = list.find((item) => String(item.id) === String(activeChapter.id));
          setActiveChapter(found || (list.find((c) => !c.isVolume) || null));
        } else {
          const firstChapter = list.find((c) => !c.isVolume);
          setActiveChapter(firstChapter || null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChapters();
  }, [workId]);

  const volumes = rawList.filter((item) => item.isVolume === 1);
  const chaptersList = rawList.filter((item) => item.isVolume === 0);

  const chaptersByVolume: Record<string | number, ChapterItem[]> = {};
  const unassignedChapters: ChapterItem[] = [];

  volumes.forEach((vol) => {
    chaptersByVolume[vol.id] = [];
  });

  chaptersList.forEach((ch) => {
    if (ch.volumeId && chaptersByVolume[ch.volumeId]) {
      chaptersByVolume[ch.volumeId].push(ch);
    } else {
      unassignedChapters.push(ch);
    }
  });

  const maxNum = chaptersList.reduce((max, c) => (c.chapterNumber > max ? c.chapterNumber : max), 0);
  const nextChapterNum = maxNum + 1;

  const handleSelectChapter = (chapter: ChapterItem) => {
    setActiveChapter(chapter);
    setSelectedTextForAi("");
  };

  const handleOpenDetailModal = (item: ChapterItem) => {
    setModalDetailTarget(item);
    setDetailModalOpened(true);
  };

  const handleCreateVolume = async (data: CreateChapterPayload) => {
    const res = await createChapter(data);
    if (res && res.success) {
      await fetchChapters();
    }
  };

  const handleCreateChapter = async (data: CreateChapterPayload) => {
    const res = await createChapter(data);
    if (res && res.success) {
      await fetchChapters();
    }
  };

  const handleUpdate = async (data: Partial<ChapterItem>) => {
    if (!activeChapter) return;
    const updatePayload: UpdateChapterPayload = {
      id: activeChapter.id,
      title: data.title !== undefined ? data.title : activeChapter.title,
      subtitle: data.subtitle !== undefined ? data.subtitle : activeChapter.subtitle,
      content: data.content !== undefined ? data.content : activeChapter.content,
      status: data.status !== undefined ? data.status : activeChapter.status,
      summary: data.summary !== undefined ? data.summary : activeChapter.summary,
    };

    const res = await updateChapter(updatePayload);
    if (res && res.success) {
      setActiveChapter((prev) => (prev ? { ...prev, ...data } : null));
      await fetchChapters();
    }
  };

  const handleDelete = async (id: number | string) => {
    if (confirm("确定要删除该章节/分卷吗？此操作不可撤销。")) {
      const res = await deleteChapter(String(id));
      if (res && res.success) {
        if (activeChapter && String(activeChapter.id) === String(id)) {
          setActiveChapter(null);
        }
        await fetchChapters();
      }
    }
  };

  const handleAcceptAiText = (text: string) => {
    setInsertTextPayload({ text, timestamp: Date.now() });
    setSelectedTextForAi("");
  };

  return (
    <Box
      pos="relative"
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <LoadingOverlay visible={loading && rawList.length === 0} />

      <TreePanel
        volumes={volumes}
        chaptersByVolume={chaptersByVolume}
        unassignedChapters={unassignedChapters}
        activeChapterId={activeChapter?.id || null}
        collapsed={treeCollapsed}
        onToggleCollapse={() => setTreeCollapsed(!treeCollapsed)}
        onSelectChapter={handleSelectChapter}
        onOpenDetailModal={handleOpenDetailModal}
        onOpenCreateVolume={() => setVolumeModalOpened(true)}
        onOpenCreateChapter={(volId) => {
          setCreateChapterVolumeId(volId || null);
          setChapterModalOpened(true);
        }}
        onDeleteItem={handleDelete}
      />

      <EditorArea
        workId={workId}
        chapter={activeChapter}
        treeCollapsed={treeCollapsed}
        onToggleTree={() => setTreeCollapsed(!treeCollapsed)}
        onUpdateChapter={handleUpdate}
        onSelectionChange={(text) => setSelectedTextForAi(text)}
        onToggleAiPanel={() => setAiPanelCollapsed(!aiPanelCollapsed)}
        insertTextPayload={insertTextPayload}
      />

      {activeChapter && (
        <PanelAiAssistant
          workId={workId}
          chapterId={activeChapter.id}
          currentContent={activeChapter.content || ""}
          selectedText={selectedTextForAi}
          collapsed={aiPanelCollapsed}
          onToggleCollapse={() => setAiPanelCollapsed(!aiPanelCollapsed)}
          onClearSelection={() => setSelectedTextForAi("")}
          onAcceptText={handleAcceptAiText}
        />
      )}

      <ModalChapterDetail
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        chapter={modalDetailTarget}
        volumes={volumes}
        onUpdate={handleUpdate}
      />

      <ModalCreateVolume
        opened={volumeModalOpened}
        onClose={() => setVolumeModalOpened(false)}
        workId={workId}
        onSubmit={handleCreateVolume}
      />

      <ModalCreateChapter
        opened={chapterModalOpened}
        onClose={() => setChapterModalOpened(false)}
        workId={workId}
        volumes={volumes}
        defaultVolumeId={createChapterVolumeId}
        nextChapterNum={nextChapterNum}
        onSubmit={handleCreateChapter}
      />
    </Box>
  );
}
