// 公共组件：AI 扫描章节正文并一键沉淀 7 大世界观设定（角色/地点/阵营/物品/规则/人物关系/时间线）
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Box,
  Flex,
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Checkbox,
  Tabs,
  Paper,
  ScrollArea,
  Alert,
} from "@mantine/core";
import {
  FiCpu,
  FiCheck,
  FiRefreshCw,
  FiUsers,
  FiMapPin,
  FiShield,
  FiPackage,
  FiBookOpen,
  FiShare2,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import LoadingMask from "@/components/common/loading-mask";
import { getChapterList, ChapterItem } from "@/rest/chapter";
import {
  WorldSyncScope,
  WorldSyncCandidatesBundle,
  ExtractWorldFromChaptersResult,
  extractWorldFromChapters,
  applyExtractedWorldEntities,
} from "@/rest/world";
import { useAlert } from "@/hooks/useAlert";

interface WorldSyncScannerModalProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  defaultFocusScope?: WorldSyncScope;
  presetChapterIds?: number[];
  onApplied?: () => void;
}

type CategoryKey = keyof WorldSyncCandidatesBundle;

const CATEGORY_META: Array<{
  key: CategoryKey;
  scope: WorldSyncScope;
  label: string;
  color: string;
  icon: React.ReactNode;
}> = [
  { key: "characters", scope: "characters", label: "角色", color: "cyan", icon: <FiUsers size={13} /> },
  { key: "locations", scope: "locations", label: "地点", color: "teal", icon: <FiMapPin size={13} /> },
  { key: "factions", scope: "factions", label: "阵营", color: "indigo", icon: <FiShield size={13} /> },
  { key: "items", scope: "items", label: "物品", color: "orange", icon: <FiPackage size={13} /> },
  { key: "rules", scope: "rules", label: "世界规则", color: "grape", icon: <FiBookOpen size={13} /> },
  { key: "relations", scope: "relations", label: "人物关系", color: "pink", icon: <FiShare2 size={13} /> },
  { key: "timelineEvents", scope: "timeline", label: "时间线", color: "blue", icon: <FiClock size={13} /> },
];

function scopeToTabKey(scope?: WorldSyncScope): CategoryKey {
  const hit = CATEGORY_META.find((m) => m.scope === scope);
  return hit ? hit.key : "characters";
}

