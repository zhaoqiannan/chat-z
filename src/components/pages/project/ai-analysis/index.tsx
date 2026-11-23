"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ActionIcon, Badge, Box, Button, Center, Flex, Group, MultiSelect, NumberInput, Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import { FiBook, FiClock, FiCpu, FiLayers, FiPlay, FiShield, FiTrash2, FiUserCheck } from "react-icons/fi";
import { AiAnalysisType, AnalysisReportRecord, AnalysisWorkMetrics, deleteAnalysisReport, getAnalysisOverview, runAiAnalysis } from "@/rest/analysis";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";
import ReportViewer from "./report-viewer";
import styles from "./style.module.scss";

const TYPE_LABEL: Record<AiAnalysisType, string> = {
  book_overview: "全书总览",
  chapter_range: "区间模块",
  logic_audit: "逻辑审查",
  character_audit: "人物分析",
};

export default function AiAnalysisPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<AnalysisWorkMetrics | null>(null);
  const [history, setHistory] = useState<AnalysisReportRecord[]>([]);
  const [activeReport, setActiveReport] = useState<AnalysisReportRecord | null>(null);

  const [activeTab, setActiveTab] = useState<string>("book_overview");
  const [auditSubMode, setAuditSubMode] = useState<"logic_audit" | "character_audit">("logic_audit");

  // 区间与审计参数
  const [startChapter, setStartChapter] = useState<number>(1);
  const [endChapter, setEndChapter] = useState<number>(5);
  const [expectedGoal, setExpectedGoal] = useState<string>("");
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  const fetchOverview = useCallback(async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getAnalysisOverview(workId);
      if (res && res.success && res.result) {
        setMetrics(res.result.metrics);
        const list = res.result.history || [];
        setHistory(list);
        if (list.length > 0 && !activeReport) {
          setActiveReport(list[0]);
        }
        const maxCh = res.result.metrics.chapters.length;
        if (maxCh > 0) {
          setEndChapter((prev) => (prev > maxCh ? maxCh : prev));
        }
      }
    } catch (e: any) {
      useAlert.error("加载分析数据失败: " + (e?.message || "网络异常"));
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 响应从「项目总纲」跳转携带的区间参数
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const rangeParam = searchParams.get("range");
    const goalParam = searchParams.get("goal");
    if (modeParam === "range") {
      setActiveTab("chapter_range");
      if (rangeParam) {
        const nums = rangeParam.match(/\d+/g);
        if (nums && nums.length >= 1) {
          const s = Number(nums[0]);
          const e = nums.length >= 2 ? Number(nums[1]) : s;
          if (!isNaN(s)) setStartChapter(s);
          if (!isNaN(e)) setEndChapter(Math.max(s, e));
        }
      }
      if (goalParam) setExpectedGoal(goalParam);
    }
  }, [searchParams]);

  const currentAnalysisType: AiAnalysisType =
    activeTab === "book_overview"
      ? "book_overview"
      : activeTab === "chapter_range"
        ? "chapter_range"
        : auditSubMode;

  const handleRunAnalysis = async () => {
    if (!workId) return;
    if (currentAnalysisType === "character_audit" && selectedCharIds.length === 0) {
      useAlert.warning("请至少选择 1 位需要分析的角色");
      return;
    }

    try {
      setRunning(true);
      const res = await runAiAnalysis({
        workId,
        analysisType: currentAnalysisType,
        startChapter,
        endChapter: Math.max(startChapter, endChapter),
        expectedGoal: expectedGoal.trim() || undefined,
        characterIds: selectedCharIds.map(Number).filter((n) => !isNaN(n)),
      });

      if (res && res.success && res.result) {
        setActiveReport(res.result);
        setHistory((prev) => [res.result!, ...prev.filter((r) => r.id !== res.result!.id)]);
        useAlert.success("AI 深度分析完成！");
      } else {
        useAlert.error(res?.message || "AI 分析失败");
      }
    } catch (e: any) {
      useAlert.error("AI 分析异常: " + (e?.message || "网络异常"));
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteReport = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await deleteAnalysisReport(id);
      if (res && res.success) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (activeReport?.id === id) {
          setActiveReport(null);
        }
        useAlert.success("已删除历史报告");
      }
    } catch (err: any) {
      useAlert.error("删除失败: " + (err?.message || "网络异常"));
    }
  };

  const handlePickVolume = (volId: string | null) => {
    if (!volId || !metrics) return;
    const chs = metrics.chapters.filter((c) => String(c.volumeId) === volId);
    if (chs.length > 0) {
      setStartChapter(chs[0].chapterNumber);
      setEndChapter(chs[chs.length - 1].chapterNumber);
    }
  };

  const handlePickMasterNode = (nodeId: string | null) => {
    if (!nodeId || !metrics) return;
    const node = metrics.masterNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const nums = node.chapterRange.match(/\d+/g);
    if (nums && nums.length >= 1) {
      const s = Number(nums[0]);
      const e = nums.length >= 2 ? Number(nums[1]) : s;
      setStartChapter(s);
      setEndChapter(Math.max(s, e));
    }
    setExpectedGoal(node.title);
  };

  const maxChapterNum = useMemo(() => {
    if (!metrics || metrics.chapters.length === 0) return 100;
    return Math.max(...metrics.chapters.map((c) => c.chapterNumber));
  }, [metrics]);

  return (
    <Box className={styles.page}>
      <LoadingMask visible={loading && !metrics} label="正在加载作品数据..." />

      {/* 顶部 Tab 导航 */}
      <Box px="md" pt={6} className={styles.headerBar}>
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v || "book_overview")}>
          <Tabs.List>
            <Tabs.Tab value="book_overview" leftSection={<FiBook size={14} color="#00c9ff" />}>
              全书宏观分析
            </Tabs.Tab>
            <Tabs.Tab value="chapter_range" leftSection={<FiLayers size={14} color="#00c9ff" />}>
              区间 / 节点模块分析
            </Tabs.Tab>
            <Tabs.Tab value="audit" leftSection={<FiShield size={14} color="#00c9ff" />}>
              逻辑与人物审计
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Box>

      {/* 主体两栏：左侧分析配置与报告，右侧历史记录 */}
      <Flex flex={1} mih={0} style={{ overflow: "hidden" }}>
        <ScrollArea flex={1} px={20} py={16}>
          <Stack gap={14} maw={960} mx="auto" pb={48}>
            {/* 0-Token 全书硬指标概览条 */}
            {metrics ? (
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={10}>
                <Paper p="10px 12px" radius="sm" bg="#fafbfc" bd="1px solid #f1f5f9">
                  <Text fz={11} c="#64748b">全书字数进度</Text>
                  <Text fz={15} fw={700} c="#0f172a">
                    {metrics.totalWords.toLocaleString()} <Text span fz={11} c="#94a3b8">/ {metrics.progressPercent}%</Text>
                  </Text>
                </Paper>
                <Paper p="10px 12px" radius="sm" bg="#fafbfc" bd="1px solid #f1f5f9">
                  <Text fz={11} c="#64748b">已写章节 / 完稿</Text>
                  <Text fz={15} fw={700} c="#0f172a">
                    {metrics.chapterCount} 章 <Text span fz={11} c="#94a3b8">/ {metrics.completedChapters} 完稿</Text>
                  </Text>
                </Paper>
                <Paper p="10px 12px" radius="sm" bg="#fafbfc" bd="1px solid #f1f5f9">
                  <Text fz={11} c="#64748b">章均字数</Text>
                  <Text fz={15} fw={700} c="#0f172a">{metrics.avgWordsPerChapter.toLocaleString()} 字</Text>
                </Paper>
                <Paper p="10px 12px" radius="sm" bg="#fafbfc" bd="1px solid #f1f5f9">
                  <Text fz={11} c="#64748b">项目总纲状态</Text>
                  <Text fz={14} fw={700} c={metrics.hasMasterOutline ? "#00c9ff" : "#94a3b8"}>
                    {metrics.hasMasterOutline ? "已接入总纲树" : "未设置总纲"}
                  </Text>
                </Paper>
              </SimpleGrid>
            ) : null}

            {/* 当前 Tab 的极简配置卡 */}
            <Paper p={14} radius="sm" bg="#ffffff" bd="1px solid #e2e8f0">
              {activeTab === "book_overview" ? (
                <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                  <Box flex={1} miw={220}>
                    <Text fz={13} fw={700} c="#0f172a" mb={2}>全书宏观健康度分析</Text>
                    <Text fz={12} c="#64748b">
                      自动结合作品简介、项目总纲、章节大纲与进度字数，诊断整体节奏、主线偏离风险并给出调整建议（低额度消耗）。
                    </Text>
                  </Box>
                  <Button size="xs" leftSection={<FiPlay size={13} />} loading={running} onClick={handleRunAnalysis}>
                    开始全书分析
                  </Button>
                </Flex>
              ) : null}

              {activeTab === "chapter_range" ? (
                <Stack gap={10}>
                  <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                    <Text fz={13} fw={700} c="#0f172a">选择待评估的剧情区间（建议 1~10 章）</Text>
                    <Group gap={8}>
                      {metrics && metrics.volumes.length > 0 ? (
                        <Select
                          size="xs"
                          w={150}
                          placeholder="快捷按卷选取"
                          clearable
                          data={metrics.volumes.map((v) => ({ value: String(v.id), label: v.title }))}
                          onChange={handlePickVolume}
                        />
                      ) : null}
                      {metrics && metrics.masterNodes.length > 0 ? (
                        <Select
                          size="xs"
                          w={170}
                          placeholder="按项目总纲节点选取"
                          clearable
                          data={metrics.masterNodes.map((n) => ({ value: n.id, label: `${n.title} (${n.chapterRange})` }))}
                          onChange={handlePickMasterNode}
                        />
                      ) : null}
                    </Group>
                  </Flex>

                  <Flex align="flex-end" gap={10} wrap="wrap">
                    <NumberInput
                      size="xs"
                      w={110}
                      label="起始章节"
                      min={1}
                      max={maxChapterNum}
                      value={startChapter}
                      onChange={(v) => setStartChapter(Number(v) || 1)}
                    />
                    <NumberInput
                      size="xs"
                      w={110}
                      label="结束章节"
                      min={startChapter}
                      max={maxChapterNum}
                      value={endChapter}
                      onChange={(v) => setEndChapter(Number(v) || startChapter)}
                    />
                    <TextInput
                      size="xs"
                      flex={1}
                      miw={220}
                      label="本区间预期剧情目标（选填，供 AI 对照打分）"
                      placeholder="例如：完成主角入宗考核，埋下反派暗算的伏笔"
                      value={expectedGoal}
                      onChange={(e) => setExpectedGoal(e.target.value)}
                    />
                    <Button size="xs" leftSection={<FiPlay size={13} />} loading={running} onClick={handleRunAnalysis}>
                      开始模块分析
                    </Button>
                  </Flex>
                </Stack>
              ) : null}

              {activeTab === "audit" ? (
                <Stack gap={10}>
                  <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                    <SegmentedControl
                      size="xs"
                      value={auditSubMode}
                      onChange={(v) => setAuditSubMode(v as "logic_audit" | "character_audit")}
                      data={[
                        {
                          value: "logic_audit",
                          label: (
                            <Flex align="center" gap={6}>
                              <FiShield size={12} />
                              <span>逻辑与设定冲突审查</span>
                            </Flex>
                          ),
                        },
                        {
                          value: "character_audit",
                          label: (
                            <Flex align="center" gap={6}>
                              <FiUserCheck size={12} />
                              <span>人物性格 / OOC 分析</span>
                            </Flex>
                          ),
                        },
                      ]}
                    />
                  </Flex>

                  <Flex align="flex-end" gap={10} wrap="wrap">
                    <NumberInput
                      size="xs"
                      w={110}
                      label="起始章节"
                      min={1}
                      max={maxChapterNum}
                      value={startChapter}
                      onChange={(v) => setStartChapter(Number(v) || 1)}
                    />
                    <NumberInput
                      size="xs"
                      w={110}
                      label="结束章节"
                      min={startChapter}
                      max={maxChapterNum}
                      value={endChapter}
                      onChange={(v) => setEndChapter(Number(v) || startChapter)}
                    />
                    {auditSubMode === "character_audit" ? (
                      <MultiSelect
                        size="xs"
                        flex={1}
                        miw={220}
                        label="选择待审计角色（1~3 位）"
                        placeholder="从角色档案库选择"
                        maxValues={3}
                        data={(metrics?.characters || []).map((c) => ({
                          value: String(c.id),
                          label: `${c.name}${c.identity ? ` (${c.identity})` : ""}`,
                        }))}
                        value={selectedCharIds}
                        onChange={setSelectedCharIds}
                      />
                    ) : (
                      <Box flex={1} miw={220}>
                        <Text fz={12} c="#64748b" pb={6}>
                          自动交叉比对世界规则、道具代价、势力立场与时间线，定位设定矛盾与因果漏洞。
                        </Text>
                      </Box>
                    )}
                    <Button size="xs" leftSection={<FiPlay size={13} />} loading={running} onClick={handleRunAnalysis}>
                      开始审计
                    </Button>
                  </Flex>
                </Stack>
              ) : null}
            </Paper>

            {/* 分析报告正文区 */}
            <Box pos="relative" mih={240}>
              <LoadingMask visible={running} label="AI 正在深度阅读与交叉比对中..." />
              {activeReport ? (
                <ReportViewer workId={workId} record={activeReport} chapters={metrics?.chapters || []} />
              ) : (
                <Center mih={240} bg="#fafbfc" bdrs={8} bd="1px dashed #e2e8f0">
                  <Stack align="center" gap={6}>
                    <FiCpu size={24} color="#94a3b8" />
                    <Text fz={13} c="#64748b">点击上方「开始分析」生成你的首份 AI 诊断报告</Text>
                  </Stack>
                </Center>
              )}
            </Box>
          </Stack>
        </ScrollArea>

        {/* 右侧极简历史报告栏 */}
        <Box w={260} p={14} bg="#fafbfc" style={{ borderLeft: "1px solid #f1f5f9", flexShrink: 0, overflowY: "auto" }}>
          <Flex align="center" justify="space-between" mb={10}>
            <Group gap={6}>
              <FiClock size={14} color="#64748b" />
              <Text fz={13} fw={700} c="#0f172a">历史报告</Text>
            </Group>
            <Badge size="xs" variant="light" color="gray">{history.length}</Badge>
          </Flex>

          {history.length === 0 ? (
            <Text fz={12} c="#94a3b8" ta="center" mt={24}>暂无历史分析记录</Text>
          ) : (
            <Stack gap={8}>
              {history.map((item) => {
                const isActive = activeReport?.id === item.id;
                return (
                  <Box
                    key={item.id}
                    className={`${styles.historyItem} ${isActive ? styles.historyItemActive : ""}`}
                    onClick={() => setActiveReport(item)}
                  >
                    <Flex align="center" justify="space-between" gap={6} mb={4}>
                      <Badge size="xs" variant="light">{TYPE_LABEL[item.analysisType] || item.analysisType}</Badge>
                      <Group gap={4}>
                        <Text fz={12} fw={700} c="#00c9ff">{item.overallScore} 分</Text>
                        <Tooltip label="删除记录">
                          <ActionIcon variant="subtle" color="gray" size={20} onClick={(e) => handleDeleteReport(item.id, e)}>
                            <FiTrash2 size={11} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Flex>
                    <Text fz={12} fw={600} c="#1e293b" truncate title={item.scopeLabel}>{item.scopeLabel}</Text>
                    <Text fz={10.5} c="#94a3b8" mt={2}>{new Date(item.createdAt).toLocaleString()}</Text>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Flex>
    </Box>
  );
}
