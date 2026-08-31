"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, LoadingOverlay, Button, Tooltip } from "@mantine/core";
import {
  getChapterList,
  createChapter,
  updateChapter,
  deleteChapter,
  ChapterItem,
  CreateChapterPayload,
  UpdateChapterPayload,
} from "@/rest/chapter";
import TreePanel from "./tree-panel";
import EditorArea from "./editor-area";
import DiffViewer from "./diff-viewer";
import ModalChapterDetail from "./modal-chapter-detail";
import ModalAiDraft from "./modal-ai-draft";
import ModalCreateVolume from "./modal-create-volume";
import ModalCreateChapter from "./modal-create-chapter";
import styles from "./style.module.scss";

export default function ChaptersPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [rawList, setRawList] = useState<ChapterItem[]>([]);
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null);

  // 目录大纲树折叠状态（默认收起以提供沉浸写作空间）
  const [treeCollapsed, setTreeCollapsed] = useState(true);

  // 弹窗状态
  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [modalDetailTarget, setModalDetailTarget] = useState<ChapterItem | null>(null);
  const [volumeModalOpened, setVolumeModalOpened] = useState(false);
  const [chapterModalOpened, setChapterModalOpened] = useState(false);
  const [createChapterVolumeId, setCreateChapterVolumeId] = useState<number | string | null>(null);
  const [aiDraftModalOpened, setAiDraftModalOpened] = useState(false);

  // AI 优化对比视图状态
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [aiOptimizedContent, setAiOptimizedContent] = useState("");

  const fetchChapters = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getChapterList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        const list: ChapterItem[] = res.result;
        setRawList(list);

        // 如果当前选中的章节还在列表中，更新其引用
        if (activeChapter) {
          const found = list.find((item) => item.id === activeChapter.id);
          setActiveChapter(found || (list.find((c) => !c.isVolume) || null));
        } else {
          // 默认选中第一个正文章节
          const firstChapter = list.find((c) => !c.isVolume);
          setActiveChapter(firstChapter || null);
        }
      }
    } catch (e) {
      console.error("获取章节列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChapters();
  }, [workId]);

  // 区分卷与章节
  const volumes = rawList.filter((item) => item.isVolume === 1);
  const chaptersList = rawList.filter((item) => item.isVolume === 0);

  // 按卷 ID 分组章节
  const chaptersByVolume: Record<string, ChapterItem[]> = {};
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

  // 预计下一个自动章节序号
  const maxNum = chaptersList.reduce(
    (max, c) => (c.chapterNumber > max ? c.chapterNumber : max),
    0
  );
  const nextChapterNum = maxNum + 1;

  // 切换选中章节进行正文写作
  const handleSelectChapter = (chapter: ChapterItem) => {
    setActiveChapter(chapter);
    setIsDiffMode(false);
  };

  // 点击打开节点详情弹窗 (包括卷和章节)
  const handleOpenDetailModal = (item: ChapterItem) => {
    setModalDetailTarget(item);
    setDetailModalOpened(true);
  };

  // 新建卷提交
  const handleCreateVolume = async (data: CreateChapterPayload) => {
    const res = await createChapter(data);
    if (res && res.success) {
      await fetchChapters();
      if (res.result) {
        setModalDetailTarget(res.result);
        setDetailModalOpened(true);
      }
    }
  };

  // 新建章节提交
  const handleCreateChapter = async (data: CreateChapterPayload) => {
    const res = await createChapter(data);
    if (res && res.success) {
      await fetchChapters();
      if (res.result) {
        setActiveChapter(res.result);
        setIsDiffMode(false);
      }
    }
  };

  // 编辑更新
  const handleUpdate = async (data: UpdateChapterPayload) => {
    const res = await updateChapter(data);
    if (res && res.success) {
      await fetchChapters();
      if (activeChapter && activeChapter.id === data.id) {
        setActiveChapter((prev) => (prev ? { ...prev, ...data } : null));
      }
    }
  };

  // 删除节点
  const handleDelete = async (id: number | string) => {
    if (confirm("确定要删除该章节/分卷吗？此操作不可撤销。")) {
      const res = await deleteChapter(String(id));
      if (res && res.success) {
        if (activeChapter?.id === id) {
          setActiveChapter(null);
        }
        await fetchChapters();
      }
    }
  };

  // AI 生成初稿成功后填入正文
  const handleAiDraftGenerated = (draftText: string) => {
    if (activeChapter) {
      handleUpdate({
        id: activeChapter.id,
        content: draftText,
        status: "revising",
      });
      setIsDiffMode(false);
    }
  };

  // 进入双栏对比模式
  const handleEnterDiffView = (optimizedText: string) => {
    setAiOptimizedContent(optimizedText);
    setIsDiffMode(true);
  };

  // 采纳 AI 优化修改
  const handleAcceptDiff = (acceptedText: string) => {
    if (activeChapter) {
      handleUpdate({
        id: activeChapter.id,
        content: acceptedText,
        status: "revising",
      });
      setIsDiffMode(false);
    }
  };

  // 放弃 AI 优化修改
  const handleRejectDiff = () => {
    setIsDiffMode(false);
  };

  return (
    <Box className={styles.container} pos="relative">
      <LoadingOverlay visible={loading && rawList.length === 0} />

      {/* 1. 左侧分卷与章节大纲树 (支持默认收起/展开) */}
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

      {/* 2. 右侧沉浸式写作区 / AI 双栏对比区 */}
      {isDiffMode && activeChapter ? (
        <Box style={{ flex: 1, height: "100%", overflowY: "auto", padding: "24px 36px" }}>
          <DiffViewer
            originalText={activeChapter.content || ""}
            optimizedText={aiOptimizedContent}
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
          />
        </Box>
      ) : (
        <EditorArea
          workId={workId}
          chapter={activeChapter}
          treeCollapsed={treeCollapsed}
          onToggleTree={() => setTreeCollapsed(!treeCollapsed)}
          onUpdateContent={handleUpdate}
          onOpenAiDraft={() => setAiDraftModalOpened(true)}
          onOpenDetailModal={() => {
            if (activeChapter) handleOpenDetailModal(activeChapter);
          }}
          onEnterDiffView={handleEnterDiffView}
        />
      )}

      {/* 3. 章节/分卷 详情弹窗 (字数、标题、状态、分卷、摘要) */}
      <ModalChapterDetail
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        chapter={modalDetailTarget}
        volumes={volumes}
        onUpdate={handleUpdate}
      />

      {/* 4. AI 生成初稿配置弹窗 (大纲、走向、人物、文风、字数) */}
      <ModalAiDraft
        opened={aiDraftModalOpened}
        onClose={() => setAiDraftModalOpened(false)}
        workId={workId}
        chapterId={activeChapter?.id}
        chapterTitle={activeChapter?.title}
        defaultSummary={activeChapter?.summary}
        onGenerated={handleAiDraftGenerated}
      />

      {/* 5. 新建分卷弹窗 */}
      <ModalCreateVolume
        opened={volumeModalOpened}
        onClose={() => setVolumeModalOpened(false)}
        workId={workId}
        onSubmit={handleCreateVolume}
      />

      {/* 6. 新建正文章节弹窗 */}
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