export default function WorldSyncScannerModal({
  opened,
  onClose,
  workId,
  defaultFocusScope = "all",
  presetChapterIds,
  onApplied,
}: WorldSyncScannerModalProps) {
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);

  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scanResult, setScanResult] = useState<ExtractWorldFromChaptersResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>(scopeToTabKey(defaultFocusScope));
  const [checkedIds, setCheckedIds] = useState<Record<CategoryKey, string[]>>({
    characters: [],
    locations: [],
    factions: [],
    items: [],
    rules: [],
    relations: [],
    timelineEvents: [],
  });

  useEffect(() => {
    if (!opened || !workId) return;
    setScanResult(null);
    setActiveTab(scopeToTabKey(defaultFocusScope));

    let active = true;
    const loadChapters = async () => {
      try {
        setLoadingChapters(true);
        const res = await getChapterList(String(workId));
        if (!active) return;
        if (res && res.success && Array.isArray(res.result)) {
          const validChapters = (res.result as ChapterItem[]).filter(
            (c) => c.isVolume === 0 && ((c.wordCount || 0) >= 20 || (c.content || "").trim().length >= 20)
          );
          setChapters(validChapters);

          if (presetChapterIds && presetChapterIds.length > 0) {
            const presetSet = new Set(presetChapterIds.map(Number));
            const matched = validChapters.filter((c) => presetSet.has(Number(c.id))).map((c) => Number(c.id));
            setSelectedChapterIds(matched.slice(0, 5));
          } else {
            const unscanned = validChapters.filter((c) => c.worldExtracted !== 1).map((c) => Number(c.id));
            if (unscanned.length > 0) {
              setSelectedChapterIds(unscanned.slice(0, 5));
            } else {
              setSelectedChapterIds(validChapters.slice(-3).map((c) => Number(c.id)));
            }
          }
        }
      } catch (e: any) {
        useAlert.error("读取章节列表失败：" + (e?.message || "网络异常"));
      } finally {
        if (active) setLoadingChapters(false);
      }
    };

    loadChapters();
    return () => {
      active = false;
    };
  }, [opened, workId, defaultFocusScope, presetChapterIds?.join(",")]);

  const unscannedCount = useMemo(
    () => chapters.filter((c) => c.worldExtracted !== 1).length,
    [chapters]
  );

  const toggleChapter = (id: number) => {
    setSelectedChapterIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        useAlert.warning("单次最多同时扫描 5 章（保证 AI 提取精准度与免费额度稳定）");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleRunScan = async () => {
    if (selectedChapterIds.length === 0 || scanning) {
      useAlert.warning("请至少选择 1 个有正文的章节");
      return;
    }
    try {
      setScanning(true);
      const res = await extractWorldFromChapters({
        workId,
        chapterIds: selectedChapterIds,
        onlyUnscanned: false,
      });
      if (res && res.success && res.result) {
        const result = res.result as ExtractWorldFromChaptersResult;
        setScanResult(result);

        // 默认全选所有发现的新增/更新项
        const nextChecked: Record<CategoryKey, string[]> = {
          characters: result.candidates.characters.map((x) => x.tempId),
          locations: result.candidates.locations.map((x) => x.tempId),
          factions: result.candidates.factions.map((x) => x.tempId),
          items: result.candidates.items.map((x) => x.tempId),
          rules: result.candidates.rules.map((x) => x.tempId),
          relations: result.candidates.relations.map((x) => x.tempId),
          timelineEvents: result.candidates.timelineEvents.map((x) => x.tempId),
        };
        setCheckedIds(nextChecked);

        // 优先停留在当前页面对应模块 Tab；若该模块为 0 条则自动切到第一个有结果的 Tab
        const preferredKey = scopeToTabKey(defaultFocusScope);
        if (result.candidates[preferredKey].length > 0) {
          setActiveTab(preferredKey);
        } else {
          const firstNonEmpty = CATEGORY_META.find((m) => result.candidates[m.key].length > 0);
          if (firstNonEmpty) setActiveTab(firstNonEmpty.key);
        }

        if (result.totalCount === 0) {
          useAlert.info("扫描完毕：所选章节中未发现尚未收录的新设定");
        } else {
          useAlert.success(`扫描完成！共提取到 ${result.totalCount} 条可同步设定（一次扫描覆盖全部 7 类设定）`);
        }
      } else {
        useAlert.error(res?.message || "AI 设定扫描失败");
      }
    } catch (e: any) {
      useAlert.error("扫描异常：" + (e?.message || "网络错误"));
    } finally {
      setScanning(false);
    }
  };

  const totalCheckedCount = useMemo(() => {
    return CATEGORY_META.reduce((sum, m) => sum + (checkedIds[m.key]?.length || 0), 0);
  }, [checkedIds]);

  const toggleItemChecked = (key: CategoryKey, tempId: string) => {
    setCheckedIds((prev) => {
      const list = prev[key] || [];
      return {
        ...prev,
        [key]: list.includes(tempId) ? list.filter((id) => id !== tempId) : [...list, tempId],
      };
    });
  };

  const toggleCategoryAll = (key: CategoryKey) => {
    if (!scanResult) return;
    const allIds = scanResult.candidates[key].map((item) => item.tempId);
    const current = checkedIds[key] || [];
    setCheckedIds((prev) => ({
      ...prev,
      [key]: current.length === allIds.length ? [] : allIds,
    }));
  };

  const handleApplySelected = async () => {
    if (!scanResult || applying) return;
    const selectedPayload: Partial<WorldSyncCandidatesBundle> = {
      characters: scanResult.candidates.characters.filter((x) => checkedIds.characters.includes(x.tempId)),
      locations: scanResult.candidates.locations.filter((x) => checkedIds.locations.includes(x.tempId)),
      factions: scanResult.candidates.factions.filter((x) => checkedIds.factions.includes(x.tempId)),
      items: scanResult.candidates.items.filter((x) => checkedIds.items.includes(x.tempId)),
      rules: scanResult.candidates.rules.filter((x) => checkedIds.rules.includes(x.tempId)),
      relations: scanResult.candidates.relations.filter((x) => checkedIds.relations.includes(x.tempId)),
      timelineEvents: scanResult.candidates.timelineEvents.filter((x) => checkedIds.timelineEvents.includes(x.tempId)),
    };

    try {
      setApplying(true);
      const res = await applyExtractedWorldEntities({
        workId,
        scannedChapterIds: scanResult.scannedChapters.map((c) => c.id),
        selected: selectedPayload,
      });
      if (res && res.success) {
        useAlert.success(res.message || "已同步所选世界观设定至资料库");
        onApplied?.();
        onClose();
      } else {
        useAlert.error(res?.message || "写入设定资料库失败");
      }
    } catch (e: any) {
      useAlert.error("写入异常：" + (e?.message || "网络错误"));
    } finally {
      setApplying(false);
    }
  };

  const renderCandidateCard = (key: CategoryKey, item: any) => {
    const checked = (checkedIds[key] || []).includes(item.tempId);
    let title = item.name || item.title || "";
    let subtitle = "";
    let detail = "";

    if (key === "characters") {
      subtitle = [item.identity, item.faction, item.gender].filter(Boolean).join(" · ");
      detail = [
        item.personality ? `性格：${item.personality}` : "",
        item.abilities ? `能力：${item.abilities}` : "",
        item.description || "",
      ]
        .filter(Boolean)
        .join(" ｜ ");
    } else if (key === "locations") {
      subtitle = [item.region, item.type, item.governingFaction ? `势力：${item.governingFaction}` : ""]
        .filter(Boolean)
        .join(" · ");
      detail = [item.geography, item.features, item.description].filter(Boolean).join(" ｜ ");
    } else if (key === "factions") {
      subtitle = [item.leader ? `领袖：${item.leader}` : "", item.alignment, item.controlledLocations]
        .filter(Boolean)
        .join(" · ");
      detail = [item.doctrine ? `宗旨：${item.doctrine}` : "", item.description].filter(Boolean).join(" ｜ ");
    } else if (key === "items") {
      subtitle = [item.tier, item.ownerName ? `持有者：${item.ownerName}` : ""].filter(Boolean).join(" · ");
      detail = [
        item.effects ? `效果：${item.effects}` : "",
        item.drawbacks ? `代价/限制：${item.drawbacks}` : "",
        item.description || "",
      ]
        .filter(Boolean)
        .join(" ｜ ");
    } else if (key === "rules") {
      subtitle = item.category || "";
      detail = [
        item.mechanisms ? `机制：${item.mechanisms}` : "",
        item.taboos ? `禁忌：${item.taboos}` : "",
        item.drawbacks ? `代价：${item.drawbacks}` : "",
      ]
        .filter(Boolean)
        .join(" ｜ ");
    } else if (key === "relations") {
      title = `${item.sourceCharName}  →  ${item.targetCharName}`;
      subtitle = `${item.relationType} (${item.relationTag || "neutral"})`;
      detail = item.description || "";
    } else if (key === "timelineEvents") {
      title = `[${item.timePoint}] ${item.title}`;
      subtitle = [item.location, item.characters ? `涉及：${item.characters}` : ""].filter(Boolean).join(" · ");
      detail = item.description || "";
    }

    return (
      <Paper
        key={item.tempId}
        p={10}
        radius="md"
        bd={`1px solid ${checked ? "#7dd3fc" : "#e2e8f0"}`}
        bg={checked ? "#f0f9ff" : "#ffffff"}
        style={{ cursor: "pointer", transition: "all 0.15s ease" }}
        onClick={() => toggleItemChecked(key, item.tempId)}
      >
        <Flex align="flex-start" gap={10}>
          <Checkbox
            mt={2}
            size="xs"
            color="cyan"
            checked={checked}
            onChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              toggleItemChecked(key, item.tempId);
            }}
          />
          <Box flex={1} miw={0}>
            <Group gap={6} mb={3} wrap="wrap">
              <Text fz={13} fw={700} c="#0f172a">
                {title}
              </Text>
              <Badge size="xs" variant="light" color={item.status === "new" ? "green" : "orange"}>
                {item.status === "new" ? "新增入库" : "追加更新"}
              </Badge>
              {item.sourceChapter ? (
                <Badge size="xs" variant="outline" color="gray">
                  {item.sourceChapter}
                </Badge>
              ) : null}
              {subtitle ? (
                <Text fz={11.5} c="#475569">
                  {subtitle}
                </Text>
              ) : null}
            </Group>
            {item.existingSummary ? (
              <Text fz={11} c="#b45309" mb={2}>
                现有设定参考：{item.existingSummary}（勾选后将以追加方式保留原内容）
              </Text>
            ) : null}
            {detail ? (
              <Text fz={12} c="#334155" lh={1.55}>
                {detail}
              </Text>
            ) : null}
          </Box>
        </Flex>
      </Paper>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (scanning || applying) return;
        onClose();
      }}
      centered
      size="xl"
      radius="md"
      title={
        <Group gap={8}>
          <FiCpu size={17} color="#00c9ff" />
          <Text fz={16} fw={700} c="#0f172a">
            AI 从章节全文智能扫描沉淀设定
          </Text>
          <Badge size="xs" variant="light" color="cyan">
            单次调用覆盖全部 7 类设定
          </Badge>
        </Group>
      }
    >
      <Box pos="relative" mih={320}>
        <LoadingMask
          visible={loadingChapters || scanning || applying}
          label={
            scanning
              ? "AI 正在通读所选章节，一次性提炼角色、地点、阵营、物品、规则、关系与时间线..."
              : applying
                ? "正在批量写入设定资料库并自动建立实体关联..."
                : "正在加载章节列表..."
          }
        />

        {!scanResult ? (
          <Stack gap={12}>
            <Alert variant="light" color="cyan" icon={<FiAlertCircle size={15} />} p={10}>
              <Text fz={12} c="#0e7490" lh={1.55}>
                每次扫描仅消耗 1 次 AI 调用即可同步提取全部 7 个模块的新设定；已扫描过的章节会自动标记「已扫描」，支持增量勾选以节省免费额度。
              </Text>
            </Alert>

            <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
              <Group gap={8}>
                <Text fz={13} fw={700} c="#1e293b">
                  选择待扫描章节（已选 {selectedChapterIds.length}/5 章）
                </Text>
                <Badge size="xs" variant="light" color={unscannedCount > 0 ? "orange" : "green"}>
                  未扫描 {unscannedCount} 章
                </Badge>
              </Group>
              <Group gap={6}>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="cyan"
                  disabled={unscannedCount === 0}
                  onClick={() =>
                    setSelectedChapterIds(
                      chapters
                        .filter((c) => c.worldExtracted !== 1)
                        .slice(0, 5)
                        .map((c) => Number(c.id))
                    )
                  }
                >
                  选中前 5 个未扫描章
                </Button>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => setSelectedChapterIds([])}
                >
                  清空选择
                </Button>
              </Group>
            </Flex>

            {chapters.length === 0 ? (
              <Paper p={24} radius="md" bg="#f8fafc" ta="center">
                <Text fz={13} c="#64748b">
                  当前作品暂无包含正文的章节，请先撰写章节后再执行设定扫描。
                </Text>
              </Paper>
            ) : (
              <ScrollArea.Autosize mah={300} offsetScrollbars>
                <Stack gap={6}>
                  {chapters.map((ch) => {
                    const id = Number(ch.id);
                    const checked = selectedChapterIds.includes(id);
                    const scanned = ch.worldExtracted === 1;
                    return (
                      <Paper
                        key={id}
                        px={10}
                        py={8}
                        radius="sm"
                        bd={`1px solid ${checked ? "#38bdf8" : "#e2e8f0"}`}
                        bg={checked ? "#f0f9ff" : "#ffffff"}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleChapter(id)}
                      >
                        <Flex align="center" justify="space-between" gap={8}>
                          <Group gap={8} wrap="nowrap">
                            <Checkbox
                              size="xs"
                              color="cyan"
                              checked={checked}
                              onChange={() => {}}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleChapter(id);
                              }}
                            />
                            <Text fz={12.5} fw={600} c="#1e293b">
                              第 {ch.chapterNumber} 章 · {ch.title}
                            </Text>
                          </Group>
                          <Group gap={6}>
                            <Text fz={11} c="#64748b">
                              {(ch.wordCount || 0).toLocaleString()} 字
                            </Text>
                            <Badge size="xs" variant="light" color={scanned ? "gray" : "orange"}>
                              {scanned ? "已扫描" : "未扫描"}
                            </Badge>
                          </Group>
                        </Flex>
                      </Paper>
                    );
                  })}
                </Stack>
              </ScrollArea.Autosize>
            )}

            <Flex justify="flex-end" gap={8} pt={6} style={{ borderTop: "1px solid #f1f5f9" }}>
              <Button size="xs" variant="default" onClick={onClose}>
                取消
              </Button>
              <Button
                size="xs"
                color="cyan"
                leftSection={<FiCpu size={13} />}
                disabled={selectedChapterIds.length === 0}
                loading={scanning}
                onClick={handleRunScan}
              >
                开始智能扫描（{selectedChapterIds.length} 章）
              </Button>
            </Flex>
          </Stack>
        ) : (
          <Stack gap={12}>
            <Flex align="center" justify="space-between" wrap="wrap" gap={8}>
              <Group gap={6}>
                <Badge size="sm" variant="light" color="cyan">
                  已扫描 {scanResult.scannedChapters.length} 章
                </Badge>
                <Text fz={12} c="#475569">
                  共提取 {scanResult.totalCount} 条候选设定 · 已勾选 {totalCheckedCount} 条
                </Text>
              </Group>
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<FiRefreshCw size={12} />}
                onClick={() => setScanResult(null)}
              >
                重新选择章节
              </Button>
            </Flex>

            <Tabs value={activeTab} onChange={(val) => val && setActiveTab(val)} color="cyan">
              <Tabs.List>
                {CATEGORY_META.map((meta) => {
                  const count = scanResult.candidates[meta.key].length;
                  const checkedCount = checkedIds[meta.key]?.length || 0;
                  return (
                    <Tabs.Tab key={meta.key} value={meta.key} leftSection={meta.icon}>
                      <Group gap={4}>
                        <Text fz={12}>{meta.label}</Text>
                        <Badge
                          size="xs"
                          variant={count > 0 ? "filled" : "light"}
                          color={count > 0 ? meta.color : "gray"}
                        >
                          {checkedCount}/{count}
                        </Badge>
                      </Group>
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>

              {CATEGORY_META.map((meta) => {
                const list = scanResult.candidates[meta.key];
                const allSelected = list.length > 0 && (checkedIds[meta.key]?.length || 0) === list.length;
                return (
                  <Tabs.Panel key={meta.key} value={meta.key} pt={10}>
                    {list.length === 0 ? (
                      <Paper p={24} radius="md" bg="#f8fafc" ta="center">
                        <Text fz={12.5} c="#64748b">
                          本次扫描在「{meta.label}」模块未发现新增或变更设定，可切换其他标签查看。
                        </Text>
                      </Paper>
                    ) : (
                      <Stack gap={8}>
                        <Flex justify="space-between" align="center">
                          <Text fz={12} c="#64748b">
                            勾选需要写入「{meta.label}」库的条目：
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="cyan"
                            onClick={() => toggleCategoryAll(meta.key)}
                          >
                            {allSelected ? "取消全选本页" : "全选本页"}
                          </Button>
                        </Flex>
                        <ScrollArea.Autosize mah={320} offsetScrollbars>
                          <Stack gap={8}>
                            {list.map((item) => renderCandidateCard(meta.key, item))}
                          </Stack>
                        </ScrollArea.Autosize>
                      </Stack>
                    )}
                  </Tabs.Panel>
                );
              })}
            </Tabs>

            <Flex justify="space-between" align="center" pt={8} style={{ borderTop: "1px solid #f1f5f9" }}>
              <Text fz={11.5} c="#64748b">
                提示：「追加更新」条目仅补充新信息，不会覆盖你手动写好的旧设定。
              </Text>
              <Group gap={8}>
                <Button size="xs" variant="default" onClick={onClose}>
                  稍后再说
                </Button>
                <Button
                  size="xs"
                  color="cyan"
                  leftSection={<FiCheck size={13} />}
                  loading={applying}
                  onClick={handleApplySelected}
                >
                  {totalCheckedCount > 0 ? `确认同步选中项 (${totalCheckedCount})` : "仅标记所选章节为已扫描"}
                </Button>
              </Group>
            </Flex>
          </Stack>
        )}
      </Box>
    </Modal>
  );
}
