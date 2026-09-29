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
            nextGoal: step.nextCondition || step.nextGoal || "",
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
          <FiZap size={16} color="#2563eb" />
          <Text fw={700} fz={16} c="#0f172a">
            剧情因果架桥与推演工作台
          </Text>
        </Group>
      }
      position="right"
      size="55vw"
      styles={{
        header: { borderBottom: "1px solid #e2e8f0", paddingBottom: 12 },
        body: { padding: 16, backgroundColor: "#f8fafc" },
      }}
    >
      <Stack gap="md" pb="xl">
        {/* 输入表单 - 极简线条风卡片 */}
        <Paper p="md" radius="md" style={{ border: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
          <Stack gap="sm">
            <Textarea
              label="起点剧情 A（现状 / 刚发生的事）"
              placeholder="例如：主角刚发现旧档案中的时间戳与证词有出入，目前尚未公开..."
              required
              autosize
              minRows={2}
              maxRows={4}
              value={startPoint}
              onChange={(e) => setStartPoint(e.currentTarget.value)}
              styles={{ input: { borderColor: "#cbd5e1" } }}
            />

            <Textarea
              label="目标终点 B（预期结果 / 想要达到的阶段）"
              placeholder="例如：主角在听证会上以确凿证据完成闭环，各方达成共识..."
              required
              autosize
              minRows={2}
              maxRows={4}
              value={targetPoint}
              onChange={(e) => setTargetPoint(e.currentTarget.value)}
              styles={{ input: { borderColor: "#cbd5e1" } }}
            />

            <Textarea
              label="演进偏好与要求（选填）"
              placeholder="例如：侧重信息验证与人脉暗流，避免剧烈武力冲突；或：角色心理博弈与试探..."
              autosize
              minRows={2}
              maxRows={3}
              value={pathPreference}
              onChange={(e) => setPathPreference(e.currentTarget.value)}
              styles={{ input: { borderColor: "#cbd5e1" } }}
            />

            <Group grow align="flex-start">
              <NumberInput
                label="预期总篇幅 (字)"
                description="AI 据此规划各因果阶段篇幅"
                min={1000}
                max={50000}
                step={1000}
                value={estimatedWords}
                onChange={(val) => setEstimatedWords(Number(val) || 10000)}
                styles={{ input: { borderColor: "#cbd5e1" } }}
              />

              <MultiSelect
                label="关联参演人物"
                placeholder="选择参与推演的核心角色..."
                data={charOptions}
                value={selectedCharIds}
                onChange={setSelectedCharIds}
                searchable
                clearable
                leftSection={<FiUser size={14} color="#64748b" />}
                styles={{ input: { borderColor: "#cbd5e1" } }}
              />
            </Group>

            <MultiSelect
              label="关联参考设定/笔记"
              placeholder="选择需遵守的世界观设定或设定笔记..."
              data={noteOptions}
              value={selectedNoteIds}
              onChange={setSelectedNoteIds}
              searchable
              clearable
              leftSection={<FiFileText size={14} color="#64748b" />}
              styles={{ input: { borderColor: "#cbd5e1" } }}
            />

            <Button
              variant="filled"
              color="blue"
              leftSection={<FiZap size={14} />}
              onClick={handleStartDeduction}
              loading={loading}
              mt="xs"
              style={{ fontWeight: 600 }}
            >
              开始推演因果桥梁
            </Button>
          </Stack>
        </Paper>

        {/* 推演结果展示区 - 极简线条风 */}
        {deductionPaths.length > 0 && (
          <Stack gap="sm">
            <Flex justify="space-between" align="center">
              <Text fw={700} fz={14} c="#1e293b">
                生成的演进路径（点击切换方案）：
              </Text>
              <Button
                size="compact-xs"
                variant={isEditingPath ? "filled" : "outline"}
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
                    style={{
                      border: isSelected ? "none" : "1px solid #cbd5e1",
                      borderRadius: 6,
                    }}
                  >
                    {path.title}
                  </Button>
                );
              })}
            </Group>

            {selectedPath && (
              <Paper p="md" radius="md" style={{ border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}>
                <Flex justify="space-between" align="center" mb="xs">
                  <Group gap="xs" style={{ flex: 1 }}>
                    <Badge variant="outline" color="blue" size="sm" radius="xs">
                      {selectedPath.style || "自然因果"}
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
                      <Text fw={700} fz={15} c="#0f172a">
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
                    label="方案核心推进逻辑"
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
                  <Box p="xs" mb="md" style={{ backgroundColor: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <Text fz={13} c="#334155" style={{ lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>核心因果逻辑：</span> {selectedPath.summary}
                    </Text>
                  </Box>
                )}

                {/* 步骤列表 - 简洁线条卡片 */}
                <Stack gap="sm">
                  {selectedPath.steps.map((step, sIdx) => {
                    const stateChanges = Array.isArray(step.stateChange)
                      ? step.stateChange
                      : typeof step.stateChange === "string" && step.stateChange
                      ? [step.stateChange]
                      : [];

                    return (
                      <Paper
                        key={sIdx}
                        p="sm"
                        radius="sm"
                        style={{
                          border: "1px solid #e2e8f0",
                          backgroundColor: "#ffffff",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                        }}
                      >
                        <Flex justify="space-between" align="center" mb={8} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                          <Group gap="xs" style={{ flex: 1 }}>
                            <Badge variant="light" color="indigo" size="sm" radius="xs">
                              第 {sIdx + 1} 阶段
                            </Badge>
                            {isEditingPath ? (
                              <TextInput
                                size="xs"
                                style={{ flex: 1, maxWidth: 280 }}
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
                            <Badge variant="outline" color="gray" size="xs" radius="xs">
                              约 {step.estimatedWords} 字
                            </Badge>
                          )}
                        </Flex>

                        {isEditingPath ? (
                          <Stack gap={6}>
                            <TextInput
                              label="本阶段解决缺口 / 目的"
                              size="xs"
                              value={step.purpose || ""}
                              onChange={(e) => {
                                const val = e.currentTarget.value;
                                handleUpdateCurrentPath((prev) => {
                                  const steps = [...prev.steps];
                                  steps[sIdx] = { ...steps[sIdx], purpose: val };
                                  return { ...prev, steps };
                                });
                              }}
                            />
                            <Textarea
                              label="剧情发生与互动经过"
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
                            <Group grow>
                              <TextInput
                                label="触发起因 (Cause)"
                                size="xs"
                                value={step.cause || ""}
                                onChange={(e) => {
                                  const val = e.currentTarget.value;
                                  handleUpdateCurrentPath((prev) => {
                                    const steps = [...prev.steps];
                                    steps[sIdx] = { ...steps[sIdx], cause: val };
                                    return { ...prev, steps };
                                  });
                                }}
                              />
                              <TextInput
                                label="阶段结果 (Result)"
                                size="xs"
                                value={step.result || ""}
                                onChange={(e) => {
                                  const val = e.currentTarget.value;
                                  handleUpdateCurrentPath((prev) => {
                                    const steps = [...prev.steps];
                                    steps[sIdx] = { ...steps[sIdx], result: val };
                                    return { ...prev, steps };
                                  });
                                }}
                              />
                            </Group>
                            <TextInput
                              label="转折变故（选填）"
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
                          <Stack gap={6}>
                            {step.purpose && (
                              <Text fz={12} c="#0369a1">
                                <span style={{ fontWeight: 600 }}>阶段目的：</span> {step.purpose}
                              </Text>
                            )}

                            {/* 因果链条卡片 */}
                            {(step.cause || step.action || step.result) && (
                              <Box p={6} style={{ backgroundColor: "#f8fafc", borderRadius: 4, border: "1px solid #f1f5f9" }}>
                                <Stack gap={3}>
                                  {step.cause && (
                                    <Text fz={12} c="#475569">
                                      <span style={{ fontWeight: 600, color: "#64748b" }}>起因：</span> {step.cause}
                                    </Text>
                                  )}
                                  {step.action && (
                                    <Text fz={12} c="#475569">
                                      <span style={{ fontWeight: 600, color: "#64748b" }}>行动：</span> {step.action}
                                    </Text>
                                  )}
                                  {step.result && (
                                    <Text fz={12} c="#475569">
                                      <span style={{ fontWeight: 600, color: "#64748b" }}>结果：</span> {step.result}
                                    </Text>
                                  )}
                                </Stack>
                              </Box>
                            )}

                            <Text fz={12} c="#334155" style={{ lineHeight: 1.6 }}>
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>发生经过：</span> {step.event || step.content}
                            </Text>

                            {step.characterDecision && (
                              <Text fz={12} c="#475569">
                                <span style={{ fontWeight: 600, color: "#334155" }}>决策动因：</span> {step.characterDecision}
                              </Text>
                            )}

                            {stateChanges.length > 0 && (
                              <Group gap={6} mt={2}>
                                <Text fz={11} fw={600} c="#64748b">
                                  状态变化:
                                </Text>
                                {stateChanges.map((sc, scIdx) => (
                                  <Badge key={scIdx} variant="outline" color="blue" size="xs" radius="xs">
                                    {sc}
                                  </Badge>
                                ))}
                              </Group>
                            )}

                            {step.nextCondition && (
                              <Text fz={12} c="#059669">
                                <span style={{ fontWeight: 600 }}>下一步前提：</span> {step.nextCondition}
                              </Text>
                            )}

                            {/* 仅在存在转折变故时显示 */}
                            {step.twist && step.twist.trim() && (
                              <Text fz={12} c="#c2410c">
                                <span style={{ fontWeight: 600 }}>转折变故：</span> {step.twist}
                              </Text>
                            )}

                            {/* 仅在存在伏笔时显示 */}
                            {step.suspense && step.suspense.trim() && (
                              <Text fz={12} c="#7c3aed">
                                <span style={{ fontWeight: 600 }}>伏笔线索：</span> {step.suspense}
                              </Text>
                            )}
                          </Stack>
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
