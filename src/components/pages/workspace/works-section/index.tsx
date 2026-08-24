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
} from "@mantine/core";
import { FiPlus, FiChevronRight, FiEdit2, FiTrash2 } from "react-icons/fi";
import NoData from "@/components/common/no-data";
import styles from "../style.module.scss";

export interface WorkItem {
  id: string | number;
  title: string;
  tag: string;
  wordCount: string;
  chapterCount: number;
  progress: number;
  lastEditTime: string;
  expectedWords?: number | string;
}

interface WorksSectionProps {
  works?: WorkItem[];
  onCreateWork?: () => void;
  onSelectWork?: (work: WorkItem) => void;
  onEditWork?: (work: WorkItem) => void;
  onDeleteWork?: (work: WorkItem) => void;
}

export default function WorksSection({
  works,
  onCreateWork,
  onSelectWork,
  onEditWork,
  onDeleteWork,
}: WorksSectionProps) {
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

      {works && works.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={16}>
          {works.map((work) => (
            <Paper
              key={work.id}
              p="18px 20px"
              bg="#ffffff"
              bd="1px solid #e2e8f0"
              radius="md"
              className={styles.workCard}
              onClick={() => onSelectWork?.(work)}
            >
              <Flex justify="space-between" align="center">
                <Text fz={15} fw={700} c="#1e293b">
                  {work.title}
                </Text>
                <Flex align="center" gap={6}>
                  <Box
                    fz={11}
                    c="#64748b"
                    bg="#f1f5f9"
                    px={6}
                    py={2}
                    style={{ borderRadius: 4 }}
                  >
                    {work.tag}
                  </Box>

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

              <Flex justify="space-between" align="center" my={12}>
                <Text fz={13} c="#64748b">
                  <b>{Number(work.wordCount || 0).toLocaleString()}</b> 字
                </Text>
                <Text fz={12} c="#94a3b8">
                  目标: <b>{work.expectedWords || 50}</b> 万字
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
                          ((Number(work.expectedWords) || 50) * 10000)) *
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
                        ((Number(work.expectedWords) || 50) * 10000)) *
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
          ))}
        </SimpleGrid>
      ) : (
        <Paper p="24px 28px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
          <NoData
            title="暂无作品"
            description="点击上方“新建作品”开始您的创作"
          />
        </Paper>
      )}
    </Box>
  );
}
