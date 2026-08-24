"use client";

import React from "react";
import { Box, Flex, Text, Paper, Button } from "@mantine/core";
import { FiEdit3 } from "react-icons/fi";
import NoData from "@/components/common/no-data";
import styles from "../style.module.scss";

export interface RecentChapterData {
  novelTitle: string;
  chapterTitle: string;
  wordCount: string;
  progressDesc: string;
}

interface RecentChapterProps {
  data?: RecentChapterData | null;
  onContinue?: () => void;
}

export default function RecentChapterCard({
  data,
  onContinue,
}: RecentChapterProps) {
  if (!data) {
    return (
      <Paper p="24px 28px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
        <NoData title="暂无最近编辑内容" />
      </Paper>
    );
  }

  return (
    <Paper
      p="24px 28px"
      bg="#ffffff"
      bd="1px solid #e2e8f0"
      radius="md"
      className={styles.heroCard}
    >
      <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
        <Box>
          <Flex align="center" gap={8}>
            <Box
              bg="rgba(0, 201, 255, 0.12)"
              c="#0099cc"
              fz={11}
              fw={600}
              px={8}
              py={2}
              style={{ borderRadius: 4 }}
            >
              最近编辑
            </Box>
            <Text fz={13} c="#64748b">
              {data.novelTitle}
            </Text>
          </Flex>

          <Text fz={20} fw={700} c="#1e293b" my={8}>
            {data.chapterTitle}
          </Text>

          <Text fz={13} c="#94a3b8">
            {data.progressDesc}
          </Text>
        </Box>

        <Button
          className={styles.continueBtn}
          onClick={onContinue}
          leftSection={<FiEdit3 size={16} />}
          size="md"
          radius="md"
        >
          继续写作
        </Button>
      </Flex>
    </Paper>
  );
}
