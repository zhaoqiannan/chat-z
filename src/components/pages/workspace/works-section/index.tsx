"use client";

import React from "react";
import {
  Box,
  Flex,
  Text,
  Progress,
  SimpleGrid,
  Paper,
  Tooltip,
  ActionIcon,
  Badge,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { FiPlus, FiChevronRight, FiEdit2, FiTrash2 } from "react-icons/fi";
import { BsPinAngle, BsPinFill } from "react-icons/bs";
import NoData from "@/components/common/no-data";
import styles from "../style.module.scss";
import Loading from "@/components/common/loading";

export interface WorkItem {
  id: string | number;
  title: string;
  tag: string;
  wordCount: string;
  chapterCount: number;
  progress: number;
  lastEditTime: string;
  expectedWords?: number | string;
  expectedChapters?: number | string;
  description?: string;
  isPinned?: boolean | number;
  pinnedAt?: string | null;
}

interface WorksSectionProps {
  works?: WorkItem[];
  onCreateWork?: () => void;
  onSelectWork?: (work: WorkItem) => void;
  onEditWork?: (work: WorkItem) => void;
  onDeleteWork?: (work: WorkItem) => void;
  onTogglePin?: (work: WorkItem) => void;
  loading: boolean;
}

export default function WorksSection({
  works,
  onCreateWork,
  onSelectWork,
  onEditWork,
  onDeleteWork,
  onTogglePin,
  loading
}: WorksSectionProps) {
  const handleConfirmTogglePin = (work: WorkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPinning = !work.isPinned;
    modals.openConfirmModal({
      title: isPinning ? "置顶作品" : "取消置顶",
      centered: true,
      children: (
        <Text size="sm" c="#475569" lh={1.6}>
          确定要{isPinning ? "置顶" : "取消置顶"}作品 <b>《{work.title}》</b> 吗？
          <br />
          <Text span fz="xs" c="#94a3b8">
            {isPinning ? "置顶后该作品将排在工作台最前面。" : "取消置顶后将恢复按创建时间排序。"}
          </Text>
        </Text>
      ),
      labels: { confirm: isPinning ? "确认置顶" : "取消置顶", cancel: "取消" },
      onConfirm: () => onTogglePin?.(work),
    });
  };

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={14}>
        <Text fz={16} fw={700} c="#1e293b">
          我的作品
        </Text>
        <Flex
          align="center"
          gap={4}
          fz={13}
          fw={600}
          c="#00c9ff"
          style={{ cursor: "pointer" }}
          onClick={onCreateWork}
        >
          <FiPlus size={14} />
          新建作品
        </Flex>
      </Flex>
      <Loading loading={loading}>
        {works && works.length > 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 3, lg: 4 }} spacing={16}>
            {works.map((work, i) => {
              const tags = work.tag
                ? work.tag
                  .split(/[,，]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
                : [];

              return (
                <Paper
                  key={work.id + '_' + i}
                  p="18px 20px"
                  bg="#ffffff"
                  bd={work.isPinned ? "1px solid #bae6fd" : "1px solid #e2e8f0"}
                  radius="md"
                  className={styles.workCard}
                  onClick={() => onSelectWork?.(work)}
                >
                  <Flex justify="space-between" align="center">
                    <Flex align="center" gap={6} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {work.isPinned ? (
                        <Badge size="xs" variant="filled" radius="sm">
                          置顶
                        </Badge>
                      ) : null}
                      <Text fz={15} fw={700} c="#1e293b" truncate>
                        {work.title}
                      </Text>
                    </Flex>

                    <Flex align="center" gap={4}>
                      <Tooltip
                        label={work.isPinned ? "取消置顶" : "置顶作品"}
                        position="top"
                        withArrow
                        offset={4}
                      >
                        <ActionIcon
                          variant="subtle"
                          color={work.isPinned ? "cyan" : "gray"}
                          size="sm"
                          onClick={(e) => handleConfirmTogglePin(work, e)}
                          className={styles.cardActionIcon}
                        >
                          {work.isPinned ? (
                            <BsPinFill size={14} color="#00c9ff" />
                          ) : (
                            <BsPinAngle size={14} />
                          )}
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="编辑作品" position="top" withArrow offset={4}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditWork?.(work);
                          }}
                          className={styles.cardActionIcon}
                        >
                          <FiEdit2 size={13} />
                        </ActionIcon>
                      </Tooltip>

                      <Tooltip label="删除作品" position="top" withArrow offset={4}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWork?.(work);
                          }}
                          className={styles.cardActionIcon}
                        >
                          <FiTrash2 size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </Flex>
                  </Flex>

                  {tags.length > 0 && (
                    <Flex wrap="wrap" gap={6} my={10}>
                      {tags.map((t, idx) => (
                        <Badge
                          key={idx}
                          variant="light"
                          color="gray"
                          size="sm"
                          radius="sm"
                          styles={{ root: { textTransform: "none", fontWeight: 500 } }}
                        >
                          {t}
                        </Badge>
                      ))}
                    </Flex>
                  )}

                  <Flex justify="space-between" align="center" my={10}>
                    <Text fz={13} c="#64748b">
                      <b>{Number(work.wordCount || 0).toLocaleString()}</b> 字
                    </Text>
                    <Text fz={12} c="#94a3b8">
                      目标: <b>{((Number(work.expectedWords) || 500000) / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> 万字
                    </Text>
                  </Flex>

                  <Box>
                    <Flex justify="space-between" align="center" mb={6}>
                      <Text fz={12} c="#94a3b8">
                        创作字数进度
                      </Text>
                      <Text fz={12} fw={600} c="#64748b">
                        {Math.min(
                          100,
                          Math.round(
                            ((Number(work.wordCount) || 0) /
                              (Number(work.expectedWords) || 500000)) *
                            100
                          )
                        )}%
                      </Text>
                    </Flex>
                    <Progress
                      value={Math.min(
                        100,
                        Math.round(
                          ((Number(work.wordCount) || 0) /
                            (Number(work.expectedWords) || 500000)) *
                          100
                        )
                      )}
                      color="#00c9ff"
                      size={6}
                      radius="xl"
                    />
                  </Box>

                  <Flex
                    justify="space-between"
                    align="center"
                    mt={14}
                    pt={12}
                    style={{ borderTop: "1px solid #f8fafc" }}
                  >
                    <Text fz={12} c="#94a3b8">
                      上次编辑：{work.lastEditTime}
                    </Text>
                    <FiChevronRight color="#cbd5e1" size={14} />
                  </Flex>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : (
          <Paper p="24px 28px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <NoData
              title="暂无作品"
              description="点击上方“新建作品”开始您的创作"
            />
          </Paper>
        )}
      </Loading>
    </Box>
  );
}
