// 组件：小说章节创作工作台（三栏联动：极简目录树、沉浸式正文编辑区与右侧 AI 协同助手）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Box, Modal, Button, Group, Stack, Text } from "@mantine/core";
import LoadingMask from "@/components/common/loading-mask";
import { getChapterList, createChapter, updateChapter, deleteChapter, ChapterItem, CreateChapterPayload, UpdateChapterPayload, ActiveAiTask, ChapterAiApplyMode, HIGHLIGHT_COLORS } from "@/rest/chapter";
import { extractChapterOutline, reverseMasterOutlineFromChapters } from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import TreePanel from "./tree-panel";
import EditorArea from "./editor-area";
import PanelAiAssistant from "./panel-ai-assistant";
import PanelSplitter from "@/components/common/splitter";
import ModalChapterDetail from "./modal-chapter-detail";
import ModalCreateVolume from "./modal-create-volume";
import ModalCreateChapter from "./modal-create-chapter";
import ModalReverseMasterOutline from "./modal-reverse-master-outline";
import WorldSyncScannerModal from "@/components/common/world-sync-scanner";

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

  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(true);
  const [aiPanelWidth, setAiPanelWidth] = useState(360);
  const [isResizingAiPanel, setIsResizingAiPanel] = useState(false);
  const [selectedTextForAi, setSelectedTextForAi] = useState("");
  const [liveContent, setLiveContent] = useState("");
  const [insertTextPayload, setInsertTextPayload] = useState<{
    text: string;
    mode: ChapterAiApplyMode;
    targetSnippet?: string;
    timestamp: number;
  } | null>(null);
  const [locateSnippetPayload, setLocateSnippetPayload] = useState<{ snippet: string; timestamp: number } | null>(null);
  const [externalAiTask, setExternalAiTask] = useState<{
    actionType: string;
    selectedText: string;
    subMode?: string;
    customPrompt?: string;
    timestamp: number;
  } | null>(null);
  const [activeTasks, setActiveTasks] = useState<ActiveAiTask[]>([]);

  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [modalDetailTarget, setModalDetailTarget] = useState<ChapterItem | null>(null);
  const [volumeModalOpened, setVolumeModalOpened] = useState(false);
  const [chapterModalOpened, setChapterModalOpened] = useState(false);
  const [createChapterVolumeId, setCreateChapterVolumeId] = useState<number | string | null>(null);
  const [batchExtracting, setBatchExtracting] = useState(false);
  const [batchExtractProgress, setBatchExtractProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [reverseTreeModalOpened, setReverseTreeModalOpened] = useState(false);
  const [reversingChapterId, setReversingChapterId] = useState<number | string | null>(null);
  const [worldSyncModalOpened, setWorldSyncModalOpened] = useState(false);
  const [worldSyncPresetChapterIds, setWorldSyncPresetChapterIds] = useState<number[] | undefined>(undefined);

  const activeChapterRef = useRef<ChapterItem | null>(null);
  activeChapterRef.current = activeChapter;
  const initialTargetHandledRef = useRef(false);

  const fetchChapters = async (targetId?: number | string) => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getChapterList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        const list: ChapterItem[] = res.result;
        setRawList(list);

        // 优先使用显式指定的 targetId，其次保持当前正在编辑的章节，避免保存后跳到最新或默认章节
        const currentActiveId = targetId ?? activeChapterRef.current?.id;

        if (currentActiveId) {
          const found = list.find((item) => String(item.id) === String(currentActiveId));
          if (found) {
            setActiveChapter(found);
            return;
          }
        }

        // 仅在首次挂载且未选择章节时响应 URL 中的 targetChapterId
        if (!initialTargetHandledRef.current && targetChapterId) {
          initialTargetHandledRef.current = true;
          const target = list.find((item) => String(item.id) === String(targetChapterId));
          if (target) {
            setActiveChapter(target);
            return;
          }
        }

        const firstChapter = list.find((c) => !c.isVolume);
        setActiveChapter(firstChapter || null);
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

  const switchChapterState = (chapter: ChapterItem) => {
    initialTargetHandledRef.current = true;
    setActiveChapter(chapter);
    setLiveContent(chapter.content || "");
    setSelectedTextForAi("");
    setActiveTasks([]);
    setExternalAiTask(null);
  };

  const handleSelectChapter = (chapter: ChapterItem) => {
    if (isChapterDirty && activeChapter && String(activeChapter.id) !== String(chapter.id)) {
      setPendingChapter(chapter);
      setUnsavedModalOpened(true);
      return;
    }
    switchChapterState(chapter);
  };

  const handleDiscardAndNavigate = () => {
    setIsChapterDirty(false);
    setUnsavedModalOpened(false);
    if (pendingChapter) {
      switchChapterState(pendingChapter);
      setPendingChapter(null);
    }
  };

  const handleSaveAndNavigate = async () => {
    if (saveEditorRef.current) {
      const success = await saveEditorRef.current();
      if (!success) return;
      setIsChapterDirty(false);
    }
    setUnsavedModalOpened(false);
    if (pendingChapter) {
      switchChapterState(pendingChapter);
      setPendingChapter(null);
    }
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
      const createdId = res.result?.id;
      await fetchChapters(createdId);
    }
  };

  const handleUpdate = async (data: Partial<ChapterItem>) => {
    const targetId = data.id ?? activeChapter?.id;
    if (!targetId) return;
    const targetItem = rawList.find((c) => String(c.id) === String(targetId)) || activeChapter;
    if (!targetItem) return;

    const updatePayload: UpdateChapterPayload = {
      id: targetId,
      title: data.title !== undefined ? data.title : targetItem.title,
      subtitle: data.subtitle !== undefined ? data.subtitle : targetItem.subtitle,
      ...(data.content !== undefined ? { content: data.content } : {}),
      status: data.status !== undefined ? data.status : targetItem.status,
      summary: data.summary !== undefined ? data.summary : targetItem.summary,
      ...(data.volumeId !== undefined ? { volumeId: data.volumeId } : {}),
    };

    const res = await updateChapter(updatePayload);
    if (res && res.success) {
      const mergedFields: Partial<ChapterItem> = {
        ...data,
        ...(res.result && typeof res.result === "object" ? res.result : {}),
      };
      setRawList((prev) => prev.map((c) => (String(c.id) === String(targetId) ? { ...c, ...mergedFields } : c)));
      setActiveChapter((prev) => (prev && String(prev.id) === String(targetId) ? { ...prev, ...mergedFields } : prev));
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

  const handleAcceptAiText = (text: string, options?: { mode?: ChapterAiApplyMode; targetSnippet?: string }) => {
    const targetSnippet = options?.targetSnippet;
    const mode: ChapterAiApplyMode = options?.mode || (targetSnippet ? "replace_selection" : "insert_after_selection");
    setInsertTextPayload({ text, mode, targetSnippet, timestamp: Date.now() });
    setSelectedTextForAi("");
    if (targetSnippet && targetSnippet.trim()) {
      const clean = targetSnippet.trim();
      setActiveTasks((prev) => prev.filter((t) => t.snippet !== clean));
    }
  };

  const handleTriggerAiAction = (actionType: string, selectedText: string, subMode?: string, customPrompt?: string) => {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    const cleanSnippet = selectedText ? selectedText.trim() : "";

    if (cleanSnippet) {
      setActiveTasks((prev) => [
        ...prev.filter((t) => t.snippet !== cleanSnippet),
        {
          id: tempId,
          actionType,
          snippet: cleanSnippet,
          colorIndex: prev.length % HIGHLIGHT_COLORS.length,
          isPending: true,
        },
      ]);
    }

    setExternalAiTask({
      actionType,
      selectedText,
      subMode,
      customPrompt,
      timestamp: Date.now(),
    });
    setAiPanelCollapsed(false);
  };

  const handleMarkChapterExtracted = (chapterId: number | string) => {
    setRawList((prev) => prev.map((c) => (String(c.id) === String(chapterId) ? { ...c, outlineExtracted: 1 } : c)));
    setActiveChapter((prev) => (prev && String(prev.id) === String(chapterId) ? { ...prev, outlineExtracted: 1 } : prev));
  };

  const handleBatchExtractOutlines = async () => {
    if (!workId || batchExtracting) return;
    const validChapters = chaptersList.filter((ch) => (ch.wordCount || 0) >= 20 || (ch.content || "").trim().length >= 20);
    const pendingChapters = validChapters.filter((ch) => ch.outlineExtracted !== 1);
    const skippedCount = validChapters.length - pendingChapters.length;

    if (pendingChapters.length === 0) {
      useAlert.info(
        skippedCount > 0
          ? `全部 ${skippedCount} 个有正文的章节均已提取过大纲，无需重复提取！`
          : "暂无可提取大纲的章节（章节正文需不少于 20 字）"
      );
      return;
    }

    const ok = await showConfirm({
      title: "一键提取章节大纲",
      message: `检测到 ${pendingChapters.length} 个尚未提取大纲的章节（已提取的 ${skippedCount} 章将自动跳过）。确定开始逐章提取吗？提取期间请不要跳转页面。`,
      confirmLabel: `开始提取 (${pendingChapters.length} 章)`,
      confirmColor: "cyan",
    });
    if (!ok) return;

    try {
      setBatchExtracting(true);
      useAlert.info(`开始批量提取 ${pendingChapters.length} 个章节大纲，提取中请不要跳转页面...`, { autoClose: 5000 });
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < pendingChapters.length; i++) {
        const ch = pendingChapters[i];
        const chLabel = ch.title || `第 ${ch.chapterNumber} 章`;
        setBatchExtractProgress({ current: i + 1, total: pendingChapters.length, title: chLabel });
        try {
          const res = await extractChapterOutline({
            chapterId: ch.id,
            workId,
            title: ch.title,
          });
          if (res && res.success) {
            successCount += 1;
            handleMarkChapterExtracted(ch.id);
          } else {
            failCount += 1;
          }
        } catch {
          failCount += 1;
        }
      }

      if (failCount === 0) {
        useAlert.success(`全部提取完毕！成功提取 ${successCount} 章${skippedCount > 0 ? `（跳过已提取 ${skippedCount} 章）` : ""}`, { autoClose: 4500 });
      } else {
        useAlert.warning(`批量提取结束：成功 ${successCount} 章，失败 ${failCount} 章（失败章节可再次点击一键提取补提）`, { autoClose: 5000 });
      }
    } finally {
      setBatchExtracting(false);
      setBatchExtractProgress(null);
    }
  };

  const handleReverseSingleChapter = async (ch: ChapterItem) => {
    if (!workId || reversingChapterId) return;
    const isCurrent = activeChapter && String(activeChapter.id) === String(ch.id);
    const effectiveContent = isCurrent ? liveContent : ch.content || "";
    const effectiveWords = isCurrent ? effectiveContent.replace(/\s+/g, "").length : ch.wordCount || effectiveContent.replace(/\s+/g, "").length;
    if (effectiveWords < 20) {
      useAlert.warning("该章节正文内容过短，请先写满一段正文后再反推大纲节点");
      return;
    }

    if (isCurrent && isChapterDirty && saveEditorRef.current) {
      const saved = await saveEditorRef.current();
      if (!saved) return;
    }

    try {
      setReversingChapterId(ch.id);
      useAlert.info(`正在将第 ${ch.chapterNumber} 章反推同步至总纲树，请稍候...`, { autoClose: 4500 });
      const res = await reverseMasterOutlineFromChapters({
        workId,
        mode: "single",
        chapterId: ch.id,
        autoSave: true,
      });
      if (res && res.success) {
        handleMarkChapterExtracted(ch.id);
        useAlert.success(res.message || `已将第 ${ch.chapterNumber} 章反推同步至总纲树`, { autoClose: 4000 });
      } else {
        useAlert.error(res?.message || "单章反推总纲节点失败");
      }
    } catch (e: any) {
      useAlert.error("反推总纲节点异常: " + (e?.message || "网络错误"));
    } finally {
      setReversingChapterId(null);
    }
  };

  const handleOpenWorldSyncForChapter = (chapterId: number | string) => {
    setWorldSyncPresetChapterIds([Number(chapterId)]);
    setWorldSyncModalOpened(true);
  };

  const writtenChapterCount = chaptersList.filter(
    (c) => (c.wordCount || 0) >= 20 || (c.content || "").trim().length >= 20
  ).length;

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
      <LoadingMask visible={loading && rawList.length === 0} />

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
        batchExtracting={batchExtracting}
        batchExtractProgress={batchExtractProgress}
        onBatchExtractOutlines={handleBatchExtractOutlines}
        onOpenReverseMasterTree={() => setReverseTreeModalOpened(true)}
        reversingChapterId={reversingChapterId}
        onReverseSingleChapter={handleReverseSingleChapter}
      />

      <EditorArea
        workId={workId}
        chapter={activeChapter}
        treeCollapsed={treeCollapsed}
        aiPanelCollapsed={aiPanelCollapsed}
        aiPanelWidth={aiPanelWidth}
        onToggleTree={() => setTreeCollapsed(!treeCollapsed)}
        onUpdateChapter={handleUpdate}
        onContentChange={setLiveContent}
        onSelectionChange={(text) => setSelectedTextForAi(text)}
        onTriggerAiAction={handleTriggerAiAction}
        activeTasks={activeTasks}
        onToggleAiPanel={() => setAiPanelCollapsed(!aiPanelCollapsed)}
        insertTextPayload={insertTextPayload}
        locateSnippetPayload={locateSnippetPayload}
        onDirtyChange={setIsChapterDirty}
        onDeleteChapter={handleDelete}
        onOutlineExtracted={handleMarkChapterExtracted}
        onReverseSingleChapter={handleReverseSingleChapter}
        reversingOutline={Boolean(reversingChapterId && activeChapter && String(reversingChapterId) === String(activeChapter.id))}
        onOpenWorldSync={handleOpenWorldSyncForChapter}
        saveRef={saveEditorRef}
      />

      {activeChapter && (
        <PanelSplitter
          side="right"
          width={aiPanelWidth}
          onResize={(newWidth) => setAiPanelWidth(newWidth)}
          minWidth={280}
          maxWidth={720}
          defaultWidth={360}
          collapsed={aiPanelCollapsed}
          onToggleCollapse={() => setAiPanelCollapsed(!aiPanelCollapsed)}
          onDragStart={() => setIsResizingAiPanel(true)}
          onDragEnd={() => setIsResizingAiPanel(false)}
          expandTooltip="展开 AI 协同创作助手"
          collapseTooltip="收起 AI 协同面板 (双击手柄恢复默认宽度)"
        />
      )}

      {activeChapter && (
        <PanelAiAssistant
          workId={workId}
          chapterId={activeChapter.id}
          currentContent={liveContent}
          selectedText={selectedTextForAi}
          externalTask={externalAiTask}
          collapsed={aiPanelCollapsed}
          width={aiPanelWidth}
          isResizing={isResizingAiPanel}
          onToggleCollapse={() => setAiPanelCollapsed(!aiPanelCollapsed)}
          onClearSelection={() => setSelectedTextForAi("")}
          onAcceptText={handleAcceptAiText}
          onLocateSnippet={(snippet) => setLocateSnippetPayload({ snippet, timestamp: Date.now() })}
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

      <ModalReverseMasterOutline
        opened={reverseTreeModalOpened}
        onClose={() => setReverseTreeModalOpened(false)}
        workId={workId}
        writtenChapterCount={writtenChapterCount}
      />

      <WorldSyncScannerModal
        opened={worldSyncModalOpened}
        onClose={() => setWorldSyncModalOpened(false)}
        workId={workId}
        defaultFocusScope="all"
        presetChapterIds={worldSyncPresetChapterIds}
        onApplied={() => fetchChapters()}
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
            当前章节「{activeChapter?.title || `第${activeChapter?.chapterNumber}章`}{activeChapter?.subtitle ? `  ${activeChapter?.subtitle}` : ""}」存在未保存的修改。离开将丢失未保存的内容，请选择操作：
          </Text>
          <Group justify="flex-end" gap="sm" mt="sm">
            <Button variant="default" color="gray" onClick={handleDiscardAndNavigate}>
              确认不保存
            </Button>
            <Button color="cyan" onClick={handleSaveAndNavigate}>
              保存并切换
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
