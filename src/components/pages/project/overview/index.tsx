"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Box, Flex, Text, Paper, SimpleGrid, Button } from "@mantine/core";
import LoadingMask from "@/components/common/loading-mask";
import { FiEdit3, FiCompass, FiShield } from "react-icons/fi";
import { getWorkDetail, WorkItem } from "@/rest/work";
import { getAnalysisOverview, AnalysisWorkMetrics } from "@/rest/analysis";

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  completed: { label: "已完结", bg: "#e6fcf5", color: "#0ca678" },
  revising: { label: "精修打磨中", bg: "#fff7ed", color: "#ea580c" },
  draft: { label: "构思草稿", bg: "#f1f5f9", color: "#64748b" },
  ongoing: { label: "连载中", bg: "rgba(0, 201, 255, 0.12)", color: "#0099cc" },
};

export default function ProjectOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const workId = String(params?.id || "");

  const [work, setWork] = useState<WorkItem | null>(null);
  const [metrics, setMetrics] = useState<AnalysisWorkMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workId) return;
    let cancelled = false;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const [workRes, overviewRes] = await Promise.all([
          getWorkDetail(workId),
          getAnalysisOverview(workId).catch(() => null),
        ]);
        if (cancelled) return;
        if (workRes && workRes.success && workRes.result) {
          setWork(workRes.result);
        }
        if (overviewRes && overviewRes.success && overviewRes.result?.metrics) {
          setMetrics(overviewRes.result.metrics);
        }
      } catch (e) {
        console.error("获取项目详情失败:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  const statusMeta = STATUS_META[work?.status || "ongoing"] || STATUS_META.ongoing;
  const charCount = metrics?.characters?.length;
  const outlineRate =
    metrics && metrics.chapterCount > 0
      ? `${Math.min(100, Math.round((metrics.outlineNodeCount / metrics.chapterCount) * 100))}%`
      : null;

  return (
    <Box pos="relative">
      <LoadingMask visible={loading && !work} />

      <Flex p={16} direction="column" gap={15}>
        {/* 项目头部基础信息 */}
        <Paper p="22px 26px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
          <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
            <Flex align="center" gap={10}>
              <Text fz={22} fw={800} c="#1e293b">
                {work?.title || "加载中..."}
              </Text>
              {work?.tag ? (
                <Box bg="rgba(0, 201, 255, 0.12)" c="#0099cc" fz={11} fw={600} px={8} py={2} bdrs={4}>
                  {work.tag}
                </Box>
              ) : null}
              <Box bg={statusMeta.bg} c={statusMeta.color} fz={11} fw={600} px={8} py={2} bdrs={4}>
                {statusMeta.label}
              </Box>
            </Flex>

            <Flex align="center" gap={10}>
              <Button variant="outline" color="gray" size="sm" leftSection={<FiCompass size={15} />} onClick={() => router.push(`/project/${workId}?tab=outline`)}>
                查看总纲脑图
              </Button>
              <Button variant="light" size="sm" leftSection={<FiShield size={15} />} onClick={() => router.push(`/project/${workId}?tab=ai_analysis`)}>
                质量诊断
              </Button>
              <Button size="sm" leftSection={<FiEdit3 size={15} />} onClick={() => router.push(`/project/${workId}?tab=chapters`)}>
                进入写作
              </Button>
            </Flex>
          </Flex>

          <Text fz={13} c="#64748b" mt={12} lh={1.6} style={{ whiteSpace: "pre-wrap" }}>
            {work?.description || "暂无作品简介与大纲概要"}
          </Text>
        </Paper>

        {/* 核心数据统计指标 */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={16}>
          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={12} c="#94a3b8" mb={6}>总字数</Text>
            <Text fz={24} fw={800} c="#1e293b">
              {(metrics?.totalWords ?? work?.wordCount ?? 0).toLocaleString()} 字
            </Text>
          </Paper>

          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
            <Text fz={12} c="#94a3b8" mb={6}>章节进度</Text>
            <Text fz={24} fw={800} c="#00c9ff">
              共 {metrics?.chapterCount ?? work?.chapterCount ?? 0} / {work?.expectedChapters || 100} 章
            </Text>
          </Paper>

          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md" style={{ cursor: "pointer" }} onClick={() => router.push(`/project/${workId}?tab=world&subTab=characters`)}>
            <Text fz={12} c="#94a3b8" mb={6}>核心角色</Text>
            <Text fz={24} fw={800} c="#3b82f6">
              {charCount !== undefined ? `${charCount} 位` : "--"}
            </Text>
          </Paper>

          <Paper p="16px 20px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md" style={{ cursor: "pointer" }} onClick={() => router.push(`/project/${workId}?tab=outline`)}>
            <Text fz={12} c="#94a3b8" mb={6}>大纲节点 / 覆盖度</Text>
            <Text fz={24} fw={800} c="#10b981">
              {metrics ? `${metrics.outlineNodeCount} 条${outlineRate ? ` (${outlineRate})` : ""}` : "--"}
            </Text>
          </Paper>
        </SimpleGrid>
      </Flex>
    </Box>
  );
}
