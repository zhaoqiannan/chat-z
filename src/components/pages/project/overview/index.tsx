"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Flex,
  Text,
  Paper,
  SimpleGrid,
  Button,
  LoadingOverlay,
} from "@mantine/core";
import {
  FiEdit3,
  FiCompass,
} from "react-icons/fi";
import { getWorkDetail, WorkItem } from "@/rest/work";

export default function ProjectOverviewPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [work, setWork] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workId) return;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await getWorkDetail(workId);
        if (res && res.success && res.result) {
          setWork(res.result);
        }
      } catch (e) {
        console.error("获取项目详情失败:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [workId]);

  const getStatusBadge = (status?: string) => {
    const isCompleted = status === "completed" || status === "已完结";
    return (
      <Box
        bg={isCompleted ? "#e6fcf5" : "rgba(0, 201, 255, 0.12)"}
        c={isCompleted ? "#0ca678" : "#0099cc"}
        fz={11}
        fw={600}
        px={8}
        py={2}
        style={{ borderRadius: 4 }}
      >
        {isCompleted ? "已完结" : "连载中"}
      </Box>
    );
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading && !work} />

      <Flex p={10} direction="column" gap={15}>
        {/* 项目头部基础信息 */}
        <Paper p="22px 26px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
          <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
            <Flex align="center" gap={10}>
              <Text fz={22} fw={800} c="#1e293b">
                {work?.title || "加载中..."}
              </Text>
              {work?.tag && (
                <Box
                  bg="rgba(0, 201, 255, 0.12)"
                  c="#0099cc"
                  fz={11}
                  fw={600}
                  px={8}
                  py={2}
                  style={{ borderRadius: 4 }}
                >
                  {work.tag}
                </Box>
              )}
              {getStatusBadge(work?.status)}
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
            {work?.description || "暂无作品简介与大纲概要"}
          </Text>
        </Paper>

        {/* 核心数据统计指标 */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={16}>
          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={12} c="#94a3b8" mb={6}>
              总字数
            </Text>
            <Text fz={24} fw={800} c="#1e293b">
              {(work?.wordCount || 0).toLocaleString()} 字
            </Text>
          </Paper>

          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={12} c="#94a3b8" mb={6}>
              章节进度
            </Text>
            <Text fz={24} fw={800} c="#00c9ff">
              共 {work?.chapterCount || 0} / {work?.expectedChapters || 100} 章
            </Text>
          </Paper>

          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={12} c="#94a3b8" mb={6}>
              核心角色
            </Text>
            <Text fz={24} fw={800} c="#3b82f6">
              --
            </Text>
          </Paper>

          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={12} c="#94a3b8" mb={6}>
              大纲完成度
            </Text>
            <Text fz={24} fw={800} c="#10b981">
              --
            </Text>
          </Paper>
        </SimpleGrid>

        {/* <Paper p="20px 24px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
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
        </Paper> */}
      </Flex>
    </Box>
  );
}
