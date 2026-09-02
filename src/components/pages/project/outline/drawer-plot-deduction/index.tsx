// 组件：剧情推演抽屉（起终点转折推演、多分支推演卡片流、一键批量采纳写入大纲）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Drawer, Badge, ActionIcon, Stack, SimpleGrid, Paper, TextInput, Textarea, Select, SegmentedControl, LoadingOverlay, Group, ScrollArea, Tabs, Card } from "@mantine/core";
import { FiZap, FiPlus, FiArrowRight, FiCheck, FiCornerDownRight, FiBookmark, FiCopy, FiTrash2, FiClock, FiLayers } from "react-icons/fi";
import { OutlineNode, PlotDeductionPath, PlotDeductionRecord, deductPlot, getPlotDeductions, savePlotDeduction, deletePlotDeduction, batchCreateOutlineNodes } from "@/rest/outline";
import { CharacterItem, getCharacterList } from "@/rest/world";
import { createMemoryFragment } from "@/rest/chapter";

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
  const [activeTab, setActiveTab] = useState<string>("deduct");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [historyList, setHistoryList] = useState<PlotDeductionRecord[]>([]);

  const [startPoint, setStartPoint] = useState("");
  const [targetPoint, setTargetPoint] = useState("");
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [pacePreference, setPacePreference] = useState("standard");
  const [stepCount, setStepCount] = useState<number>(3);

  const [deductionPaths, setDeductionPaths] = useState<PlotDeductionPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [copiedPathId, setCopiedPathId] = useState<number | null>(null);

  useEffect(() => {
    if (opened && workId) {
      getCharacterList(workId).then((res) => {
        if (res && res.success && Array.isArray(res.result)) {
          setCharacters(res.result);
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
      alert("请输入或选择【起点剧情点】");
      return;
    }
    if (!targetPoint.trim()) {
      alert("请输入或选择【目标终点剧情】");
      return;
    }

    try {
      setLoading(true);
      setDeductionPaths([]);
      setSelectedPathId(null);

      const res = await deductPlot({
        workId,
        startPoint: startPoint.trim(),
        targetPoint: targetPoint.trim(),
        involvedCharacters: selectedChars.join(", "),
        pacePreference,
        stepCount,
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
          involvedCharacters: selectedChars.join(", "),
          pacePreference,
          stepCount,
          generatedPaths: res.result.paths,
        });
        fetchHistory();
      } else {
        alert("推演失败: " + (res?.message || "大模型未返回有效路径"));
      }
    } catch (e: any) {
      alert("推演异常: " + (e?.message || "网络错误"));
    } finally {
      setLoading(false);
    }
  };

  const handleAdoptPath = async (path: PlotDeductionPath) => {
    if (!workId) return;
    try {
      setAdopting(true);
      const newNodes = path.steps.map((step, idx) => ({
        id: crypto.randomUUID(),
        workId: Number(workId),
        title: step.title,
        content: step.content,
        goal: step.title,
        conflict: step.keyConflict || "",
        eventDescription: step.content,
        characters: step.characterAction || selectedChars.join(", ") || "",
        type: "scene",
        orderIndex: outlineNodes.length + idx,
      }));

      await batchCreateOutlineNodes({
        workId: Number(workId),
        nodes: newNodes,
        batch: true,
      });

      alert(`已成功将「${path.title}」的 ${newNodes.length} 个转折情节点批量插入大纲树！`);
      await onOutlineUpdated();
      onClose();
    } catch (e: any) {
      alert("采纳写入大纲失败: " + (e?.message || "网络异常"));
    } finally {
      setAdopting(false);
    }
  };

  const handleSaveToFragment = async (path: PlotDeductionPath) => {
    if (!workId) return;
    try {
      const fullText = `【推演方案：${path.title}】\n核心逻辑：${path.summary}\n\n` +
        path.steps.map((s, i) => `${i + 1}. ${s.title}\n${s.content}\n[冲突]: ${s.keyConflict || "无"}\n[动作]: ${s.characterAction || "无"}`).join("\n\n");

      await createMemoryFragment({
        workId,
        title: `剧情推演：${path.title}`,
        content: fullText,
        sourceType: "ai_chat",
        tags: "剧情推演 转折方案",
      });
      alert("已存为记忆碎片！可在章节写作区的灵感库中随时查阅。");
    } catch (e: any) {
      alert("存为碎片失败: " + (e?.message || "网络异常"));
    }
  };

  const handleCopyPath = (path: PlotDeductionPath) => {
    const fullText = `【推演方案：${path.title}】\n核心逻辑：${path.summary}\n\n` +
      path.steps.map((s, i) => `${i + 1}. ${s.title}\n${s.content}\n关键冲突: ${s.keyConflict || "无"}\n关键选择: ${s.characterAction || "无"}`).join("\n\n");

    navigator.clipboard.writeText(fullText);
    setCopiedPathId(path.id);
    setTimeout(() => setCopiedPathId(null), 2000);
  };

  const handleDeleteHistory = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除这条推演历史吗？")) {
      try {
        await deletePlotDeduction(id);
        setHistoryList((prev) => prev.filter((h) => h.id !== id));
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const nodeOptions = outlineNodes.map((n) => ({
    value: n.title,
    label: n.title,
  }));

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="80vw"
      title={
        <Group gap={8} align="center">
          <FiZap size={16} color="#0284c7" />
          <Text fw={700} fz={15} c="#0f172a">剧情推演工作台 (起终点转折桥梁模拟)</Text>
        </Group>
      }
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
        body: { height: "calc(100vh - 60px)", padding: "16px 20px", display: "flex", flexDirection: "column" },
      }}
    >
      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || "deduct")} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Tabs.List mb="md">
          <Tabs.Tab value="deduct" leftSection={<FiZap size={13} />}>
            智能推演
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<FiClock size={13} />}>
            推演历史 ({historyList.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="deduct" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box p="12px 16px" bg="#fafbfc" style={{ border: "1px solid #f1f5f9", borderRadius: 6 }} mb="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="sm">
              <Box>
                <Flex justify="space-between" align="center" mb={4}>
                  <Text fz={12} fw={600} c="#0284c7">【起点剧情】当前情节点</Text>
                  {nodeOptions.length > 0 && (
                    <Select
                      placeholder="从大纲中快速点选"
                      size="xs"
                      data={nodeOptions}
                      onChange={(val) => val && setStartPoint(val)}
                      styles={{ input: { fontSize: 11, height: 24, padding: "0 6px" } }}
                    />
                  )}
                </Flex>
                <TextInput
                  placeholder="例如：主角在宗门大比遭陷害被废，流放边荒矿脉..."
                  size="xs"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                />
              </Box>

              <Box>
                <Flex justify="space-between" align="center" mb={4}>
                  <Text fz={12} fw={600} c="#0891b2">【目标终点】期望达成的剧情</Text>
                  {nodeOptions.length > 0 && (
                    <Select
                      placeholder="从大纲中快速点选"
                      size="xs"
                      data={nodeOptions}
                      onChange={(val) => val && setTargetPoint(val)}
                      styles={{ input: { fontSize: 11, height: 24, padding: "0 6px" } }}
                    />
                  )}
                </Flex>
                <TextInput
                  placeholder="例如：三年后主角以魔道巨擘身份携无上圣物重临帝都大比..."
                  size="xs"
                  value={targetPoint}
                  onChange={(e) => setTargetPoint(e.target.value)}
                />
              </Box>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Box>
                <Text fz={11.5} fw={600} c="#64748b" mb={3}>参演关键角色</Text>
                <Group gap={4} wrap="wrap">
                  {characters.slice(0, 6).map((c) => {
                    const isChecked = selectedChars.includes(c.name);
                    return (
                      <Badge
                        key={c.id}
                        size="xs"
                        variant={isChecked ? "filled" : "outline"}
                        color={isChecked ? "cyan" : "gray"}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setSelectedChars((prev) =>
                            prev.includes(c.name) ? prev.filter((n) => n !== c.name) : [...prev, c.name]
                          );
                        }}
                      >
                        {c.name}
                      </Badge>
                    );
                  })}
                  {characters.length === 0 && <Text fz={11} c="#94a3b8">暂无预设角色</Text>}
                </Group>
              </Box>

              <Box>
                <Text fz={11.5} fw={600} c="#64748b" mb={3}>转折演进偏好</Text>
                <SegmentedControl
                  size="xs"
                  value={pacePreference}
                  onChange={setPacePreference}
                  data={[
                    { label: "稳健因果", value: "standard" },
                    { label: "惊天逆转", value: "twist" },
                    { label: "极限突破", value: "dark" },
                  ]}
                />
              </Box>

              <Box>
                <Flex justify="space-between" align="center">
                  <Box>
                    <Text fz={11.5} fw={600} c="#64748b" mb={3}>过渡步数</Text>
                    <SegmentedControl
                      size="xs"
                      value={String(stepCount)}
                      onChange={(v) => setStepCount(Number(v))}
                      data={[
                        { label: "2步", value: "2" },
                        { label: "3步", value: "3" },
                        { label: "4步", value: "4" },
                        { label: "5步", value: "5" },
                      ]}
                    />
                  </Box>
                  <Button
                    size="xs"
                    color="cyan"
                    leftSection={<FiZap size={13} />}
                    loading={loading}
                    onClick={handleStartDeduction}
                    style={{ alignSelf: "flex-end", height: 28 }}
                  >
                    开始智能推演
                  </Button>
                </Flex>
              </Box>
            </SimpleGrid>
          </Box>

          <Box pos="relative" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <LoadingOverlay visible={loading} />

            {deductionPaths.length === 0 && !loading ? (
              <Stack align="center" justify="center" p={60} c="#94a3b8" gap={6} style={{ flex: 1 }}>
                <FiZap size={36} strokeWidth={1.2} />
                <Text fz={14} fw={600}>设定起点与终点，让 AI 智能推演中间转折</Text>
                <Text fz={12}>AI 将结合世界观规则、人物动机与素材库，自动推演出 3 套逻辑自洽的演进路径</Text>
              </Stack>
            ) : (
              <ScrollArea style={{ flex: 1 }}>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm" pb="md">
                  {deductionPaths.map((path) => (
                    <Card
                      key={path.id}
                      p="12px 14px"
                      radius="sm"
                      withBorder
                      bg="#ffffff"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        borderColor: selectedPathId === path.id ? "#7dd3fc" : "#f1f5f9",
                        backgroundColor: selectedPathId === path.id ? "#f0f9ff" : "#ffffff",
                      }}
                      onClick={() => setSelectedPathId(path.id)}
                    >
                      <Flex justify="space-between" align="center" mb={6}>
                        <Group gap={6}>
                          <Badge size="xs" color="cyan" variant="filled">
                            {path.style}
                          </Badge>
                          <Text fz={13.5} fw={700} c="#1e293b">
                            {path.title}
                          </Text>
                        </Group>
                      </Flex>

                      <Text fz={11.5} c="#0369a1" mb="xs" style={{ lineHeight: 1.5 }}>
                        {path.summary}
                      </Text>

                      <Stack gap={6} style={{ flex: 1 }} mb="sm">
                        {path.steps.map((step, sIdx) => (
                          <Box key={sIdx} p="6px 8px" bg="#ffffff" style={{ border: "1px solid #e2e8f0", borderRadius: 4 }}>
                            <Group gap={4} mb={2}>
                              <FiCornerDownRight size={10} color="#0284c7" />
                              <Text fz={11.5} fw={700} c="#1e293b">
                                第 {sIdx + 1} 步：{step.title}
                              </Text>
                            </Group>
                            <Text fz={11} c="#475569" style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }} mb={3}>
                              {step.content}
                            </Text>
                            {step.keyConflict && (
                              <Text fz={10.5} c="#dc2626">
                                ● 矛盾冲突：{step.keyConflict}
                              </Text>
                            )}
                            {step.characterAction && (
                              <Text fz={10.5} c="#0891b2">
                                ● 破局动作：{step.characterAction}
                              </Text>
                            )}
                          </Box>
                        ))}
                      </Stack>

                      <Flex justify="space-between" align="center" pt={8} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <Group gap={4}>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color={copiedPathId === path.id ? "teal" : "gray"}
                            onClick={(e) => { e.stopPropagation(); handleCopyPath(path); }}
                          >
                            {copiedPathId === path.id ? <FiCheck size={11} /> : <FiCopy size={11} />}
                          </ActionIcon>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            leftSection={<FiBookmark size={10} />}
                            onClick={(e) => { e.stopPropagation(); handleSaveToFragment(path); }}
                          >
                            存碎片
                          </Button>
                        </Group>

                        <Button
                          size="compact-xs"
                          color="cyan"
                          leftSection={<FiPlus size={10} />}
                          loading={adopting}
                          onClick={(e) => { e.stopPropagation(); handleAdoptPath(path); }}
                        >
                          采纳写入大纲
                        </Button>
                      </Flex>
                    </Card>
                  ))}
                </SimpleGrid>
              </ScrollArea>
            )}
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="history" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <ScrollArea style={{ flex: 1 }}>
            <Stack gap="sm">
              {historyList.map((hist) => (
                <Paper key={hist.id} p="md" withBorder radius="sm" bg="#ffffff" style={{ borderColor: "#f1f5f9" }}>
                  <Flex justify="space-between" align="center" mb={6}>
                    <Group gap={8}>
                      <Badge size="xs" color="cyan">{hist.pacePreference || "标准"}</Badge>
                      <Text fz={13} fw={700} c="#1e293b">
                        {hist.startPoint} <FiArrowRight size={11} style={{ verticalAlign: "middle" }} /> {hist.targetPoint}
                      </Text>
                    </Group>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => handleDeleteHistory(hist.id, e)}>
                      <FiTrash2 size={12} />
                    </ActionIcon>
                  </Flex>

                  {Array.isArray(hist.generatedPaths) && hist.generatedPaths.length > 0 && (
                    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs" mt="xs">
                      {hist.generatedPaths.map((p) => (
                        <Box key={p.id} p="8px" bg="#fafbfc" style={{ border: "1px solid #f1f5f9", borderRadius: 4 }}>
                          <Text fz={12} fw={700} c="#0284c7" mb={2}>{p.title}</Text>
                          <Text fz={11} c="#64748b" lineClamp={2} mb={4}>{p.summary}</Text>
                          <Button size="compact-xs" variant="light" color="cyan" onClick={() => handleAdoptPath(p)}>
                            重新采纳此方案
                          </Button>
                        </Box>
                      ))}
                    </SimpleGrid>
                  )}
                </Paper>
              ))}

              {historyList.length === 0 && (
                <Text fz={13} c="#94a3b8" ta="center" py={40}>
                  暂无推演历史记录
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
}
