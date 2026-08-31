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
  FiSidebar,
} from "react-icons/fi";
import { ChapterItem } from "@/rest/chapter";
import styles from "../style.module.scss";

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
    <aside className={`${styles.treePanel} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.treeHeader}>
        <Flex align="center" gap={8}>
          <Tooltip label="收起目录 (专注写作)" withArrow position="bottom">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCollapse}>
              <FiSidebar size={15} />
            </ActionIcon>
          </Tooltip>
          <Text fw={700} fz={14} c="#1e293b">
            目录大纲
          </Text>
        </Flex>

        <Flex gap={4}>
          <Tooltip label="新建分卷" withArrow position="bottom">
            <ActionIcon
              size="sm"
              variant="light"
              color="indigo"
              onClick={onOpenCreateVolume}
            >
              <FiFolderPlus size={14} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="新建正文章节" withArrow position="bottom">
            <ActionIcon
              size="sm"
              variant="light"
              color="cyan"
              onClick={() => onOpenCreateChapter(null)}
            >
              <FiFilePlus size={14} />
            </ActionIcon>
          </Tooltip>
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
                className={`${styles.volumeHeader} ${activeChapterId === vol.id ? styles.active : ""}`}
                onClick={(e) => toggleVolumeCollapse(vol.id, e)}
              >
                {isCollapsed ? <FiChevronRight size={13} /> : <FiChevronDown size={13} />}
                <FiFolder size={14} color="#6366f1" style={{ marginLeft: 4 }} />
                <span className={styles.volumeTitle}>{vol.title}</span>

                <div className={styles.volumeActions} onClick={(e) => e.stopPropagation()}>
                  <Tooltip label="分卷设定" withArrow position="top">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => onOpenDetailModal(vol)}
                    >
                      <FiInfo size={12} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="在此卷下新建章" withArrow position="top">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      size="xs"
                      onClick={() => onOpenCreateChapter(vol.id)}
                    >
                      <FiFilePlus size={12} />
                    </ActionIcon>
                  </Tooltip>

                  <Tooltip label="删除卷" withArrow position="top">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => onDeleteItem(vol.id)}
                    >
                      <FiTrash2 size={12} />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </div>

              {/* 卷下的章节列表 */}
              {!isCollapsed && (
                <div>
                  {list.map((ch) => (
                    <div
                      key={ch.id}
                      className={`${styles.chapterItem} ${activeChapterId === ch.id ? styles.active : ""}`}
                      onClick={() => onSelectChapter(ch)}
                    >
                      {renderStatusDot(ch.status)}
                      <span className={styles.chapterTitle}>
                        第 {ch.chapterNumber} 章 {ch.title}
                      </span>

                      <div className={styles.chapterActions} onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="xs"
                          onClick={() => onOpenDetailModal(ch)}
                        >
                          <FiInfo size={12} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="xs"
                          onClick={() => onDeleteItem(ch.id)}
                        >
                          <FiTrash2 size={12} />
                        </ActionIcon>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 2. 未归入分卷的独立章节 */}
        {unassignedChapters.length > 0 && (
          <div className={styles.volumeBlock} style={{ marginTop: 8 }}>
            <Text fz={11} fw={700} c="#94a3b8" p="4px 8px">
              独立章节 ({unassignedChapters.length})
            </Text>
            {unassignedChapters.map((ch) => (
              <div
                key={ch.id}
                className={`${styles.chapterItem} ${activeChapterId === ch.id ? styles.active : ""}`}
                onClick={() => onSelectChapter(ch)}
              >
                {renderStatusDot(ch.status)}
                <span className={styles.chapterTitle}>
                  第 {ch.chapterNumber} 章 {ch.title}
                </span>

                <div className={styles.chapterActions} onClick={(e) => e.stopPropagation()}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="xs"
                    onClick={() => onOpenDetailModal(ch)}
                  >
                    <FiInfo size={12} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="xs"
                    onClick={() => onDeleteItem(ch.id)}
                  >
                    <FiTrash2 size={12} />
                  </ActionIcon>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
