// 组件：A ➔ B 跨度剧情推演工作台（支持字数篇幅预算、角色标签约束、笔记设定约束与一键批量写入故事轴）
"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Drawer,
  Badge,
  ActionIcon,
  Stack,
  Paper,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  MultiSelect,
  LoadingOverlay,
  Group,
  ScrollArea,
  Tabs,
} from "@mantine/core";
import {
  FiZap,
  FiPlus,
  FiArrowRight,
  FiCheck,
  FiLayers,
  FiClock,
  FiTrash2,
  FiUser,
  FiFileText,
} from "react-icons/fi";
import {
  OutlineNode,
  PlotDeductionPath,
  PlotDeductionRecord,
  deductPlot,
  getPlotDeductions,
  savePlotDeduction,
  deletePlotDeduction,
  batchCreateOutlineNodes,
} from "@/rest/outline";
import { CharacterItem, getCharacterList } from "@/rest/world";
import { NoteData, NoteListResult, getNoteList } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";

interface DrawerPlotDeductionProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  outlineNodes: OutlineNode[];
  onOutlineUpdated: () => Promise<void>;
}

export default function DrawerPlotDeduction({
  opened,
  onClose,
  workId,
  outlineNodes,
  onOutlineUpdated,
}: DrawerPlotDeductionProps) {
  const [activeTab, setActiveTab] = useState<string | null>("deduct");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [historyList, setHistoryList] = useState<PlotDeductionRecord[]>([]);

  // 推演输入
  const [startPoint, setStartPoint] = useState("");
  const [targetPoint, setTargetPoint] = useState("");
  const [estimatedWords, setEstimatedWords] = useState<number>(10000);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [pacePreference, setPacePreference] = useState("standard");

  // 推演结果
  const [deductionPaths, setDeductionPaths] = useState<PlotDeductionPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [adopting, setAdopting] = useState(false);

  useEffect(() => {
    if (opened && workId) {
      getCharacterList(workId).then((res) => {
        if (res && res.success && Array.isArray(res.result)) {
          setCharacters(res.result);
        }
      });
      getNoteList(workId, "all", "").then((res) => {
        if (res && res.success && res.result) {
          const r = res.result as NoteListResult;
          setNotes(Array.isArray(r.list) ? r.list : []);
        }
      });
      fetchHistory();
    }
  }, [opened, workId]);

  const fetchHistory = async () => {
    if (!workId) return;
    try {
      const res = await getPlotDeductions(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setHistoryList(res.result);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartDeduction = async () => {
    if (!startPoint.trim()) {
      useAlert.warning("请输入【起点剧情 A（现状）】");
      return;
    }
    if (!targetPoint.trim()) {
      useAlert.warning("请输入【目标终点 B（预期目标）】");
      return;
    }

    try {
      setLoading(true);
      setDeductionPaths([]);
      setSelectedPathId(null);

      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      const res = await deductPlot({
        workId,
        startPoint: startPoint.trim(),
        targetPoint: targetPoint.trim(),
        estimatedWords: Number(estimatedWords) || 10000,
        selectedCharacterIds: charIdsNum,
        selectedNoteIds: noteIdsNum,
        pacePreference,
      });

      if (res && res.success && res.result && Array.isArray(res.result.paths)) {
        setDeductionPaths(res.result.paths);
        if (res.result.paths.length > 0) {
          setSelectedPathId(res.result.paths[0].id);
        }
        await savePlotDeduction({
          workId: Number(workId),
          startPoint: startPoint.trim(),
          targetPoint: targetPoint.trim(),
          involvedCharacters: charIdsNum.join(", "),
          pacePreference,
          generatedPaths: res.result.paths,
        });
        fetchHistory();
      } else {
        useAlert.error("推演失败: " + (res?.message || "大模型未返回有效路径"));
      }
    } catch (e: any) {
      useAlert.error("推演异常: " + (e?.message || "网络错误"));
    } finally {
      setLoading(false);
    }
  };

  const handleAdoptPath = async (path: PlotDeductionPath) => {
    if (!workId) return;
    try {
      setAdopting(true);
      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      const newNodes = path.steps.map((step, idx) => ({
        workId: Number(workId),
        title: step.title,
        event: step.event || step.content || "",
        twist: step.twist || step.keyConflict || "",
        nextGoal: step.nextGoal || "",
        suspense: step.suspense || "",
        content: `${step.event || step.content || ""}\n转折: ${step.twist || ""}`,
        wordCountEstimate: step.estimatedWords || Math.round((Number(estimatedWords) || 10000) / path.steps.length),
        linkedCharacterIds: charIdsNum,
        linkedNoteIds: noteIdsNum,
        type: "scene",
        status: "planned",
        orderIndex: outlineNodes.length + idx,
      }));

      await batchCreateOutlineNodes({
        workId: Number(workId),
        nodes: newNodes,
        batch: true,
      });

      useAlert.success(`已成功将「${path.title}」的 ${newNodes.length} 个递进情节写入故事轴！`);
      await onOutlineUpdated();
      onClose();
    } catch (e: any) {
      useAlert.error("采纳写入大纲失败: " + (e?.message || "网络异常"));
    } finally {
      setAdopting(false);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      await deletePlotDeduction(id);
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
      useAlert.success("已删除历史记录");
    } catch (e: any) {
      useAlert.error("删除失败: " + (e?.message || "网络异常"));
    }
  };

  const charOptions = characters.map((c) => ({
    value: String(c.id),
    label: `${c.name}${c.identity ? ` (${c.identity})` : ""}`,
  }));

  const noteOptions = notes.map((n) => ({
    value: String(n.id),
    label: `[${n.category}] ${n.title}`,
  }));

  const selectedPath = deductionPaths.find((p) => p.id === selectedPathId) || deductionPaths[0];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <FiZap size={16} color="#0284c7" />
          <Text fw={700} fz={16}>
            A ➔ B 跨度剧情推演工作台
          </Text>
        </Group>
      }
      position="right"
      size="xl"
    >
      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="deduct" leftSection={<FiZap size={13} />}>
            剧情桥接推演
          </Tabs.Tab>
          <Tabs.Tab
            value="history"
            leftSection={<FiClock size={13} />}
            rightSection={
              historyList.length > 0 ? (
                <Badge size="xs" variant="light" color="gray">
                  {historyList.length}
                </Badge>
              ) : null
            }
          >
            推演历史
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {activeTab === "deduct" && (
        <Stack gap="md">
          {/* 输入表单 */}
          <Paper p="sm" withBorder radius="md" bg="gray.0">
            <Stack gap="xs">
              <Textarea
                label="📍 起点剧情 A（现状 / 刚发生的事）"
                placeholder="例如：林舟刚被逐出师门，身负重伤，身无分文逃入荒野..."
                required
                autosize
                minRows={2}
                maxRows={4}
                value={startPoint}
                onChange={(e) => setStartPoint(e.currentTarget.value)}
              />

              <Textarea
                label="🏁 目标终点 B（预期结果 / 想要达到的阶段）"
                placeholder="例如：林舟查清凶手线索，并成功拜入天下第一宗门..."
                required
                autosize
                minRows={2}
                maxRows={4}
                value={targetPoint}
                onChange={(e) => setTargetPoint(e.currentTarget.value)}
              />

              <Group grow align="flex-start">
                <NumberInput
                  label="📏 预期中间字数篇幅 (字)"
                  description="AI 将据此自动拆解过渡章节节奏"
                  min={1000}
                  max={50000}
                  step={1000}
                  value={estimatedWords}
                  onChange={(val) => setEstimatedWords(Number(val) || 10000)}
                />

                <Select
                  label="🎭 戏剧风格偏好"
                  description="选择不同的戏剧冲突侧重"
                  data={[
                    { value: "standard", label: "稳健严密 (因果链扎实)" },
                    { value: "twist", label: "惊天反转 (层层疑云)" },
                    { value: "dark", label: "极限施压 (绝境突破)" },
                  ]}
                  value={pacePreference}
                  onChange={(val) => setPacePreference(val || "standard")}
                />
              </Group>

              <MultiSelect
                label="👥 关联参演角色 (AI 将严格符合其性格与标签)"
                placeholder="选择参与本次推演的角色..."
                data={charOptions}
                value={selectedCharIds}
                onChange={setSelectedCharIds}
                searchable
                clearable
                leftSection={<FiUser size={14} />}
              />

              <MultiSelect
                label="📑 关联设定/灵感笔记 (AI 将遵守其规则设定)"
                placeholder="选择需遵守的世界观或设定笔记..."
                data={noteOptions}
                value={selectedNoteIds}
                onChange={setSelectedNoteIds}
                searchable
                clearable
                leftSection={<FiFileText size={14} />}
              />

              <Button
                variant="filled"
                color="blue"
                leftSection={<FiZap size={14} />}
                onClick={handleStartDeduction}
                loading={loading}
                mt="xs"
              >
                开始推演桥梁路径 (生成 3 套方案)
              </Button>
            </Stack>
          </Paper>

          {/* 推演结果展示区 */}
          {deductionPaths.length > 0 && (
            <Stack gap="sm">
              <Text fw={700} fz={14} c="#0f172a">
                🔮 推演生成的 3 条演进路径（点击切换）：
              </Text>

              <Group gap="xs">
                {deductionPaths.map((path) => {
                  const isSelected = path.id === selectedPath?.id;
                  return (
                    <Button
                      key={path.id}
                      size="xs"
                      variant={isSelected ? "filled" : "default"}
                      color={isSelected ? "blue" : "gray"}
                      onClick={() => setSelectedPathId(path.id)}
                    >
                      {path.title}
                    </Button>
                  );
                })}
              </Group>

              {selectedPath && (
                <Paper p="md" withBorder radius="md" bg="#ffffff">
                  <Flex justify="space-between" align="center" mb="xs">
                    <Group gap="xs">
                      <Badge variant="light" color="blue">
                        {selectedPath.style || "演进路线"}
                      </Badge>
                      <Text fw={700} fz={15}>
                        {selectedPath.title}
                      </Text>
                    </Group>

                    <Button
                      size="xs"
                      variant="filled"
                      color="teal"
                      leftSection={<FiCheck size={13} />}
                      loading={adopting}
                      onClick={() => handleAdoptPath(selectedPath)}
                    >
                      一键采纳并写入故事轴
                    </Button>
                  </Flex>

                  <Text fz={13} c="dimmed" mb="md">
                    💡 <b>核心逻辑：</b> {selectedPath.summary}
                  </Text>

                  {/* 步骤列表 */}
                  <Stack gap="xs">
                    {selectedPath.steps.map((step, sIdx) => (
                      <Paper key={sIdx} p="sm" withBorder radius="sm" bg="gray.0">
                        <Flex justify="space-between" align="center" mb={4}>
                          <Text fz={13} fw={700} c="#0f172a">
                            步骤 {sIdx + 1}：{step.title}
                          </Text>
                          {step.estimatedWords && (
                            <Badge variant="outline" color="gray" size="xs">
                              约 {step.estimatedWords} 字
                            </Badge>
                          )}
                        </Flex>

                        <Stack gap={4}>
                          <Text fz={12} c="#334155">
                            <b>📍 发生经过：</b> {step.event || step.content}
                          </Text>
                          {step.twist && (
                            <Text fz={12} c="orange.8">
                              <b>⚡ 意外转折：</b> {step.twist}
                            </Text>
                          )}
                          {step.nextGoal && (
                            <Text fz={12} c="teal.8">
                              <b>🎯 下一步：</b> {step.nextGoal}
                            </Text>
                          )}
                          {step.suspense && (
                            <Text fz={12} c="grape.8">
                              <b>🕳️ 伏笔悬念：</b> {step.suspense}
                            </Text>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          )}
        </Stack>
      )}

      {activeTab === "history" && (
        <Stack gap="sm">
          {historyList.length === 0 ? (
            <Text fz={13} c="dimmed" ta="center" py="xl">
              暂无历史推演记录
            </Text>
          ) : (
            historyList.map((rec) => (
              <Paper key={rec.id} p="sm" withBorder radius="md">
                <Flex justify="space-between" align="flex-start">
                  <Box style={{ flex: 1 }}>
                    <Text fz={13} fw={700} c="#0f172a">
                      起点：{rec.startPoint}
                    </Text>
                    <Text fz={13} fw={700} c="blue.7" mt={2}>
                      终点：{rec.targetPoint}
                    </Text>
                    <Text fz={11} c="dimmed" mt={4}>
                      {new Date(rec.createdAt).toLocaleString("zh-CN")} · 共{" "}
                      {rec.generatedPaths?.length || 0} 套生成方案
                    </Text>
                  </Box>

                  <Group gap={4}>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => {
                        setStartPoint(rec.startPoint);
                        setTargetPoint(rec.targetPoint);
                        if (Array.isArray(rec.generatedPaths)) {
                          setDeductionPaths(rec.generatedPaths);
                          if (rec.generatedPaths.length > 0) {
                            setSelectedPathId(rec.generatedPaths[0].id);
                          }
                        }
                        setActiveTab("deduct");
                      }}
                    >
                      载入
                    </Button>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteHistory(rec.id)}
                    >
                      <FiTrash2 size={13} />
                    </ActionIcon>
                  </Group>
                </Flex>
              </Paper>
            ))
          )}
        </Stack>
      )}
    </Drawer>
  );
}
