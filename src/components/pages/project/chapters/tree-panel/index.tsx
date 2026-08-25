"use client";

import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  ActionIcon,
  Tooltip,
  Badge,
} from "@mantine/core";
import {
  FiFolder,
  FiFolderPlus,
  FiFilePlus,
  FiFileText,
  FiChevronDown,
  FiChevronRight,
  FiTrash2,
  FiInfo,
} from "react-icons/fi";
import { ChapterItem } from "@/rest/chapter";
import styles from "../style.module.scss";

interface TreePanelProps {
  volumes: ChapterItem[];
  chaptersByVolume: Record<string | number, ChapterItem[]>;
  unassignedChapters: ChapterItem[];
  activeChapterId: number | string | null;
  onSelectChapter: (chapter: ChapterItem) => void;
  onOpenDetailModal: (item: ChapterItem) => void;
  onOpenCreateVolume: () => void;
  onOpenCreateChapter: (volumeId?: number | string | null) => void;
  onDeleteItem: (id: number | string) => void;
}

export default function TreePanel({
  volumes,
  chaptersByVolume,
  unassignedChapters,
  activeChapterId,
  onSelectChapter,
  onOpenDetailModal,
  onOpenCreateVolume,
  onOpenCreateChapter,
  onDeleteItem,
}: TreePanelProps) {
  const [collapsedVolumeIds, setCollapsedVolumeIds] = useState<Record<string | number, boolean>>({});

  const toggleVolumeCollapse = (volId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedVolumeIds((prev) => ({ ...prev, [volId]: !prev[volId] }));
  };

  const renderStatusDot = (status: string) => {
    return <span className={`${styles.statusDot} ${styles[status] || styles.not_started}`} />;
  };

  return (
    <aside className={styles.treePanel}>
      <div className={styles.treeHeader}>
        <Flex align="center" gap={6}>
          <Text fw={700} fz={15} c="#1e293b">
            目录大纲
          </Text>
        </Flex>

        <Flex gap={6}>
          <Tooltip label="新建分卷 (文件夹)" withArrow position="bottom">
            <Button
              size="xs"
              variant="light"
              color="indigo"
              leftSection={<FiFolderPlus size={13} />}
              onClick={onOpenCreateVolume}
            >
              新建卷
            </Button>
          </Tooltip>

          <Button
            size="xs"
            leftSection={<FiFilePlus size={13} />}
            onClick={() => onOpenCreateChapter(null)}
          >
            新建章
          </Button>
        </Flex>
      </div>

      <div className={styles.treeContent}>
        {/* 1. 各分卷及其包含的章节 */}
        {volumes.map((vol) => {
          const list = chaptersByVolume[vol.id] || [];
          const isCollapsed = collapsedVolumeIds[vol.id];
          const volWords = list.reduce((sum, c) => sum + (c.wordCount || 0), 0);

          return (
            <div key={vol.id} className={styles.volumeBlock}>
              <div
                className={styles.volumeHeader}
                onClick={() => onOpenDetailModal(vol)}
              >
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={(e) => toggleVolumeCollapse(vol.id, e)}
                  style={{ marginRight: 2 }}
                >
                  {isCollapsed ? <FiChevronRight size={13} /> : <FiChevronDown size={13} />}
                </ActionIcon>

                <FiFolder size={14} color="#6366f1" />
                <span className={styles.volumeTitle} title={vol.title}>
                  {vol.title}
                </span>

                <Badge size="xs" color="gray" variant="light" style={{ marginLeft: 4 }}>
                  {list.length}章 · {volWords.toLocaleString()}字
                </Badge>

                <div className={styles.volumeActions}>
                  <Tooltip label="分卷详情设定" withArrow position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetailModal(vol);
                      }}
                    >
                      <FiInfo size={12} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="在此卷下新建章" withArrow position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCreateChapter(vol.id);
                      }}
                    >
                      <FiFilePlus size={12} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="删除卷" withArrow position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(vol.id);
                      }}
                    >
                      <FiTrash2 size={12} />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </div>

              {/* 卷内章节列表 */}
              {!isCollapsed && (
                <div>
                  {list.map((ch) => {
                    const isActive = activeChapterId === ch.id;
                    return (
                      <div
                        key={ch.id}
                        className={`${styles.chapterItem} ${isActive ? styles.active : ""}`}
                        onClick={() => onSelectChapter(ch)}
                      >
                        {renderStatusDot(ch.status)}
                        <FiFileText size={13} style={{ marginRight: 2 }} />
                        <span className={styles.chapterTitle} title={ch.title}>
                          {ch.title}
                        </span>
                        <Text fz={11} c="#94a3b8" style={{ marginLeft: "auto", marginRight: 4 }}>
                          {(ch.wordCount || 0).toLocaleString()}字
                        </Text>

                        <div className={styles.chapterActions}>
                          <Tooltip label="查看章节详情" withArrow position="top">
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="blue"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDetailModal(ch);
                              }}
                            >
                              <FiInfo size={12} />
                            </ActionIcon>
                          </Tooltip>

                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(ch.id);
                            }}
                          >
                            <FiTrash2 size={12} />
                          </ActionIcon>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* 2. 未分卷的独立章节 */}
        {unassignedChapters.length > 0 && (
          <div className={styles.volumeBlock}>
            {volumes.length > 0 && (
              <Text fz={11} fw={700} c="#94a3b8" px={8} py={4}>
                未分卷章节 ({unassignedChapters.length})
              </Text>
            )}

            {unassignedChapters.map((ch) => {
              const isActive = activeChapterId === ch.id;
              return (
                <div
                  key={ch.id}
                  className={`${styles.chapterItem} ${isActive ? styles.active : ""}`}
                  style={{ marginLeft: volumes.length > 0 ? 8 : 0 }}
                  onClick={() => onSelectChapter(ch)}
                >
                  {renderStatusDot(ch.status)}
                  <FiFileText size={13} style={{ marginRight: 2 }} />
                  <span className={styles.chapterTitle} title={ch.title}>
                    {ch.title}
                  </span>
                  <Text fz={11} c="#94a3b8" style={{ marginLeft: "auto", marginRight: 4 }}>
                    {(ch.wordCount || 0).toLocaleString()}字
                  </Text>

                  <div className={styles.chapterActions}>
                    <Tooltip label="查看章节详情" withArrow position="top">
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetailModal(ch);
                        }}
                      >
                        <FiInfo size={12} />
                      </ActionIcon>
                    </Tooltip>

                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(ch.id);
                      }}
                    >
                      <FiTrash2 size={12} />
                    </ActionIcon>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {volumes.length === 0 && unassignedChapters.length === 0 && (
          <Flex direction="column" align="center" justify="center" py={40} gap={10} c="#94a3b8">
            <FiFileText size={36} strokeWidth={1.5} />
            <Text fz={13}>暂无章节内容</Text>
            <Button size="xs" onClick={() => onOpenCreateChapter(null)}>
              创建第一章
            </Button>
          </Flex>
        )}
      </div>
    </aside>
  );
}
