"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import { RootState } from "@/store";
import RecentChapterCard from "./recent-chapter-card";
import WorksSection, { WorkItem } from "./works-section";
import CreationStats from "./creation-stats";
import AiSuggestions from "./ai-suggestions";
import RecentActivities from "./recent-activities";
import ModalWork, { WorkFormData } from "./modal-work";
import ModalDeleteConfirm from "./modal-delete-confirm";
import Loading from "@/components/common/loading";
import { getWorkList, createWork, updateWork, deleteWork } from "@/rest/work";
import {
  getRecentChapter,
  getRecentActivities,
  getCreationStats,
  triggerAiDiagnosis,
  RecentChapterResult,
  ActivityResult,
  CreationStatItem,
  AiSuggestionItem,
} from "@/rest/workspace";

export default function WorkspacePage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.userInfo);

  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);

  const [recentChapter, setRecentChapter] = useState<RecentChapterResult | null>(null);
  const [loadingRecent, setLoadingRecent] = useState<boolean>(true);

  const [activities, setActivities] = useState<ActivityResult[]>([]);
  const [loadingActivities, setLoadingActivities] = useState<boolean>(true);

  const [creationStats, setCreationStats] = useState<CreationStatItem[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionItem[]>([]);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);

  const [modalOpened, setModalOpened] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentWork, setCurrentWork] = useState<WorkFormData | null>(null);

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingWork, setDeletingWork] = useState<WorkItem | null>(null);

  // 加载作品列表
  const fetchWorks = async () => {
    try {
      setLoadingList(true);
      const res = await getWorkList();
      if (res && res.success && Array.isArray(res.result)) {
        setWorks(res?.result || []);
      }
    } catch (err) {
      console.error("获取作品列表失败:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // 加载最近编辑内容
  const fetchRecentChapterData = async () => {
    try {
      setLoadingRecent(true);
      const res = await getRecentChapter();
      if (res && res.success) {
        setRecentChapter(res.result || null);
      }
    } catch (err) {
      console.error("获取最近编辑章节失败:", err);
    } finally {
      setLoadingRecent(false);
    }
  };

  // 加载近24小时动态
  const fetchActivitiesData = async () => {
    try {
      setLoadingActivities(true);
      const res = await getRecentActivities();
      if (res && res.success && Array.isArray(res.result)) {
        setActivities(res.result || []);
      }
    } catch (err) {
      console.error("获取近期动态失败:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  // 加载创作统计
  const fetchStatsData = async () => {
    try {
      setLoadingStats(true);
      const res = await getCreationStats();
      if (res && res.success && Array.isArray(res.result)) {
        setCreationStats(res.result || []);
      }
    } catch (err) {
      console.error("获取创作统计失败:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // 按需手动触发 AI 智囊诊断（避免页面加载时消耗 Token）
  const handleDiagnoseAi = async () => {
    try {
      setLoadingAi(true);
      const res = await triggerAiDiagnosis();
      if (res && res.success && Array.isArray(res.result)) {
        setAiSuggestions(res.result || []);
      }
    } catch (err) {
      console.error("AI 智囊诊断失败:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    fetchWorks();
    fetchRecentChapterData();
    fetchActivitiesData();
    fetchStatsData();
  }, []);

  // 新建作品
  const handleOpenCreate = () => {
    setModalMode("create");
    setCurrentWork(null);
    setModalOpened(true);
  };

  // 编辑作品
  const handleOpenEdit = (work: WorkItem) => {
    setModalMode("edit");
    setCurrentWork({
      id: work.id,
      title: work.title,
      tag: work.tag,
      expectedWords: work.expectedWords || 500000,
      expectedChapters: work.expectedChapters || 100,
      description: work.description || "",
      isPinned: work.isPinned,
    });
    setModalOpened(true);
  };

  // 提交新建 / 编辑
  const handleSubmitWork = async (formData: WorkFormData) => {
    if (modalMode === "create") {
      try {
        const res = await createWork({
          title: formData.title,
          tag: formData.tag,
          expectedWords: Number(formData.expectedWords) || 500000,
          expectedChapters: Number(formData.expectedChapters) || 100,
          description: formData.description,
          isPinned: formData.isPinned,
        });
        if (res && res.success) {
          fetchWorks();
          fetchRecentChapterData();
          fetchActivitiesData();
          fetchStatsData();
        }
      } catch (err) {
        console.error("新建作品失败:", err);
      }
    } else if (modalMode === "edit" && formData.id) {
      try {
        const res = await updateWork({
          id: formData.id,
          title: formData.title,
          tag: formData.tag,
          expectedWords: Number(formData.expectedWords) || 500000,
          expectedChapters: Number(formData.expectedChapters) || 100,
          description: formData.description,
          isPinned: formData.isPinned,
        });
        if (res && res.success) {
          fetchWorks();
          fetchRecentChapterData();
          fetchActivitiesData();
          fetchStatsData();
        }
      } catch (err) {
        console.error("编辑作品失败:", err);
      }
    }
  };

  // 快捷置顶 / 取消置顶
  const handleTogglePin = async (work: WorkItem) => {
    try {
      const res = await updateWork({
        id: work.id,
        isPinned: !work.isPinned,
      });
      if (res && res.success) {
        fetchWorks();
        fetchRecentChapterData();
        fetchActivitiesData();
      }
    } catch (err) {
      console.error("切换置顶状态失败:", err);
    }
  };

  // 删除确认
  const handleOpenDelete = (work: WorkItem) => {
    setDeletingWork(work);
    setDeleteModalOpened(true);
  };

  const handleConfirmDelete = async () => {
    if (deletingWork) {
      try {
        const res = await deleteWork(String(deletingWork.id));
        if (res && res.success) {
          fetchWorks();
          fetchRecentChapterData();
          fetchActivitiesData();
          fetchStatsData();
        }
      } catch (err) {
        console.error("删除作品失败:", err);
      } finally {
        setDeletingWork(null);
        setDeleteModalOpened(false);
      }
    }
  };

  // 点击作品卡片进入作品详情/工作台
  const handleSelectWork = (work: WorkItem) => {
    router.push(`/project/${work.id}`);
  };

  // 点击“继续写作”跳转至对应小说对应章节的编辑页
  const handleContinueWriting = () => {
    if (!recentChapter) return;
    if (recentChapter.workId) {
      if (recentChapter.chapterId) {
        router.push(
          `/project/${recentChapter.workId}?tab=chapters&chapterId=${recentChapter.chapterId}`
        );
      } else {
        router.push(`/project/${recentChapter.workId}?tab=chapters`);
      }
    }
  };

  const userName = user?.name || user?.username || "作家";
  const currentDateStr = dayjs().format("YYYY年M月D日");

  return (
    <Box
      mih="calc(100vh - 60px)"
      bg="#f8fafc"
      p="24px 32px 48px"
      maw={1440}
      mx="auto"
    >
      <Box mb={24}>
        <Text fz={24} fw={700} c="#1e293b" lh={1.3}>
          欢迎回来，{userName}
        </Text>
        <Text fz={13} c="#94a3b8" mt={6}>
          今天是 {currentDateStr} · 灵感不断，落笔成章
        </Text>
      </Box>

      <Flex
        gap={24}
        align="flex-start"
        direction={{ base: "column", md: "row" }}
      >
        <Flex direction="column" gap={24} w="100%">
          <Loading loading={loadingRecent} h={120}>
            <RecentChapterCard
              data={recentChapter}
              onContinue={handleContinueWriting}
            />
          </Loading>

          <WorksSection
            loading={loadingList}
            works={works}
            onCreateWork={handleOpenCreate}
            onEditWork={handleOpenEdit}
            onDeleteWork={handleOpenDelete}
            onTogglePin={handleTogglePin}
            onSelectWork={handleSelectWork}
          />

          <Loading loading={loadingStats} h={100}>
            <CreationStats stats={creationStats} />
          </Loading>
        </Flex>

        <Flex
          direction="column"
          gap={20}
          w={{ base: "100%", md: 340 }}
          style={{ flexShrink: 0 }}
        >
          <AiSuggestions
            suggestions={aiSuggestions}
            loading={loadingAi}
            onDiagnose={handleDiagnoseAi}
          />
          
          <Loading loading={loadingActivities} h={200}>
            <RecentActivities activities={activities} />
          </Loading>
        </Flex>
      </Flex>

      <ModalWork
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onSubmit={handleSubmitWork}
        initialData={currentWork}
        mode={modalMode}
      />

      <ModalDeleteConfirm
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setDeletingWork(null);
        }}
        onConfirm={handleConfirmDelete}
        title={deletingWork?.title}
      />
    </Box>
  );
}
