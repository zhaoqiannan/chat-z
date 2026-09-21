// 组件：A ➔ B 跨度剧情推演工作台（支持作者自由输入演进期望、智能生成多套具体方案、支持采纳前实时编辑、宽度 55vw）
"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Badge,
  ActionIcon,
  Stack,
  Paper,
  Textarea,
  TextInput,
  NumberInput,
  MultiSelect,
  Group,
  Text,
  Button,
  Flex,
  Box,
  Tooltip,
} from "@mantine/core";
import {
  FiZap,
  FiCheck,
  FiUser,
  FiFileText,
  FiEdit2
} from "react-icons/fi";
import {
  OutlineNode,
  PlotDeductionPath,
  PlotDeductionRecord,
  deductPlot,
  savePlotDeduction,
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
  loadedRecord?: PlotDeductionRecord | null;
}

export default function DrawerPlotDeduction({
  opened,
  onClose,
  workId,
  outlineNodes,
  onOutlineUpdated,
  loadedRecord,
}: DrawerPlotDeductionProps) {
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);

  // 推演输入
  const [startPoint, setStartPoint] = useState("");
  const [targetPoint, setTargetPoint] = useState("");
  const [pathPreference, setPathPreference] = useState("");
  const [estimatedWords, setEstimatedWords] = useState<number>(10000);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // 推演结果
  const [deductionPaths, setDeductionPaths] = useState<PlotDeductionPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [isEditingPath, setIsEditingPath] = useState(false);

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
    }
  }, [opened, workId]);

  // 从历史记录中预载入
  useEffect(() => {
    if (loadedRecord) {
      setStartPoint(loadedRecord.startPoint || "");
      setTargetPoint(loadedRecord.targetPoint || "");
      if (Array.isArray(loadedRecord.generatedPaths) && loadedRecord.generatedPaths.length > 0) {
        setDeductionPaths(loadedRecord.generatedPaths);
        setSelectedPathId(loadedRecord.generatedPaths[0].id);
      }
    }
  }, [loadedRecord]);

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
      setIsEditingPath(false);

      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      const res = await deductPlot({
        workId,
        startPoint: startPoint.trim(),
        targetPoint: targetPoint.trim(),
        estimatedWords: Number(estimatedWords) || 10000,
        pathPreference: pathPreference.trim(),
        pacePreference: pathPreference.trim() || "平稳递进",
        selectedCharacterIds: charIdsNum,
        selectedNoteIds: noteIdsNum,
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
          pacePreference: pathPreference.trim() || "自定义风格",
          generatedPaths: res.result.paths,
        });
      } else {
        useAlert.error("推演失败: " + (res?.message || "大模型未返回有效路径"));
      }
    } catch (e: any) {
      useAlert.error("推演异常: " + (e?.message || "网络错误"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCurrentPath = (updater: (prev: PlotDeductionPath) => PlotDeductionPath) => {
    setDeductionPaths((prev) =>
      prev.map((p) => (p.id === selectedPathId ? updater(p) : p))
    );
  };

  const handleAdoptPath = async (path: PlotDeductionPath) => {
    if (!workId) return;
    try {
      setAdopting(true);
      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      // 组装为树状结构：父节点为推演母题总括 (Level 1)，子节点为推演出的具体阶段 (Level 2)
      const parentTitle = `推演：从「${startPoint.trim().slice(0, 15)}」到「${targetPoint.trim().slice(0, 15)}」· ${path.title}`;
      const parentNode = {
        workId: Number(workId),
        category: "deduction",
        level: 1,
        title: parentTitle,
        summary: path.summary || "推演桥梁总括",
        deductionOrigin: `从「${startPoint.trim()}」➔「${targetPoint.trim()}」· ${path.title}`,
        deductionPremise: startPoint.trim(),
        deductionTarget: targetPoint.trim(),
        deductionPathTitle: path.title,
        content: path.summary || "推演桥梁总括",
        event: path.summary || "",
        timeframe: "跨度推演时段",
        location: "核心情境场景",
        wordCountEstimate: Number(estimatedWords) || 10000,
        linkedCharacterIds: charIdsNum,
        linkedNoteIds: noteIdsNum,
        type: "bridge",
        status: "planned",
        orderIndex: outlineNodes.length,
        children: path.steps.map((step, idx) => {
          const stepNum = idx + 1;
          const stepContent = step.event || step.content || "";
          return {
            workId: Number(workId),
            category: "deduction",
            level: 2,
            title: step.title || `第 ${stepNum} 阶段`,
            deductionOrigin: `从「${startPoint.trim().slice(0, 20)}」➔「${targetPoint.trim().slice(0, 20)}」· ${path.title} · 第 ${stepNum} 阶段`,
            deductionPremise: startPoint.trim(),
            deductionTarget: targetPoint.trim(),
            deductionPathTitle: path.title,
            deductionStepIndex: stepNum,
            event: stepContent,
            twist: step.twist || step.keyConflict || "",
            nextGoal: step.nextGoal || "",
            suspense: step.suspense || "",
            content: stepContent,
            wordCountEstimate: step.estimatedWords || Math.round((Number(estimatedWords) || 10000) / path.steps.length),
            linkedCharacterIds: charIdsNum,
            linkedNoteIds: noteIdsNum,
            type: "scene",
            status: "planned",
            orderIndex: idx,
          };
        }),
      };

      await batchCreateOutlineNodes({
        workId: Number(workId),
        nodes: [parentNode],
        batch: true,
      });

      useAlert.success(`已成功采纳「${path.title}」至剧情推演大纲！`);
      await onOutlineUpdated();
      onClose();
    } catch (e: any) {
      useAlert.error("采纳失败: " + (e?.message || "网络异常"));
    } finally {
      setAdopting(false);
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
      size="55vw"
    >
      <Stack gap="md" pb="xl">
        {/* 输入表单 */}
        <Paper p="sm" withBorder radius="md" bg="gray.0">
          <Stack gap="xs">
            <Textarea
              label="起点剧情 A（现状 / 刚发生的事）"
              placeholder="例如：林舟刚被逐出师门，身负重伤逃入荒野..."
              required
              autosize
              minRows={2}
              maxRows={4}
              value={startPoint}
              onChange={(e) => setStartPoint(e.currentTarget.value)}
            />

            <Textarea
              label="目标终点 B（预期结果 / 想要达到的阶段）"
              placeholder="例如：林舟查清线索并拜入天下第一宗门..."
              required
              autosize
              minRows={2}
              maxRows={4}
              value={targetPoint}
              onChange={(e) => setTargetPoint(e.currentTarget.value)}
            />

            <Textarea
              label="发展路径期望 / 演进风格描述（选填）"
              placeholder="例如：平稳过渡，中间经历一些温馨小故事，角色感情升温；或：快节奏多方博弈，充满机锋对话..."
              autosize
              minRows={2}
              maxRows={4}
              value={pathPreference}
              onChange={(e) => setPathPreference(e.currentTarget.value)}
            />

            <Group grow align="flex-start">
              <NumberInput
                label="预期中间篇幅 (字)"
                description="AI 将据此自动拆解合理的递进节奏"
                min={1000}
                max={50000}
                step={1000}
                value={estimatedWords}
                onChange={(val) => setEstimatedWords(Number(val) || 10000)}
              />

              <MultiSelect
                label="关联参演角色"
                placeholder="选择参与推演的角色..."
                data={charOptions}
                value={selectedCharIds}
                onChange={setSelectedCharIds}
                searchable
                clearable
                leftSection={<FiUser size={14} />}
              />
            </Group>

            <MultiSelect
              label="关联参考设定/笔记"
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
              开始推演桥接路径
            </Button>
          </Stack>
        </Paper>

        {/* 推演结果展示区 */}
        {deductionPaths.length > 0 && (
          <Stack gap="sm">
            <Flex justify="space-between" align="center">
              <Text fw={700} fz={14} c="#0f172a">
                推演生成的演进方案（点击切换方案）：
              </Text>
              <Button
                size="compact-xs"
                variant={isEditingPath ? "filled" : "light"}
                color="indigo"
                leftSection={<FiEdit2 size={12} />}
                onClick={() => setIsEditingPath((v) => !v)}
              >
                {isEditingPath ? "完成编辑" : "编辑方案内容"}
              </Button>
            </Flex>

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
                  <Group gap="xs" style={{ flex: 1 }}>
                    <Badge variant="light" color="blue">
                      {selectedPath.style || "演进方案"}
                    </Badge>
                    {isEditingPath ? (
                      <TextInput
                        size="xs"
                        style={{ flex: 1, maxWidth: 300 }}
                        value={selectedPath.title}
                        onChange={(e) => {
                          const val = e.currentTarget.value;
                          handleUpdateCurrentPath((prev) => ({ ...prev, title: val }));
                        }}
                      />
                    ) : (
                      <Text fw={700} fz={15}>
                        {selectedPath.title}
                      </Text>
                    )}
                  </Group>

                  <Button
                    size="xs"
                    variant="filled"
                    color="teal"
                    leftSection={<FiCheck size={13} />}
                    loading={adopting}
                    onClick={() => handleAdoptPath(selectedPath)}
                  >
                    一键采纳写入大纲 (一级节点+步骤)
                  </Button>
                </Flex>

                {isEditingPath ? (
                  <Textarea
                    label="方案总述"
                    size="xs"
                    autosize
                    minRows={2}
                    value={selectedPath.summary || ""}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      handleUpdateCurrentPath((prev) => ({ ...prev, summary: val }));
                    }}
                    mb="md"
                  />
                ) : (
                  <Text fz={13} c="dimmed" mb="md" style={{ lineHeight: 1.6 }}>
                    <b>核心推进逻辑：</b> {selectedPath.summary}
                  </Text>
                )}

                {/* 步骤列表 */}
                <Stack gap="xs">
                  {selectedPath.steps.map((step, sIdx) => (
                    <Paper key={sIdx} p="sm" withBorder radius="sm" bg="gray.0">
                      <Flex justify="space-between" align="center" mb={6}>
                        <Group gap="xs" style={{ flex: 1 }}>
                          <Badge variant="filled" color="indigo" size="xs">
                            第 {sIdx + 1} 阶段
                          </Badge>
                          {isEditingPath ? (
                            <TextInput
                              size="xs"
                              style={{ flex: 1, maxWidth: 260 }}
                              value={step.title}
                              onChange={(e) => {
                                const val = e.currentTarget.value;
                                handleUpdateCurrentPath((prev) => {
                                  const steps = [...prev.steps];
                                  steps[sIdx] = { ...steps[sIdx], title: val };
                                  return { ...prev, steps };
                                });
                              }}
                            />
                          ) : (
                            <Text fz={13} fw={700} c="#0f172a">
                              {step.title}
                            </Text>
                          )}
                        </Group>

                        {step.estimatedWords && (
                          <Badge variant="outline" color="gray" size="xs">
                            约 {step.estimatedWords} 字
                          </Badge>
                        )}
                      </Flex>

                      {isEditingPath ? (
                        <Stack gap={4}>
                          <Textarea
                            label="发生经过与互动"
                            size="xs"
                            autosize
                            minRows={2}
                            value={step.event || step.content || ""}
                            onChange={(e) => {
                              const val = e.currentTarget.value;
                              handleUpdateCurrentPath((prev) => {
                                const steps = [...prev.steps];
                                steps[sIdx] = { ...steps[sIdx], event: val, content: val };
                                return { ...prev, steps };
                              });
                            }}
                          />
                          <TextInput
                            label="转折冲突点"
                            size="xs"
                            value={step.twist || ""}
                            onChange={(e) => {
                              const val = e.currentTarget.value;
                              handleUpdateCurrentPath((prev) => {
                                const steps = [...prev.steps];
                                steps[sIdx] = { ...steps[sIdx], twist: val };
                                return { ...prev, steps };
                              });
                            }}
                          />
                        </Stack>
                      ) : (
                        <Stack gap={4}>
                          <Text fz={12} c="#334155">
                            <b>发生经过与互动：</b> {step.event || step.content}
                          </Text>
                          {step.twist && (
                            <Text fz={12} c="orange.8">
                              <b>转折/推进点：</b> {step.twist}
                            </Text>
                          )}
                          {step.nextGoal && (
                            <Text fz={12} c="teal.8">
                              <b>下一步计划：</b> {step.nextGoal}
                            </Text>
                          )}
                          {step.suspense && (
                            <Text fz={12} c="grape.8">
                              <b>伏笔/线索：</b> {step.suspense}
                            </Text>
                          )}
                        </Stack>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
