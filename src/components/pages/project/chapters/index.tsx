// 组件：小说章节创作工作台（三栏联动：极简目录树、沉浸式正文编辑区与右侧 AI 协同助手）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Box, LoadingOverlay, Modal, Button, Group, Stack, Text } from "@mantine/core";
import { getChapterList, createChapter, updateChapter, deleteChapter, ChapterItem, CreateChapterPayload, UpdateChapterPayload } from "@/rest/chapter";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import TreePanel from "./tree-panel";
import EditorArea from "./editor-area";
import PanelAiAssistant from "./panel-ai-assistant";
import Splitter from "./splitter";
import ModalChapterDetail from "./modal-chapter-detail";
import ModalCreateVolume from "./modal-create-volume";
import ModalCreateChapter from "./modal-create-chapter";

export default function ChaptersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workId = String(params?.id || "");
  const targetChapterId = searchParams.get("chapterId");

  const [loading, setLoading] = useState(false);
  const [rawList, setRawList] = useState<ChapterItem[]>([]);
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);

  // 未保存拦截与快捷保存
  const [isChapterDirty, setIsChapterDirty] = useState(false);
  const [unsavedModalOpened, setUnsavedModalOpened] = useState(false);
  const [pendingChapter, setPendingChapter] = useState<ChapterItem | null>(null);
  const saveEditorRef = useRef<(() => Promise<boolean>) | null>(null);

  const [treeCollapsed, setTreeCollapsed] = useState(true);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(360);
  const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
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

        if (targetChapterId) {
          const target = list.find((item) => String(item.id) === String(targetChapterId));
          if (target) {
            setActiveChapter(target);
            return;
          }
        }

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

  // 离开页面前的原生浏览器阻拦 (刷新/关闭窗口/回退)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isChapterDirty) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isChapterDirty]);

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
    if (isChapterDirty && activeChapter && String(activeChapter.id) !== String(chapter.id)) {
      setPendingChapter(chapter);
      setUnsavedModalOpened(true);
      return;
    }
    setActiveChapter(chapter);
    setSelectedTextForAi("");
  };

  const handleDiscardAndNavigate = () => {
    setIsChapterDirty(false);
    setUnsavedModalOpened(false);
    if (pendingChapter) {
      setActiveChapter(pendingChapter);
      setPendingChapter(null);
      setSelectedTextForAi("");
    }
  };

  const handleSaveAndStay = async () => {
    if (saveEditorRef.current) {
      const success = await saveEditorRef.current();
      if (success) {
        setIsChapterDirty(false);
      }
    }
    setUnsavedModalOpened(false);
    setPendingChapter(null);
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
    const target = rawList.find((c) => String(c.id) === String(id));
    const isVolume = target?.isVolume === 1;

    const isConfirmed = await showConfirm({
      title: isVolume ? "删除分卷确认" : "删除章节二次确认",
      message: isVolume
        ? `确定要删除分卷「${target?.title || "未命名分卷"}」吗？\n\n删除后其下所属章节将变为未分卷章节。`
        : `确定要删除「第${target?.chapterNumber || 1}章 · ${target?.title || "未命名章节"}」吗？\n\n⚠️ 注意：删除此章节将影响后续所有章节，后续章节序号将自动重新排序重置，此操作不可撤销！`,
      confirmLabel: "确认删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        const res = await deleteChapter(String(id));
        if (res && res.success) {
          if (activeChapter && String(activeChapter.id) === String(id)) {
            setActiveChapter(null);
            setIsChapterDirty(false);
          }
          useAlert.success(isVolume ? "分卷已成功删除" : "章节已成功删除，后续章节号已自动重置");
          await fetchChapters();
        }
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
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
        onDirtyChange={setIsChapterDirty}
        onDeleteChapter={handleDelete}
        saveRef={saveEditorRef}
      />

      {activeChapter && (
        <Splitter
          width={aiPanelWidth}
          onResize={(newWidth) => setAiPanelWidth(newWidth)}
          minWidth={280}
          maxWidth={720}
          defaultWidth={360}
          collapsed={aiPanelCollapsed}
          onToggleCollapse={() => setAiPanelCollapsed(!aiPanelCollapsed)}
          onDragStart={() => setIsResizingAiPanel(true)}
          onDragEnd={() => setIsResizingAiPanel(false)}
        />
      )}

      {activeChapter && (
        <PanelAiAssistant
          workId={workId}
          chapterId={activeChapter.id}
          currentContent={activeChapter.content || ""}
          selectedText={selectedTextForAi}
          collapsed={aiPanelCollapsed}
          width={aiPanelWidth}
          isResizing={isResizingAiPanel}
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

      {/* 未保存修改的阻拦提示弹窗 */}
      <Modal
        opened={unsavedModalOpened}
        onClose={() => setUnsavedModalOpened(false)}
        title={<Text fw={700} fz={15} c="#b45309">未保存的内容提示</Text>}
        centered
        radius="md"
        size="sm"
      >
        <Stack gap="md">
          <Text fz={13.5} c="#334155" style={{ lineHeight: 1.6 }}>
            当前章节「第{activeChapter?.chapterNumber}章 · {activeChapter?.title}」存在未保存的修改。离开将丢失未保存的内容，请选择操作：
          </Text>
          <Group justify="flex-end" gap="sm" mt="sm">
            <Button variant="default" color="gray" onClick={handleDiscardAndNavigate}>
              确认不保存
            </Button>
            <Button color="blue" onClick={handleSaveAndStay}>
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
