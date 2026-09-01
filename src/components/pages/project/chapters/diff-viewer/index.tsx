"use client";

import React, { useState } from "react";
import {
  Box,
  Text,
  Button,
  Paper,
  SimpleGrid,
  Badge,
  Group,
  Stack,
  ScrollArea,
  Textarea,
} from "@mantine/core";
import { FiCheck, FiX } from "react-icons/fi";

interface DiffViewerProps {
  originalText: string;
  optimizedText: string;
  onAccept: (newText: string) => void;
  onReject: () => void;
}

export default function DiffViewer({
  originalText,
  optimizedText,
  onAccept,
  onReject,
}: DiffViewerProps) {
  const [currentOptimized, setCurrentOptimized] = useState(optimizedText);

  const origWordCount = originalText.replace(/\s+/g, "").length;
  const optWordCount = currentOptimized.replace(/\s+/g, "").length;
  const diffCount = optWordCount - origWordCount;

  return (
    <Paper
      p="md"
      withBorder
      shadow="sm"
      radius="md"
      style={{
        backgroundColor: "#ffffff",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 顶部操作控制条 */}
      <Paper
        p="xs"
        pb="sm"
        mb="sm"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", backgroundColor: "#ffffff" }}
      >
        <Group justify="space-between" align="center">
          <Group gap="sm" align="center">
            <Text fw={700} fz={16} c="dark.6">
              AI 润色与修改对比视图
            </Text>
            <Badge
              color={diffCount >= 0 ? "teal" : "orange"}
              variant="light"
              size="md"
            >
              {diffCount >= 0 ? `+${diffCount} 字` : `${diffCount} 字`}
            </Badge>
          </Group>

          <Group gap="xs">
            <Button
              variant="outline"
              size="sm"
              color="gray"
              leftSection={<FiX size={14} />}
              onClick={onReject}
            >
              放弃修改 (保留原文)
            </Button>

            <Button
              color="teal"
              size="sm"
              leftSection={<FiCheck size={14} />}
              onClick={() => onAccept(currentOptimized)}
            >
              一键采纳 (替换原文)
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* 双栏对比区 */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" style={{ flex: 1, minHeight: 0 }}>
        {/* 左栏：现有文章 (原文) */}
        <Paper
          withBorder
          radius="md"
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--mantine-color-gray-0)",
            overflow: "hidden",
          }}
        >
          <Paper
            p="xs"
            px="md"
            style={{
              backgroundColor: "var(--mantine-color-gray-1)",
              borderBottom: "1px solid var(--mantine-color-gray-3)",
            }}
          >
            <Group justify="space-between" align="center">
              <Text fw={700} fz={13} c="dark.4">
                📄 现有文章 (原文)
              </Text>
              <Text fz={12} c="dimmed">
                {origWordCount.toLocaleString()} 字
              </Text>
            </Group>
          </Paper>

          <ScrollArea style={{ flex: 1 }} p="md">
            <Text fz={14} lh={1.8} c="dark.5" style={{ whiteSpace: "pre-wrap" }}>
              {originalText || "（暂无正文）"}
            </Text>
          </ScrollArea>
        </Paper>

        {/* 右栏：AI 优化后文章 (支持二次微调) */}
        <Paper
          withBorder
          radius="md"
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--mantine-color-teal-0)",
            borderColor: "var(--mantine-color-teal-2)",
            overflow: "hidden",
          }}
        >
          <Paper
            p="xs"
            px="md"
            style={{
              backgroundColor: "var(--mantine-color-teal-1)",
              borderBottom: "1px solid var(--mantine-color-teal-2)",
            }}
          >
            <Group justify="space-between" align="center">
              <Text fw={700} fz={13} c="teal.9">
                ✨ AI 优化后文章 (可直接编辑微调)
              </Text>
              <Text fz={12} c="teal.8" fw={600}>
                {optWordCount.toLocaleString()} 字
              </Text>
            </Group>
          </Paper>

          <Box p="sm" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Textarea
              variant="unstyled"
              value={currentOptimized}
              onChange={(e) => setCurrentOptimized(e.target.value)}
              styles={{
                root: { flex: 1, display: "flex", flexDirection: "column" },
                wrapper: { flex: 1, display: "flex", flexDirection: "column" },
                input: {
                  flex: 1,
                  height: "100%",
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: "var(--mantine-color-teal-9)",
                  padding: 0,
                },
              }}
            />
          </Box>
        </Paper>
      </SimpleGrid>
    </Paper>
  );
}
