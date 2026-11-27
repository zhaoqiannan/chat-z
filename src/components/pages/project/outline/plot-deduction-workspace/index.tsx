"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { Badge, Box, Button, Divider, Flex, Group, Modal, NumberInput, Paper, ScrollArea, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { FiBookOpen, FiCheck, FiCopy, FiEdit2, FiExternalLink, FiFeather, FiFileText, FiGitBranch, FiLayers, FiRefreshCw, FiSave, FiShield, FiZap } from "react-icons/fi";
import { GeneratedProseDraft, MasterChapterPlanItem, MasterChapterPlanOption, MasterNodeDeductionContextResult, MasterNodeDeductionSnapshot, extractChapterOutline, generateMasterChapterPlans, generateProseFromPlan, getMasterNodeDeductionContext } from "@/rest/outline";
import { createChapter, updateChapter } from "@/rest/chapter";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";

interface PlotDeductionWorkspaceProps {
  workId: string;
  initialNodeId?: string | null;
  legacyCardCount?: number;
  onShowLegacyCards?: () => void;
  onJumpToQualityAudit?: (chapterRange: string, nodeTitle: string) => void;
}

const WRITING_STYLES = [
  { value: "流畅细腻、画面感强、节奏紧凑", label: "默认 · 流畅细腻" },
  { value: "网文快节奏、强冲突、爽点明确、悬念钩子足", label: "网文快节奏" },
  { value: "悬疑诡谲、信息差博弈、层层递进", label: "悬疑推理感" },
  { value: "古典仙侠、意境深远、气势恢宏", label: "古典仙侠风" },
  { value: "都市写实、人物对话鲜活、心理刻画深入", label: "都市写实风" },
];

