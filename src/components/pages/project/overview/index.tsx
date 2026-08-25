"use client";

import React from "react";
import {
  Box,
  Flex,
  Text,
  Paper,
  SimpleGrid,
  Button,
  Progress,
  ActionIcon,
} from "@mantine/core";
import {
  FiEdit3,
  FiCompass,
  FiPlus,
  FiZap,
  FiPlusCircle,
} from "react-icons/fi";
import { projectOverviewMockData } from "./mock.js";

export default function ProjectOverviewPage() {
  const data = projectOverviewMockData;

  const getStatusBadge = (status: string) => {
    if (status === "已完成") {
      return (
        <Box
          bg="#e6fcf5"
          c="#0ca678"
          fz={11}
          fw={600}
          px={8}
          py={2}
          style={{ borderRadius: 4 }}
        >
          已完成
        </Box>
      );
    }
    if (status === "写作中") {
      return (
        <Box
          bg="rgba(0, 201, 255, 0.12)"
          c="#0099cc"
          fz={11}
          fw={600}
          px={8}
          py={2}
          style={{ borderRadius: 4 }}
        >
          写作中
        </Box>
      );
    }
    return (
      <Box
        bg="#f1f5f9"
        c="#94a3b8"
        fz={11}
        fw={600}
        px={8}
        py={2}
        style={{ borderRadius: 4 }}
      >
        未开始
      </Box>
    );
  };

  return (
    <Box p="24px 28px 48px" maw={1440} mx="auto">
      <Flex gap={24} align="flex-start" direction={{ base: "column", lg: "row" }}>
        {/* 左侧主要内容 */}
        <Flex direction="column" gap={20} style={{ flex: 1, minWidth: 0 }} w="100%">
          {/* 项目头部卡片 */}
          <Paper p="22px 26px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
              <Flex align="center" gap={10}>
                <Text fz={22} fw={800} c="#1e293b">
                  {data.title}
                </Text>
                <Box
                  bg="rgba(0, 201, 255, 0.12)"
                  c="#0099cc"
                  fz={11}
                  fw={600}
                  px={8}
                  py={2}
                  style={{ borderRadius: 4 }}
                >
                  {data.tag}
                </Box>
                <Box
                  bg="#e6fcf5"
                  c="#0ca678"
                  fz={11}
                  fw={600}
                  px={8}
                  py={2}
                  style={{ borderRadius: 4 }}
                >
                  {data.status}
                </Box>
              </Flex>

              <Flex align="center" gap={10}>
                <Button
                  variant="outline"
                  color="gray"
                  size="sm"
                  leftSection={<FiCompass size={15} />}
                >
                  查看脑图
                </Button>
                <Button
                  size="sm"
                  leftSection={<FiEdit3 size={15} />}
                >
                  进入写作
                </Button>
              </Flex>
            </Flex>

            <Text fz={13} c="#64748b" mt={12} lh={1.6}>
              {data.summary}
            </Text>
          </Paper>

          {/* 4个核心数据统计指标 */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={16}>
            <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
              <Text fz={12} c="#94a3b8" mb={6}>
                总字数
              </Text>
              <Text fz={24} fw={800} c="#1e293b">
                {data.stats.totalWords}
              </Text>
            </Paper>

            <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
              <Text fz={12} c="#94a3b8" mb={6}>
                章节进度
              </Text>
              <Text fz={24} fw={800} c="#00c9ff">
                {data.stats.chapterProgress}
              </Text>
            </Paper>

            <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
              <Text fz={12} c="#94a3b8" mb={6}>
                核心角色
              </Text>
              <Text fz={24} fw={800} c="#3b82f6">
                {data.stats.coreCharacters}
              </Text>
            </Paper>

            <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
              <Text fz={12} c="#94a3b8" mb={6}>
                大纲完成度
              </Text>
              <Text fz={24} fw={800} c="#10b981">
                {data.stats.outlineProgress}
              </Text>
            </Paper>
          </SimpleGrid>

          {/* 故事大纲结构进度 */}
          <Paper p="20px 24px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={15} fw={700} c="#1e293b" mb={16}>
              故事大纲结构进度
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={16}>
              {data.actProgress.map((act) => (
                <Box
                  key={act.name}
                  p="14px 16px"
                  bg="#f8fafc"
                  bd="1px solid #f1f5f9"
                  style={{ borderRadius: 8 }}
                >
                  <Flex justify="space-between" align="center" mb={10}>
                    <Text fz={13} fw={700} c="#1e293b">
                      {act.name}
                    </Text>
                    {getStatusBadge(act.status)}
                  </Flex>
                  <Progress
                    value={act.percent}
                    color={act.color}
                    size={6}
                    radius="xl"
                  />
                </Box>
              ))}
            </SimpleGrid>
          </Paper>

          {/* 近期目录章节 */}
          <Paper p="20px 24px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Flex justify="space-between" align="center" mb={16}>
              <Text fz={15} fw={700} c="#1e293b">
                近期目录章节
              </Text>
              <Flex
                align="center"
                gap={4}
                fz={13}
                fw={600}
                c="#00c9ff"
                style={{ cursor: "pointer" }}
              >
                <FiPlus size={14} />
                新建章节
              </Flex>
            </Flex>

            <Flex direction="column">
              {data.recentChapters.map((chap, idx) => (
                <Flex
                  key={chap.id}
                  justify="space-between"
                  align="center"
                  py={12}
                  style={{
                    borderBottom:
                      idx < data.recentChapters.length - 1
                        ? "1px solid #f1f5f9"
                        : "none",
                  }}
                >
                  <Flex align="center" gap={12}>
                    <Text fz={13} c="#94a3b8" w={56}>
                      {chap.index}
                    </Text>
                    <Text fz={14} fw={600} c="#1e293b">
                      {chap.title}
                    </Text>
                  </Flex>

                  <Flex align="center" gap={20}>
                    {getStatusBadge(chap.status)}
                    <Text fz={12} c="#64748b" w={64} ta="right">
                      {chap.wordCount}
                    </Text>
                    <Text fz={12} c="#94a3b8" w={56} ta="right">
                      {chap.time}
                    </Text>
                    <ActionIcon variant="subtle" color="gray" size="sm">
                      <FiEdit3 size={14} />
                    </ActionIcon>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Paper>
        </Flex>

        {/* 右侧侧边栏 */}
        <Flex
          direction="column"
          gap={20}
          w={{ base: "100%", lg: 340 }}
          style={{ flexShrink: 0 }}
        >
          {/* AI 写作改进建议 */}
          <Paper p="20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Flex align="center" gap={8} mb={14}>
              <FiZap size={18} color="#00c9ff" />
              <Text fz={15} fw={700} c="#1e293b">
                AI 写作改进建议
              </Text>
            </Flex>

            <Flex direction="column" gap={12}>
              {data.aiSuggestions.map((item) => (
                <Box
                  key={item.id}
                  bg={item.type === "warning" ? "#fffbeb" : "#eff6ff"}
                  bd={`1px solid ${item.type === "warning" ? "#fef3c7" : "#dbeafe"}`}
                  p="12px 14px"
                  style={{ borderRadius: 8 }}
                >
                  <Text
                    fz={13}
                    fw={700}
                    c={item.type === "warning" ? "#b45309" : "#1d4ed8"}
                    mb={4}
                  >
                    ● {item.title}
                  </Text>
                  <Text
                    fz={12}
                    c={item.type === "warning" ? "#92400e" : "#1e40af"}
                    lh={1.6}
                  >
                    {item.content}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Paper>

          {/* 近期更新设定 */}
          <Paper p="20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={15} fw={700} c="#1e293b" mb={14}>
              近期更新设定
            </Text>
            <SimpleGrid cols={2} spacing={10}>
              {data.recentLores.map((lore) => (
                <Box
                  key={lore.id}
                  p="10px 12px"
                  bg="#f8fafc"
                  bd="1px solid #f1f5f9"
                  style={{ borderRadius: 8, textAlign: "center" }}
                >
                  <Text fz={13} fw={700} c="#1e293b">
                    {lore.name}
                  </Text>
                  <Text fz={11} c="#94a3b8" mt={2}>
                    {lore.desc}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </Paper>

          {/* 备忘与灵感笔记 */}
          <Paper p="20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Flex justify="space-between" align="center" mb={14}>
              <Text fz={15} fw={700} c="#1e293b">
                备忘与灵感笔记
              </Text>
              <ActionIcon variant="subtle" color="cyan" size="sm">
                <FiPlusCircle size={16} color="#00c9ff" />
              </ActionIcon>
            </Flex>

            <Flex direction="column" gap={12}>
              {data.memos.map((memo) => (
                <Box
                  key={memo.id}
                  p="10px 12px"
                  bg="#f8fafc"
                  bd="1px solid #f1f5f9"
                  style={{ borderRadius: 8 }}
                >
                  <Flex justify="space-between" align="baseline" gap={8} mb={4}>
                    <Text fz={13} fw={600} c="#1e293b" lineClamp={1}>
                      {memo.title}
                    </Text>
                    <Text fz={11} c="#94a3b8" style={{ whiteSpace: "nowrap" }}>
                      {memo.time}
                    </Text>
                  </Flex>
                  <Text fz={12} c="#64748b" lh={1.5} lineClamp={2}>
                    {memo.content}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Paper>
        </Flex>
      </Flex>
    </Box>
  );
}
