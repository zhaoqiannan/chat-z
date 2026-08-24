"use client";

import React, { useState } from "react";
import { Box, Flex, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { workspaceMockData } from "./mock.js";
import RecentChapterCard from "./recent-chapter-card";
import WorksSection, { WorkItem } from "./works-section";
import CreationStats from "./creation-stats";
import AiSuggestions from "./ai-suggestions";
import RecentActivities from "./recent-activities";
import ModalWork, { WorkFormData } from "./modal-work";
import ModalDeleteConfirm from "./modal-delete-confirm";

export default function WorkspacePage() {
  const router = useRouter();
  const {
    welcome,
    recentChapter,
    worksList: initialWorks,
    creationStats,
    aiSuggestions,
    recentActivities,
  } = workspaceMockData;

  const [works, setWorks] = useState<WorkItem[]>(initialWorks);
  const [modalOpened, setModalOpened] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentWork, setCurrentWork] = useState<WorkFormData | null>(null);

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingWork, setDeletingWork] = useState<WorkItem | null>(null);

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
      expectedWords: work.expectedWords || "50,000",
    });
    setModalOpened(true);
  };

  // 提交新建 / 编辑
  const handleSubmitWork = (formData: WorkFormData) => {
    if (modalMode === "create") {
      const newWork: WorkItem = {
        id: Date.now(),
        title: formData.title,
        tag: formData.tag,
        wordCount: "0",
        chapterCount: 0,
        progress: 0,
        lastEditTime: "刚刚",
        expectedWords: formData.expectedWords,
      };
      setWorks((prev) => [newWork, ...prev]);
    } else if (modalMode === "edit" && formData.id) {
      setWorks((prev) =>
        prev.map((item) =>
          item.id === formData.id
            ? {
                ...item,
                title: formData.title,
                tag: formData.tag,
                expectedWords: formData.expectedWords,
              }
            : item
        )
      );
    }
  };

  // 删除确认
  const handleOpenDelete = (work: WorkItem) => {
    setDeletingWork(work);
    setDeleteModalOpened(true);
  };

  const handleConfirmDelete = () => {
    if (deletingWork) {
      setWorks((prev) => prev.filter((item) => item.id !== deletingWork.id));
      setDeletingWork(null);
    }
  };

  // 点击作品卡片进入作品详情/工作台
  const handleSelectWork = (work: WorkItem) => {
    router.push(`/project/${work.id}`);
  };

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
          {welcome.title}
        </Text>
        <Text fz={13} c="#94a3b8" mt={6}>
          {welcome.subtitle}
        </Text>
      </Box>

      <Flex
        gap={24}
        align="flex-start"
        direction={{ base: "column", md: "row" }}
      >
        <Flex direction="column" gap={24} style={{ flex: 1, minWidth: 0 }} w="100%">
          {/* <RecentChapterCard
            data={recentChapter}
            onContinue={() => {
              if (works.length > 0) {
                router.push(`/project/${works[0].id}`);
              }
            }}
          /> */}
          <WorksSection
            works={works}
            onCreateWork={handleOpenCreate}
            onEditWork={handleOpenEdit}
            onDeleteWork={handleOpenDelete}
            onSelectWork={handleSelectWork}
          />
          {/* <CreationStats stats={creationStats} /> */}
        </Flex>

        <Flex
          direction="column"
          gap={20}
          w={{ base: "100%", md: 340 }}
          style={{ flexShrink: 0 }}
        >
          <AiSuggestions suggestions={aiSuggestions} />
          <RecentActivities activities={recentActivities} />
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
