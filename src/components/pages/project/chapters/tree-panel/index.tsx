// 组件：章节目录大纲树形极简线条风面板（支持卷/章新建、折叠、实时字数及底部上下章切换）
"use client";

import React, { useState } from "react";
import { Box, Flex, Text, ActionIcon, Tooltip, Badge, ScrollArea, Group, Stack, Collapse, UnstyledButton, Progress } from "@mantine/core";
import { FiFolderPlus, FiFilePlus, FiChevronDown, FiChevronRight, FiTrash2, FiEdit2, FiSidebar, FiChevronLeft, FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { ChapterItem } from "@/rest/chapter";

interface TreePanelProps {
  volumes: ChapterItem[];
  chaptersByVolume: Record<string | number, ChapterItem[]>;
  unassignedChapters: ChapterItem[];
  activeChapterId: number | string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectChapter: (chapter: ChapterItem) => void;
  onOpenDetailModal: (item: ChapterItem) => void;
  onOpenCreateVolume: () => void;
  onOpenCreateChapter: (volumeId?: number | string | null) => void;
  onDeleteItem: (id: number | string) => void;
  targetWords?: number;
}

export default function TreePanel({
  volumes,
  chaptersByVolume,
  unassignedChapters,
  activeChapterId,
  collapsed = false,
  onToggleCollapse,
  onSelectChapter,
  onOpenDetailModal,
  onOpenCreateVolume,
  onOpenCreateChapter,
  onDeleteItem,
  targetWords = 4000,
}: TreePanelProps) {
  const [collapsedVolumeIds, setCollapsedVolumeIds] = useState<Record<string | number, boolean>>({});

  const toggleVolumeCollapse = (volId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedVolumeIds((prev) => ({ ...prev, [volId]: !prev[volId] }));
  };

  const allChaptersList: ChapterItem[] = [];
  volumes.forEach((vol) => {
    const list = chaptersByVolume[vol.id] || [];
    list.forEach((ch) => allChaptersList.push(ch));
  });
  unassignedChapters.forEach((ch) => allChaptersList.push(ch));

  const currentActiveChapter = allChaptersList.find((c) => String(c.id) === String(activeChapterId)) || allChaptersList[0];
  const currentChapterIndex = allChaptersList.findIndex((c) => String(c.id) === String(activeChapterId));

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      onSelectChapter(allChaptersList[currentChapterIndex - 1]);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex >= 0 && currentChapterIndex < allChaptersList.length - 1) {
      onSelectChapter(allChaptersList[currentChapterIndex + 1]);
    }
  };

  const currentWords = currentActiveChapter?.wordCount || 0;
  const progressPercent = Math.min(Math.round((currentWords / Math.max(targetWords, 1)) * 100), 100);

  return (
    <Box
      style={{
        width: collapsed ? 0 : 260,
        minWidth: collapsed ? 0 : 260,
        maxWidth: collapsed ? 0 : 280,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderRight: collapsed ? "none" : "1px solid #f1f5f9",
        transition: "all 0.2s ease",
        overflow: "hidden",
        flexShrink: 0,
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? "none" : "auto",
        zIndex: 20,
      }}
    >
      <Flex justify="space-between" align="center" px="md" py={14} style={{ borderBottom: "1px solid #f8fafc" }}>
        <Text fz={13} fw={700} c="#475569">目录大纲</Text>
        <Group gap={4}>
          <Tooltip label="新建分卷" position="bottom">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onOpenCreateVolume}>
              <FiFolderPlus size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="新建独立章节" position="bottom">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onOpenCreateChapter(null)}>
              <FiFilePlus size={14} />
            </ActionIcon>
          </Tooltip>
          {onToggleCollapse && (
            <Tooltip label="收起目录" position="bottom">
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCollapse}>
                <FiSidebar size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Flex>

      <ScrollArea style={{ flex: 1 }} px="xs" py="xs">
        <Stack gap={6}>
          {volumes.map((vol) => {
            const isCollapsed = Boolean(collapsedVolumeIds[vol.id]);
            const list = chaptersByVolume[vol.id] || [];

            return (
              <Box key={vol.id}>
                <Flex
                  align="center"
                  justify="space-between"
                  px={6}
                  py={5}
                  style={{
                    borderRadius: 4,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={(e) => toggleVolumeCollapse(vol.id, e)}
                >
                  <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                    {isCollapsed ? <FiChevronRight size={12} color="#94a3b8" /> : <FiChevronDown size={12} color="#94a3b8" />}
                    <Text fz={12.5} fw={600} c="#334155" truncate="end" style={{ flex: 1 }}>
                      {vol.title}
                    </Text>
                  </Group>

                  <Group gap={2} onClick={(e) => e.stopPropagation()}>
                    <Tooltip label="在该卷下新建章节" position="right">
                      <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => onOpenCreateChapter(vol.id)}>
                        <FiFilePlus size={12} />
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => onOpenDetailModal(vol)}>
                      <FiEdit2 size={11} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onDeleteItem(vol.id)}>
                      <FiTrash2 size={11} />
                    </ActionIcon>
                  </Group>
                </Flex>

                <Collapse expanded={!isCollapsed}>
                  <Stack gap={1} pl={10} mt={2}>
                    {list.map((ch) => {
                      const isActive = String(activeChapterId) === String(ch.id);
                      return (
                        <UnstyledButton
                          key={ch.id}
                          onClick={() => onSelectChapter(ch)}
                          px={8}
                          py={6}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderRadius: 4,
                            backgroundColor: isActive ? "#f0f9ff" : "transparent",
                            transition: "background-color 0.15s ease",
                          }}
                        >
                          <Group gap={8} style={{ flex: 1, minWidth: 0 }}>
                            <Box
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                backgroundColor: isActive ? "#0284c7" : "#10b981",
                                flexShrink: 0,
                              }}
                            />
                            <Text
                              fz={12.5}
                              fw={isActive ? 600 : 400}
                              c={isActive ? "#0284c7" : "#475569"}
                              truncate="end"
                              style={{ flex: 1 }}
                            >
                              第{ch.chapterNumber}章 {ch.title}
                            </Text>
                          </Group>

                          <Text fz={11} c="#94a3b8" style={{ flexShrink: 0, marginLeft: 6 }}>
                            {(ch.wordCount || 0).toLocaleString()}
                          </Text>
                        </UnstyledButton>
                      );
                    })}
                  </Stack>
                </Collapse>
              </Box>
            );
          })}

          {unassignedChapters.length > 0 && (
            <Box mt={4}>
              <Text fz={11} fw={600} c="#94a3b8" px={8} mb={4}>未分卷章节</Text>
              <Stack gap={1}>
                {unassignedChapters.map((ch) => {
                  const isActive = String(activeChapterId) === String(ch.id);
                  return (
                    <UnstyledButton
                      key={ch.id}
                      onClick={() => onSelectChapter(ch)}
                      px={8}
                      py={6}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderRadius: 4,
                        backgroundColor: isActive ? "#f0f9ff" : "transparent",
                      }}
                    >
                      <Group gap={8} style={{ flex: 1, minWidth: 0 }}>
                        <Box
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            backgroundColor: isActive ? "#0284c7" : "#10b981",
                            flexShrink: 0,
                          }}
                        />
                        <Text
                          fz={12.5}
                          fw={isActive ? 600 : 400}
                          c={isActive ? "#0284c7" : "#475569"}
                          truncate="end"
                          style={{ flex: 1 }}
                        >
                          第{ch.chapterNumber}章 {ch.title}
                        </Text>
                      </Group>
                      <Text fz={11} c="#94a3b8" style={{ flexShrink: 0, marginLeft: 6 }}>
                        {(ch.wordCount || 0).toLocaleString()}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      </ScrollArea>

      {currentActiveChapter && (
        <Box p="xs" style={{ borderTop: "1px solid #f1f5f9", backgroundColor: "#fafbfc" }}>
          <Flex justify="space-between" align="center" mb={4}>
            <Text fz={12} fw={600} c="#334155" truncate="end" style={{ maxWidth: 160 }}>
              第{currentActiveChapter.chapterNumber}章 · {currentActiveChapter.title}
            </Text>
            <Badge size="xs" variant="light" color="cyan">写作中</Badge>
          </Flex>

          <Flex justify="space-between" align="center" fz={10.5} c="#94a3b8" mb={4}>
            <Text fz={10.5}>完成度 {progressPercent}%</Text>
            <Text fz={10.5}>{currentWords.toLocaleString()} / {targetWords.toLocaleString()} 字</Text>
          </Flex>
          <Progress value={progressPercent} size="xs" color="cyan" mb={8} radius="xl" />

          <Flex gap={6}>
            <UnstyledButton
              onClick={handlePrevChapter}
              disabled={currentChapterIndex <= 0}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                fontSize: 11.5,
                color: currentChapterIndex <= 0 ? "#cbd5e1" : "#475569",
                cursor: currentChapterIndex <= 0 ? "not-allowed" : "pointer",
              }}
            >
              <FiArrowLeft size={11} /> 上一章
            </UnstyledButton>
            <UnstyledButton
              onClick={handleNextChapter}
              disabled={currentChapterIndex >= allChaptersList.length - 1}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                fontSize: 11.5,
                color: currentChapterIndex >= allChaptersList.length - 1 ? "#cbd5e1" : "#475569",
                cursor: currentChapterIndex >= allChaptersList.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              下一章 <FiArrowRight size={11} />
            </UnstyledButton>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
