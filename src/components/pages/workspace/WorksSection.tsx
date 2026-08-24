"use client";

import React from "react";
import { Box, Flex, Text, Progress, SimpleGrid, Paper } from "@mantine/core";
import { FiPlus, FiChevronRight } from "react-icons/fi";
import NoData from "@/components/common/no-data";
import styles from "./style.module.scss";

export interface WorkItem {
  id: string | number;
  title: string;
  tag: string;
  wordCount: string;
  chapterCount: number;
  progress: number;
  lastEditTime: string;
}

interface WorksSectionProps {
  works?: WorkItem[];
  onCreateWork?: () => void;
  onSelectWork?: (work: WorkItem) => void;
}

export default function WorksSection({
  works,
  onCreateWork,
  onSelectWork,
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
              </Flex>

              <Text fz={13} c="#64748b" my={12}>
                {work.wordCount}字 · {work.chapterCount}章
              </Text>

              <Box>
                <Flex justify="space-between" align="center" mb={6}>
                  <Text fz={12} c="#94a3b8">
                    总大纲进度
                  </Text>
                  <Text fz={12} fw={600} c="#64748b">
                    {work.progress}%
                  </Text>
                </Flex>
                <Progress
                  value={work.progress}
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