export default function PlotDeductionWorkspace({
  workId,
  initialNodeId,
  legacyCardCount = 0,
  onShowLegacyCards,
  onJumpToQualityAudit,
}: PlotDeductionWorkspaceProps) {
  const router = useRouter();

  const [loadingContext, setLoadingContext] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [contextData, setContextData] = useState<MasterNodeDeductionContextResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNodeId || "");
  const [chapterStart, setChapterStart] = useState<number>(1);
  const [chapterEnd, setChapterEnd] = useState<number>(3);
  const [preference, setPreference] = useState<string>("");

  // 当前节点的推演快照（仅保存最新一次推演方案 + 各章最新一次生成正文）
  const [snapshot, setSnapshot] = useState<MasterNodeDeductionSnapshot | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  // 正文生成弹窗状态（仅保留上一次生成，重新生成覆盖）
  const [proseModalOpened, setProseModalOpened] = useState(false);
  const [activeChapterPlan, setActiveChapterPlan] = useState<MasterChapterPlanItem | null>(null);
  const [activeDraft, setActiveDraft] = useState<GeneratedProseDraft | null>(null);
  const [draftEditorText, setDraftEditorText] = useState<string>("");
  const [draftTitleInput, setDraftTitleInput] = useState<string>("");
  const [writingStyle, setWritingStyle] = useState<string>(WRITING_STYLES[0].value);
  const [extraInstruction, setExtraInstruction] = useState<string>("");
  const [generatingProse, setGeneratingProse] = useState(false);
  const [savingToChapter, setSavingToChapter] = useState(false);
  const [extractingSavedOutline, setExtractingSavedOutline] = useState(false);
  const [targetVolumeId, setTargetVolumeId] = useState<string>("");
  const [lastSavedChapterId, setLastSavedChapterId] = useState<number | string | null>(null);

  const loadContext = useCallback(
    async (nodeId?: string) => {
      if (!workId) return;
      try {
        setLoadingContext(true);
        const res = await getMasterNodeDeductionContext(workId, nodeId || undefined);
        if (res && res.success && res.result) {
          const data = res.result;
          setContextData(data);
          setSelectedNodeId(data.selectedNodeId || "");
          setSnapshot(data.snapshot || null);
          setIsEditingPlan(false);

          if (data.snapshot) {
            setChapterStart(data.snapshot.chapterStart || data.suggestedRange.start);
            setChapterEnd(data.snapshot.chapterEnd || data.suggestedRange.end);
            setPreference(data.snapshot.preference || "");
            setSelectedPlanId(data.snapshot.selectedPlanId || data.snapshot.plans?.[0]?.id || "");
          } else {
            setChapterStart(data.suggestedRange.start);
            setChapterEnd(data.suggestedRange.end);
            setPreference("");
            setSelectedPlanId("");
          }

          if (data.volumes.length > 0 && !targetVolumeId) {
            setTargetVolumeId(String(data.volumes[data.volumes.length - 1].id));
          }
        } else {
          useAlert.error(res?.message || "加载总纲与章节进度失败");
        }
      } catch (e: any) {
        useAlert.error("加载推演上下文失败: " + (e?.message || "网络异常"));
      } finally {
        setLoadingContext(false);
      }
    },
    [workId, targetVolumeId]
  );

  useEffect(() => {
    loadContext(initialNodeId || undefined);
  }, [workId, initialNodeId]);

  const handleSelectMasterNode = (nextId: string | null) => {
    if (!nextId) return;
    setSelectedNodeId(nextId);
    loadContext(nextId);
  };

  const selectedNodeMeta = useMemo(
    () => contextData?.masterNodes.find((n) => n.id === selectedNodeId) || null,
    [contextData, selectedNodeId]
  );

  const selectedPlan: MasterChapterPlanOption | null = useMemo(() => {
    if (!snapshot?.plans?.length) return null;
    return snapshot.plans.find((p) => p.id === selectedPlanId) || snapshot.plans[0];
  }, [snapshot, selectedPlanId]);

  const masterNodeOptions = useMemo(() => {
    if (!contextData?.masterNodes?.length) return [];
    return contextData.masterNodes.map((n) => {
      const indent = n.depth > 0 ? `${"— ".repeat(Math.min(n.depth, 3))}` : "";
      const rangeTag = n.chapterRange ? ` [第${n.chapterRange}章` : "";
      const progTag = n.parsedRange
        ? n.missingChapters.length > 0
          ? ` · 待规划${n.missingChapters.length}章]`
          : ` · 已写${n.writtenCount}/${n.totalPlannedCount}章]`
        : n.chapterRange
        ? "]"
        : "";
      return {
        value: n.id,
        label: `${indent}${n.title}${rangeTag}${progTag}`,
      };
    });
  }, [contextData]);

  const handleGeneratePlans = async () => {
    if (!workId || !selectedNodeId) {
      useAlert.warning("请先选择一个项目总纲节点");
      return;
    }
    const start = Math.max(1, Number(chapterStart) || 1);
    const end = Math.max(start, Number(chapterEnd) || start);
    if (end - start + 1 > 10) {
      useAlert.warning("单次最多推演 10 章，请缩小起止章节范围以保证每章剧情深度");
      return;
    }

    try {
      setPlanning(true);
      setIsEditingPlan(false);
      useAlert.info("正在结合项目总纲与章节大纲推演剧情走向方案，请稍候...", { autoClose: 4500 });
      const res = await generateMasterChapterPlans({
        workId,
        nodeId: selectedNodeId,
        targetNode: contextData?.targetNode,
        chapterStart: start,
        chapterEnd: end,
        preference: preference.trim() || undefined,
      });

      if (res && res.success && res.result) {
        setSnapshot(res.result);
        setSelectedPlanId(res.result.selectedPlanId || res.result.plans?.[0]?.id || "");
        useAlert.success("章节剧情走向方案推演完成！");
      } else {
        useAlert.error(res?.message || "推演章节走向失败");
      }
    } catch (e: any) {
      useAlert.error("推演异常: " + (e?.message || "网络错误"));
    } finally {
      setPlanning(false);
    }
  };

  const handleEditPlanChapterText = (chapterNumber: number, field: "title" | "plotText", value: string) => {
    setSnapshot((prev) => {
      if (!prev || !selectedPlan) return prev;
      return {
        ...prev,
        plans: prev.plans.map((p) => {
          if (p.id !== selectedPlan.id) return p;
          return {
            ...p,
            chapters: p.chapters.map((c) => (c.chapterNumber === chapterNumber ? { ...c, [field]: value } : c)),
          };
        }),
      };
    });
  };

  const handleCopyCurrentPlan = () => {
    if (!selectedPlan) return;
    const text = [
      `【${selectedPlan.name}】`,
      selectedPlan.overview ? `方案概述：${selectedPlan.overview}` : "",
      "",
      ...selectedPlan.chapters.map((ch) => `第${ch.chapterNumber}章《${ch.title}》\n${ch.plotText}`),
    ]
      .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
      .join("\n\n");
    navigator.clipboard
      ?.writeText(text)
      .then(() => useAlert.success("已复制当前方案纯文本"))
      .catch(() => useAlert.error("复制失败"));
  };

  // 执行生成不少于 3000 字正文（覆盖该章上一次结果）
  const runGenerateProse = async (chapterPlan: MasterChapterPlanItem, plan: MasterChapterPlanOption) => {
    if (!workId || !selectedNodeId || generatingProse) return;
    try {
      setGeneratingProse(true);
      setLastSavedChapterId(null);
      useAlert.info(`正在为第 ${chapterPlan.chapterNumber} 章生成不少于 3000 字的正文，请不要跳转页面...`, { autoClose: 6000 });

      // 拆分“上一章走向承接”与“下一章边界防剧透”，避免混在一起导致语义冲突
      const prevPlanItem = plan.chapters.find((c) => c.chapterNumber === chapterPlan.chapterNumber - 1);
      const nextPlanItem = plan.chapters.find((c) => c.chapterNumber === chapterPlan.chapterNumber + 1);
      const prevPlanContext = prevPlanItem
        ? `第${prevPlanItem.chapterNumber}章《${prevPlanItem.title}》：${prevPlanItem.plotText.slice(0, 450)}`
        : "";
      const nextPlanContext = nextPlanItem
        ? `第${nextPlanItem.chapterNumber}章《${nextPlanItem.title}》：${nextPlanItem.plotText.slice(0, 260)}`
        : "";

      const res = await generateProseFromPlan({
        workId,
        nodeId: selectedNodeId,
        planId: plan.id,
        planName: plan.name,
        chapterNumber: chapterPlan.chapterNumber,
        chapterTitle: chapterPlan.title,
        plotText: chapterPlan.plotText,
        prevPlanContext,
        nextPlanContext,
        writingStyle,
        extraInstruction: extraInstruction.trim() || undefined,
      });

      if (res && res.success && res.result) {
        const draft = res.result;
        setActiveDraft(draft);
        setDraftEditorText(draft.content);
        setDraftTitleInput(draft.chapterTitle || chapterPlan.title);
        setSnapshot((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            latestDrafts: {
              ...(prev.latestDrafts || {}),
              [String(draft.chapterNumber)]: draft,
            },
            lastGeneratedDraft: draft,
            updatedAt: draft.updatedAt,
          };
        });
        useAlert.success(`正文生成完毕！（共 ${draft.wordCount} 字，已覆盖保存最新结果）`, { autoClose: 4000 });
      } else {
        useAlert.error(res?.message || "正文生成失败");
      }
    } catch (e: any) {
      useAlert.error("正文生成异常: " + (e?.message || "网络异常"));
    } finally {
      setGeneratingProse(false);
    }
  };

  const handleOpenProseModal = (chapterPlan: MasterChapterPlanItem, forceGenerate: boolean) => {
    if (!selectedPlan) return;
    const savedDraft = snapshot?.latestDrafts?.[String(chapterPlan.chapterNumber)] || null;
    setActiveChapterPlan(chapterPlan);
    setLastSavedChapterId(null);
    setProseModalOpened(true);

    if (savedDraft && !forceGenerate) {
      setActiveDraft(savedDraft);
      setDraftEditorText(savedDraft.content);
      setDraftTitleInput(savedDraft.chapterTitle || chapterPlan.title);
    } else {
      setActiveDraft(savedDraft);
      setDraftEditorText(savedDraft?.content || "");
      setDraftTitleInput(chapterPlan.title);
      runGenerateProse(chapterPlan, selectedPlan);
    }
  };

  const existingChapterMap = useMemo(() => {
    const map = new Map<number, { id: number; chapterNumber: number; title: string; wordCount: number; volumeId: number | null }>();
    contextData?.existingChapters.forEach((c) => map.set(c.chapterNumber, c));
    return map;
  }, [contextData?.existingChapters]);

  const handleWriteToChapter = async () => {
    if (!activeChapterPlan || !draftEditorText.trim() || savingToChapter) return;
    const cleanText = draftEditorText.trim();
    const cleanTitle = (draftTitleInput.trim() || activeChapterPlan.title || `第${activeChapterPlan.chapterNumber}章`).trim();
    const existing = existingChapterMap.get(activeChapterPlan.chapterNumber);

    if (existing && existing.wordCount > 0) {
      const ok = await showConfirm({
        title: `覆盖第 ${activeChapterPlan.chapterNumber} 章正文`,
        message: `章节库中已存在第 ${activeChapterPlan.chapterNumber} 章《${existing.title}》（当前 ${existing.wordCount} 字）。确定要用本次生成的正文覆盖写入吗？`,
        confirmLabel: "确认覆盖写入",
        confirmColor: "cyan",
      });
      if (!ok) return;
    }

    try {
      setSavingToChapter(true);
      let savedId: number | string | null = null;
      if (existing) {
        const res = await updateChapter({
          id: existing.id,
          title: cleanTitle,
          content: cleanText,
          summary: activeChapterPlan.plotText.slice(0, 500),
          status: "revising",
        });
        if (res && res.success) {
          savedId = existing.id;
        } else {
          useAlert.error(res?.message || "更新章节失败");
          return;
        }
      } else {
        const res = await createChapter({
          workId,
          volumeId: targetVolumeId ? Number(targetVolumeId) : null,
          chapterNumber: activeChapterPlan.chapterNumber,
          title: cleanTitle,
          content: cleanText,
          summary: activeChapterPlan.plotText.slice(0, 500),
          status: "revising",
        });
        if (res && res.success) {
          savedId = res.result?.id || null;
        } else {
          useAlert.error(res?.message || "新建章节失败");
          return;
        }
      }

      setLastSavedChapterId(savedId);
      useAlert.success(`已将第 ${activeChapterPlan.chapterNumber} 章正文写入章节库！可直接提取本章大纲或前往精修`);
      loadContext(selectedNodeId);
    } catch (e: any) {
      useAlert.error("写入章节库失败: " + (e?.message || "网络异常"));
    } finally {
      setSavingToChapter(false);
    }
  };

  const handleExtractSavedChapterOutline = async () => {
    if (!lastSavedChapterId || !draftEditorText.trim() || extractingSavedOutline) return;
    try {
      setExtractingSavedOutline(true);
      const res = await extractChapterOutline({
        chapterId: lastSavedChapterId,
        workId,
        content: draftEditorText.trim(),
        title: (draftTitleInput.trim() || activeChapterPlan?.title || "").trim(),
      });
      if (res && res.success) {
        useAlert.success("已将本章剧情沉淀到「3. 章节大纲」，后续推演将自动衔接！");
        loadContext(selectedNodeId);
      } else {
        useAlert.error(res?.message || "提取本章大纲失败");
      }
    } catch (e: any) {
      useAlert.error("提取本章大纲异常: " + (e?.message || "网络异常"));
    } finally {
      setExtractingSavedOutline(false);
    }
  };

  const currentEditorWordCount = useMemo(() => draftEditorText.replace(/\s+/g, "").length, [draftEditorText]);

  return (
    <Flex direction="column" h="100%" bg="#ffffff" style={{ overflow: "hidden" }}>
      {/* 顶部极简说明与旧数据兼容入口 */}
      <Flex align="center" justify="space-between" px="md" py={8} bg="#fafafa" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Group gap={10}>
          <Badge variant="light" color="blue" size="sm" leftSection={<FiZap size={11} />}>
            ② 规划并写章
          </Badge>
          <Text fz={12} c="#64748b">
            自动读取「1. 项目总纲」+「3. 章节大纲」进度，规划待写章节走向并一键生成 ≥3000 字正文
          </Text>
        </Group>

        <Group gap={8}>
          {selectedNodeMeta?.chapterRange?.trim() && onJumpToQualityAudit ? (
            <Button
              size="xs"
              variant="light"
              color="grape"
              leftSection={<FiShield size={12} />}
              disabled={selectedNodeMeta.writtenCount <= 0}
              title={
                selectedNodeMeta.writtenCount > 0
                  ? `前往质量诊断检查「${selectedNodeMeta.title}」（第${selectedNodeMeta.chapterRange}章）`
                  : "当前节点暂无已写正文，写入章节后即可质检"
              }
              onClick={() => onJumpToQualityAudit(selectedNodeMeta.chapterRange || "", selectedNodeMeta.title)}
            >
              ③ 章节质检此阶段
            </Button>
          ) : null}
          {onShowLegacyCards ? (
            <Button size="xs" variant="subtle" color="gray" onClick={onShowLegacyCards}>
              旧推演卡片{legacyCardCount > 0 ? ` (${legacyCardCount})` : ""}
            </Button>
          ) : null}
          <Button size="xs" variant="default" leftSection={<FiRefreshCw size={12} />} loading={loadingContext} onClick={() => loadContext(selectedNodeId)}>
            刷新进度
          </Button>
        </Group>
      </Flex>

      {/* 双栏闭环工作台 */}
      <Flex flex={1} mih={0} pos="relative" style={{ overflow: "hidden" }}>
        <LoadingMask visible={loadingContext && !contextData} label="正在读取项目总纲与章节大纲进度..." />

        {/* 左栏：总纲节点选择 + 下级大纲 + Tab 2 已有章节进度 + 推演发起 */}
        <Box w={380} h="100%" bg="#ffffff" style={{ borderRight: "1px solid #f1f5f9", flexShrink: 0, overflow: "hidden" }}>
          <ScrollArea h="100%" p={14}>
            <Stack gap={12}>
              {/* 1. 选择项目总纲节点 */}
              <Box>
                <Text fz={12} fw={700} c="#0f172a" mb={6}>
                  1. 选择项目总纲节点（建议选择已关联章节的节点）
                </Text>
                <Select
                  size="xs"
                  searchable
                  placeholder="请选择总纲节点..."
                  data={masterNodeOptions}
                  value={selectedNodeId || null}
                  onChange={handleSelectMasterNode}
                />
              </Box>

              {/* 2. 当前节点及下级大纲预览 */}
              {contextData?.targetNode ? (
                <Paper p={10} radius="md" bg="#f8fafc" bd="1px solid #e2e8f0">
                  <Flex align="center" justify="space-between" mb={6}>
                    <Group gap={6}>
                      <FiGitBranch size={13} color="#00a8d6" />
                      <Text fz={12} fw={700} c="#0f172a">总纲节点及下级大纲</Text>
                    </Group>
                    {selectedNodeMeta?.chapterRange ? (
                      <Badge size="xs" variant="light" color="cyan">关联第 {selectedNodeMeta.chapterRange} 章</Badge>
                    ) : (
                      <Badge size="xs" variant="light" color="gray">未设关联章节</Badge>
                    )}
                  </Flex>

                  <Text fz={12} fw={600} c="#1e293b" mb={2}>{contextData.targetNode.title}</Text>
                  <Text fz={11} c="#475569" lh={1.55} mb={contextData.targetNode.children?.length ? 8 : 0} style={{ whiteSpace: "pre-wrap" }}>
                    {contextData.targetNode.note || "（当前节点暂未填写要点说明）"}
                  </Text>

                  {Array.isArray(contextData.targetNode.children) && contextData.targetNode.children.length > 0 ? (
                    <Stack gap={4} pl={8} style={{ borderLeft: "2px solid rgba(0, 201, 255, 0.4)" }}>
                      {contextData.targetNode.children.map((child: any) => (
                        <Box key={child.id}>
                          <Text fz={11} fw={600} c="#334155">
                            · {child.title}
                            {child.chapterRange ? <Text span fz={10} c="#00a8d6"> (第{child.chapterRange}章)</Text> : null}
                          </Text>
                          {child.note ? (
                            <Text fz={11} c="#64748b" lh={1.45} lineClamp={2}>{child.note}</Text>
                          ) : null}
                        </Box>
                      ))}
                    </Stack>
                  ) : null}
                </Paper>
              ) : null}

              {/* 3. Tab 2 章节大纲进度快照 */}
              <Paper p={10} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                <Flex align="center" justify="space-between" mb={6}>
                  <Group gap={6}>
                    <FiBookOpen size={13} color="#00a8d6" />
                    <Text fz={12} fw={700} c="#0f172a">已有章节大纲进度（来自「3. 章节大纲」）</Text>
                  </Group>
                  {selectedNodeMeta?.parsedRange ? (
                    <Badge size="xs" variant="light" color={selectedNodeMeta.missingChapters.length > 0 ? "orange" : "green"}>
                      已写 {selectedNodeMeta.writtenCount}/{selectedNodeMeta.totalPlannedCount} 章
                    </Badge>
                  ) : null}
                </Flex>

                {contextData && (contextData.inRangeOutlines.length > 0 || contextData.precedingOutlines.length > 0) ? (
                  <Stack gap={6}>
                    {[...contextData.precedingOutlines, ...contextData.inRangeOutlines]
                      .filter((item, idx, arr) => arr.findIndex((x) => x.chapterNumber === item.chapterNumber) === idx)
                      .sort((a, b) => a.chapterNumber - b.chapterNumber)
                      .slice(-4)
                      .map((ch) => (
                        <Box key={ch.chapterNumber} p={6} bdrs={6} bg="#f8fafc" bd="1px solid #f1f5f9">
                          <Flex align="center" justify="space-between" mb={2}>
                            <Text fz={11} fw={700} c="#0f172a">第 {ch.chapterNumber} 章 · {ch.title}</Text>
                            {ch.wordCount > 0 ? <Text fz={10} c="#64748b">{ch.wordCount}字</Text> : null}
                          </Flex>
                          <Text fz={11} c="#64748b" lh={1.45} lineClamp={2}>
                            {ch.outlineText || "（已在章节库中存在，建议在章节页点击「提取剧情到大纲」丰富剧情摘要）"}
                          </Text>
                        </Box>
                      ))}
                  </Stack>
                ) : (
                  <Text fz={11} c="#94a3b8" lh={1.5}>
                    暂未检测到前序章节大纲，AI 将直接基于项目总纲起点为您规划章节走向。
                  </Text>
                )}
              </Paper>

              <Divider color="#f1f5f9" />

              {/* 4. 待推演章节范围与偏好 */}
              <Box>
                <Text fz={12} fw={700} c="#0f172a" mb={6}>
                  2. 规划待写章节范围（单次建议 1~6 章）
                </Text>
                <Group grow gap={8}>
                  <NumberInput
                    size="xs"
                    label="起始章号"
                    min={1}
                    max={9999}
                    value={chapterStart}
                    onChange={(v) => setChapterStart(Math.max(1, Number(v) || 1))}
                  />
                  <NumberInput
                    size="xs"
                    label="结束章号"
                    min={chapterStart}
                    max={chapterStart + 9}
                    value={chapterEnd}
                    onChange={(v) => setChapterEnd(Math.max(chapterStart, Number(v) || chapterStart))}
                  />
                </Group>
              </Box>

              <Textarea
                size="xs"
                label="走向偏好 / 特别要求（选填）"
                placeholder="例如：侧重主角暗中布局与反转，第12章末尾抛出反派真实身份悬念..."
                autosize
                minRows={2}
                maxRows={4}
                value={preference}
                onChange={(e) => setPreference(e.currentTarget.value)}
              />

              <Button
                fullWidth
                size="sm"
                leftSection={<FiZap size={15} />}
                loading={planning}
                onClick={handleGeneratePlans}
              >
                {snapshot?.plans?.length ? "重新规划章节走向（覆盖上次方案）" : "开始规划章节走向"}
              </Button>
            </Stack>
          </ScrollArea>
        </Box>

        {/* 右栏：纯文本多方案展示 & 正文生成闭环区 */}
        <Box flex={1} h="100%" bg="#f8fafc" pos="relative" style={{ overflow: "hidden" }}>
          <LoadingMask visible={planning} label="AI 正在结合总纲节点与已有章节进度生成多套纯文本剧情走向方案..." />

          <ScrollArea h="100%" p={18}>
            {snapshot && snapshot.plans.length > 0 && selectedPlan ? (
              <Stack gap={14} maw={1080} mx="auto" pb={36}>
                {/* 进度衔接摘要 */}
                {snapshot.progressSummary ? (
                  <Paper p={12} radius="md" bg="#f0fcff" bd="1px solid rgba(0, 201, 255, 0.3)">
                    <Flex align="center" justify="space-between" gap={8} mb={4} wrap="wrap">
                      <Text fz={12} fw={700} c="#0099c4">当前进度与本阶段推演衔接</Text>
                      <Text fz={11} c="#64748b">
                        上次推演：{dayjs(snapshot.updatedAt).format("YYYY-MM-DD HH:mm")} · 第 {snapshot.chapterStart}~{snapshot.chapterEnd} 章
                      </Text>
                    </Flex>
                    <Text fz={13} c="#334155" lh={1.65}>{snapshot.progressSummary}</Text>
                  </Paper>
                ) : null}

                {/* 方案切换栏 + 操作按钮 */}
                <Flex align="center" justify="space-between" gap={10} wrap="wrap">
                  <Group gap={8}>
                    {snapshot.plans.map((p, idx) => {
                      const active = p.id === selectedPlan.id;
                      return (
                        <Button
                          key={p.id}
                          size="xs"
                          variant={active ? "filled" : "default"}
                          onClick={() => {
                            setSelectedPlanId(p.id);
                            setIsEditingPlan(false);
                          }}
                        >
                          {p.name || `方案 ${idx + 1}`}
                        </Button>
                      );
                    })}
                  </Group>

                  <Group gap={8}>
                    <Button
                      size="xs"
                      variant={isEditingPlan ? "light" : "default"}
                      leftSection={<FiEdit2 size={12} />}
                      onClick={() => setIsEditingPlan((v) => !v)}
                    >
                      {isEditingPlan ? "完成微调" : "微调走向文本"}
                    </Button>
                    <Button size="xs" variant="default" leftSection={<FiCopy size={12} />} onClick={handleCopyCurrentPlan}>
                      复制本方案
                    </Button>
                  </Group>
                </Flex>

                {/* 选中方案纯文本内容主体 */}
                <Paper p={16} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                  <Flex align="center" justify="space-between" gap={8} mb={10} wrap="wrap">
                    <Group gap={8}>
                      <Badge variant="light" color="cyan" size="sm">{selectedPlan.style || "剧情走向"}</Badge>
                      <Text fz={15} fw={700} c="#0f172a">{selectedPlan.name}</Text>
                    </Group>
                    <Text fz={12} c="#64748b">共规划 {selectedPlan.chapters.length} 章 · 点击每章右侧按钮生成 ≥3000 字正文</Text>
                  </Flex>

                  {selectedPlan.overview ? (
                    <Box p={10} mb={14} bdrs={6} bg="#f8fafc" bd="1px solid #f1f5f9">
                      <Text fz={13} c="#475569" lh={1.65}>
                        <Text span fw={600} c="#0f172a">方案整体思路：</Text>{selectedPlan.overview}
                      </Text>
                    </Box>
                  ) : null}

                  {/* 逐章纯文本大段剧情走向 + 生成正文按钮 */}
                  <Stack gap={14}>
                    {selectedPlan.chapters.map((ch) => {
                      const savedDraft = snapshot.latestDrafts?.[String(ch.chapterNumber)] || null;
                      const existingCh = existingChapterMap.get(ch.chapterNumber);

                      return (
                        <Paper key={ch.chapterNumber} p={14} radius="md" bg="#ffffff" bd="1px solid #e2e8f0">
                          <Flex align="center" justify="space-between" gap={10} mb={10} pb={8} wrap="wrap" style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <Group gap={8} flex={1} miw={200}>
                              <Badge variant="filled" color="cyan" size="sm">第 {ch.chapterNumber} 章</Badge>
                              {isEditingPlan ? (
                                <TextInput
                                  size="xs"
                                  w={280}
                                  value={ch.title}
                                  onChange={(e) => handleEditPlanChapterText(ch.chapterNumber, "title", e.currentTarget.value)}
                                />
                              ) : (
                                <Text fz={14} fw={700} c="#0f172a">《{ch.title}》</Text>
                              )}
                              {existingCh ? (
                                <Badge size="xs" variant="outline" color="gray">
                                  章节库已有 ({existingCh.wordCount}字)
                                </Badge>
                              ) : null}
                              {savedDraft ? (
                                <Badge size="xs" variant="light" color="green">
                                  上次已生成 {savedDraft.wordCount} 字
                                </Badge>
                              ) : null}
                            </Group>

                            <Group gap={6}>
                              {savedDraft ? (
                                <>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    leftSection={<FiFileText size={13} />}
                                    onClick={() => handleOpenProseModal(ch, false)}
                                  >
                                    查看上次正文
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="default"
                                    leftSection={<FiRefreshCw size={12} />}
                                    onClick={() => handleOpenProseModal(ch, true)}
                                  >
                                    重新生成正文
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="xs"
                                  leftSection={<FiFeather size={13} />}
                                  onClick={() => handleOpenProseModal(ch, true)}
                                >
                                  生成正文 (≥3000字)
                                </Button>
                              )}
                            </Group>
                          </Flex>

                          {isEditingPlan ? (
                            <Textarea
                              size="sm"
                              autosize
                              minRows={4}
                              value={ch.plotText}
                              onChange={(e) => handleEditPlanChapterText(ch.chapterNumber, "plotText", e.currentTarget.value)}
                            />
                          ) : (
                            <Text fz={13.5} c="#1e293b" lh={1.85} style={{ whiteSpace: "pre-wrap" }}>
                              {ch.plotText}
                            </Text>
                          )}
                        </Paper>
                      );
                    })}
                  </Stack>
                </Paper>
              </Stack>
            ) : (
              <Flex direction="column" align="center" justify="center" h="100%" mih={420} gap={12} ta="center">
                <Box p={14} bdrs="50%" bg="rgba(0, 201, 255, 0.1)">
                  <FiZap size={28} color="#00c9ff" />
                </Box>
                <Text fz={16} fw={700} c="#0f172a">按总纲节点推演待写章节走向，一键生成 ≥3000 字正文</Text>
                <Text fz={13} c="#64748b" maw={480} lh={1.7}>
                  在左侧选择一个已关联章节的项目总纲节点，系统将自动读取该节点及下级大纲与 Tab 2 已有章节进度，点击「开始 AI 推演章节走向」即可生成多套纯文本章节走向方案。
                </Text>
              </Flex>
            )}
          </ScrollArea>
        </Box>
      </Flex>

      {/* 生成正文预览与写入章节库弹窗（只保留上一次生成结果，可覆盖重生成） */}
      <Modal
        opened={proseModalOpened}
        onClose={() => {
          if (generatingProse) {
            useAlert.warning("正文正在生成中，请稍候片刻再关闭");
            return;
          }
          setProseModalOpened(false);
        }}
        centered
        size="80vw"
        scrollAreaComponent={ScrollArea.Autosize}
        title={
          <Flex align="center" gap={8}>
            <FiFeather size={17} color="#00c9ff" />
            <Text fz={16} fw={700} c="#0f172a">
              {activeChapterPlan ? `第 ${activeChapterPlan.chapterNumber} 章正文生成` : "AI 正文生成"}
            </Text>
            {currentEditorWordCount > 0 ? (
              <Badge size="sm" variant="light" color={currentEditorWordCount >= 3000 ? "green" : "orange"}>
                共 {currentEditorWordCount} 字
              </Badge>
            ) : null}
            {activeDraft?.updatedAt ? (
              <Text fz={11} c="#64748b">上次生成：{dayjs(activeDraft.updatedAt).format("YYYY-MM-DD HH:mm:ss")}</Text>
            ) : null}
          </Flex>
        }
      >
        <Box pos="relative" mih={420}>
          <LoadingMask visible={generatingProse} label="AI 正在依据选定走向撰写不少于 3000 字的完整正文（约需 20~50 秒），请不要跳转页面..." />

          <Stack gap={12} pt={4}>
            {/* 顶部控制条：文风 + 补充要求 + 重新生成（覆盖上次） */}
            <Paper p={10} radius="md" bg="#f8fafc" bd="1px solid #e2e8f0">
              <Flex align="flex-end" justify="space-between" gap={10} wrap="wrap">
                <Group gap={10} flex={1} wrap="wrap">
                  <Select
                    size="xs"
                    w={190}
                    label="文风偏好"
                    data={WRITING_STYLES}
                    value={writingStyle}
                    onChange={(v) => setWritingStyle(v || WRITING_STYLES[0].value)}
                  />
                  <TextInput
                    size="xs"
                    flex={1}
                    miw={220}
                    label="重生成补充要求（选填）"
                    placeholder="例如：加强主角与反派的对话交锋，环境描写更压抑..."
                    value={extraInstruction}
                    onChange={(e) => setExtraInstruction(e.currentTarget.value)}
                  />
                </Group>

                <Button
                  size="xs"
                  variant="light"
                  leftSection={<FiRefreshCw size={13} />}
                  loading={generatingProse}
                  onClick={() => activeChapterPlan && selectedPlan && runGenerateProse(activeChapterPlan, selectedPlan)}
                >
                  重新生成（覆盖本次）
                </Button>
              </Flex>
            </Paper>

            {/* 章节标题与正文编辑区 */}
            <TextInput
              size="xs"
              label="章节标题（写入章节库时使用）"
              value={draftTitleInput}
              onChange={(e) => setDraftTitleInput(e.currentTarget.value)}
            />

            <Textarea
              label="生成正文内容（支持直接微调修改，仅保留最近一次生成记录）"
              placeholder="等待 AI 生成正文..."
              autosize
              minRows={16}
              maxRows={26}
              value={draftEditorText}
              onChange={(e) => setDraftEditorText(e.currentTarget.value)}
              styles={{ input: { fontSize: 14, lineHeight: 1.85, color: "#1e293b" } }}
            />

            {/* 底部闭环落库操作条 */}
            <Flex align="center" justify="space-between" gap={10} pt={6} wrap="wrap" style={{ borderTop: "1px solid #f1f5f9" }}>
              <Group gap={8}>
                {contextData && contextData.volumes.length > 0 && !(activeChapterPlan && existingChapterMap.has(activeChapterPlan.chapterNumber)) ? (
                  <Select
                    size="xs"
                    w={180}
                    placeholder="选择归属分卷（选填）"
                    clearable
                    data={contextData.volumes.map((v) => ({ value: String(v.id), label: v.title }))}
                    value={targetVolumeId || null}
                    onChange={(v) => setTargetVolumeId(v || "")}
                  />
                ) : null}
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<FiCopy size={12} />}
                  disabled={!draftEditorText.trim()}
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(draftEditorText)
                      .then(() => useAlert.success("已复制正文内容"))
                      .catch(() => useAlert.error("复制失败"));
                  }}
                >
                  复制正文
                </Button>
              </Group>

              <Group gap={8}>
                {lastSavedChapterId ? (
                  <>
                    <Button
                      size="xs"
                      variant="light"
                      color="cyan"
                      leftSection={<FiLayers size={13} />}
                      loading={extractingSavedOutline}
                      onClick={handleExtractSavedChapterOutline}
                    >
                      提取本章大纲
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="green"
                      leftSection={<FiExternalLink size={13} />}
                      onClick={() => router.push(`/project/${workId}?tab=chapters&chapterId=${lastSavedChapterId}`)}
                    >
                      前往章节页精修
                    </Button>
                  </>
                ) : null}
                <Button
                  size="xs"
                  leftSection={lastSavedChapterId ? <FiCheck size={13} /> : <FiSave size={13} />}
                  loading={savingToChapter}
                  disabled={!draftEditorText.trim() || generatingProse}
                  onClick={handleWriteToChapter}
                >
                  {activeChapterPlan && existingChapterMap.has(activeChapterPlan.chapterNumber)
                    ? `覆盖写入第 ${activeChapterPlan.chapterNumber} 章`
                    : `新建并写入第 ${activeChapterPlan?.chapterNumber} 章`}
                </Button>
              </Group>
            </Flex>
          </Stack>
        </Box>
      </Modal>
    </Flex>
  );
}
