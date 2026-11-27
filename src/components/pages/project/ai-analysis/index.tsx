"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ActionIcon, Badge, Box, Button, Center, Flex, Group, MultiSelect, NumberInput, Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import { FiBook, FiClock, FiCpu, FiLayers, FiPlay, FiShield, FiTrash2, FiUserCheck } from "react-icons/fi";
import { AiAnalysisTabKey, AiAnalysisType } from "@/rest/analysis";
import LoadingMask from "@/components/common/loading-mask";
import ReportViewer from "./report-viewer";
import { AiAnalysisProvider, useAiAnalysisContext } from "./context/AiAnalysisContext";
import styles from "./style.module.scss";

const TYPE_LABEL: Record<AiAnalysisType, string> = {
  book_overview: "全书总览",
  chapter_range: "章节质检",
  logic_audit: "设定冲突",
  character_audit: "人物 OOC",
};

function AiAnalysisContent() {
  const {
    workId,
    activeTab,
    setActiveTab,
    auditSubMode,
    setAuditSubMode,
    loading,
    running,
    metrics,
    history,
    activeReport,
    setActiveReport,
    startChapter,
    setStartChapter,
    endChapter,
    setEndChapter,
    expectedGoal,
    setExpectedGoal,
    sourceNodeGoal,
    selectedCharIds,
    setSelectedCharIds,
    maxChapterNum,
    handleRunAnalysis,
    handleDeleteReport,
    handlePickVolume,
    handlePickMasterNode,
  } = useAiAnalysisContext();

  return (
    <Box className={styles.page}>
      <LoadingMask visible={loading} label="正在加载当前模块最新数据..." />

      {/* 顶部 Tab 导航（切换即按当前 Tab 请求最新指标与历史报告） */}
      <Box px="md" pt={6} className={styles.headerBar}>
        <Tabs value={activeTab} onChange={(v) => setActiveTab((v as AiAnalysisTabKey) || "book_overview")}>
          <Tabs.List>
            <Tabs.Tab value="book_overview" leftSection={<FiBook size={14} color="#00c9ff" />}>
              全书总览诊断
            </Tabs.Tab>
            <Tabs.Tab value="chapter_range" leftSection={<FiLayers size={14} color="#00c9ff" />}>
              ③ 节点 / 区间章节质检
            </Tabs.Tab>
            <Tabs.Tab value="audit" leftSection={<FiShield size={14} color="#00c9ff" />}>
              设定冲突与人物 OOC 审计
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
                    开始全书诊断
                  </Button>
                </Flex>
              ) : null}

              {activeTab === "chapter_range" ? (
                <Stack gap={10}>
                  <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
                    <Group gap={8}>
                      <Text fz={13} fw={700} c="#0f172a">选择待质检的节点 / 章节区间（建议 1~10 章）</Text>
                      {sourceNodeGoal ? (
                        <Badge size="xs" variant="light" color="cyan">
                          当前质检节点：{sourceNodeGoal}
                        </Badge>
                      ) : null}
                    </Group>
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
                      开始章节质检
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
                    <Text fz={13} c="#64748b">点击上方「开始分析」生成当前模块的首份 AI 诊断报告</Text>
                  </Stack>
                </Center>
              )}
            </Box>
          </Stack>
        </ScrollArea>

        {/* 右侧极简历史报告栏（仅展示当前 Tab 分类报告） */}
        <Box w={260} p={14} bg="#fafbfc" style={{ borderLeft: "1px solid #f1f5f9", flexShrink: 0, overflowY: "auto" }}>
          <Flex align="center" justify="space-between" mb={10}>
            <Group gap={6}>
              <FiClock size={14} color="#64748b" />
              <Text fz={13} fw={700} c="#0f172a">当前模块历史报告</Text>
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

export default function AiAnalysisPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  return (
    <AiAnalysisProvider workId={workId}>
      <AiAnalysisContent />
    </AiAnalysisProvider>
  );
}
