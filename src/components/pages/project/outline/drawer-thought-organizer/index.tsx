// 组件：AI 思路整理抽屉（支持时空与因果逻辑重构、生成带 title 的一级主纲数据、采纳前全面可视化编辑、替换更新原数据、宽度 55vw）
"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Stack,
  Text,
  Button,
  Group,
  ActionIcon,
  Textarea,
  TextInput,
  Paper,
  Box,
  Badge,
  MultiSelect,
  Flex,
  Tooltip,
} from "@mantine/core";
import {
  FiPlus,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiCheck,
  FiUser,
  FiFileText,
  FiCpu,
  FiCornerDownRight,
  FiEdit2,
} from "react-icons/fi";
import {
  organizeOutlineThoughts,
  batchCreateOutlineNodes,
  updateOutlineNode,
  OrganizedTreeNode,
} from "@/rest/outline";
import { CharacterItem, getCharacterList } from "@/rest/world";
import { NoteData, NoteListResult, getNoteList } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";

interface DrawerThoughtOrganizerProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  onOutlineUpdated: () => Promise<void>;
  existingNodeId?: number | string | null;
  initialTitle?: string;
  initialSummary?: string;
}

export default function DrawerThoughtOrganizer({
  opened,
  onClose,
  workId,
  onOutlineUpdated,
  existingNodeId,
  initialTitle,
  initialSummary,
}: DrawerThoughtOrganizerProps) {
  const [loading, setLoading] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);

  // 动态灵感碎片列表
  const [thoughts, setThoughts] = useState<string[]>([
    "主角在建材展厅被当面泼咖啡羞辱",
    "拿出二十年前白手起家的原始专利图纸反击",
    "对手动用商会人脉联合施压试图封杀",
    "商会晚宴公开揭秘白手起家奋斗史，彻底打脸对手",
  ]);

  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // AI 整理结果（包含一级节点标题、总括、时空信息与树状子节点）
  const [organizedResult, setOrganizedResult] = useState<{
    title: string;
    summary: string;
    timeframe?: string;
    location?: string;
    tree: OrganizedTreeNode[];
  } | null>(null);

  const [isEditingResult, setIsEditingResult] = useState(false);

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

  const handleAddThought = () => {
    setThoughts((prev) => [...prev, ""]);
  };

  const handleUpdateThought = (index: number, val: string) => {
    setThoughts((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleDeleteThought = (index: number) => {
    if (thoughts.length <= 1) {
      useAlert.warning("至少保留一个灵感输入框");
      return;
    }
    setThoughts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveThought = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= thoughts.length) return;
    setThoughts((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleStartOrganize = async () => {
    const validThoughts = thoughts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (validThoughts.length === 0) {
      useAlert.warning("请至少输入一个灵感或剧情点");
      return;
    }

    try {
      setLoading(true);
      setOrganizedResult(null);
      setIsEditingResult(false);

      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      const res = await organizeOutlineThoughts({
        workId: Number(workId),
        thoughts: validThoughts,
        selectedCharacterIds: charIdsNum,
        selectedNoteIds: noteIdsNum,
      });

      if (res && res.success && res.result) {
        setOrganizedResult({
          title: res.result.title || `思路整理：${validThoughts[0].slice(0, 16)}`,
          summary: res.result.summary || "",
          timeframe: res.result.timeframe || "近期阶段",
          location: res.result.location || "主发生地",
          tree: Array.isArray(res.result.tree) ? res.result.tree : [],
        });
      } else {
        useAlert.error("整理失败: " + (res?.message || "大模型未返回结果"));
      }
    } catch (e: any) {
      useAlert.error("整理异常: " + (e?.message || "网络错误"));
    } finally {
      setLoading(false);
    }
  };

  // 采纳并写入大纲（每整理一次，保存为 1 条一级主纲节点，其下属各阶段为二级子节点；若为编辑模式则替换原数据）
  const handleAdoptTree = async () => {
    if (!organizedResult) return;
    try {
      setAdopting(true);
      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      // 组装二级子节点
      const childPayload = (organizedResult.tree || []).map((pNode, pIdx) => ({
        workId: Number(workId),
        category: "memo",
        level: 2,
        title: pNode.title || `阶段 ${pIdx + 1}`,
        summary: pNode.content || "",
        content: pNode.content || "",
        event: pNode.content || "",
        timeframe: pNode.timeframe || "",
        location: pNode.location || "",
        remarks: pNode.timeframe ? `时间: ${pNode.timeframe} | 地点: ${pNode.location || "待定"}` : "",
        wordCountEstimate: 2500,
        linkedCharacterIds: charIdsNum,
        linkedNoteIds: noteIdsNum,
        type: "scene",
        status: "planned",
        orderIndex: pIdx,
        children: Array.isArray(pNode.children)
          ? pNode.children.map((cNode, cIdx) => ({
              workId: Number(workId),
              category: "memo",
              level: 3,
              title: cNode.title || `细节 ${cIdx + 1}`,
              content: cNode.content || "",
              event: cNode.content || "",
              timeframe: cNode.timeframe || "",
              location: cNode.location || "",
              type: "scene",
              status: "planned",
              orderIndex: cIdx,
            }))
          : [],
      }));

      // 一级主节点 payload
      const level1Payload = {
        workId: Number(workId),
        category: "memo" as const,
        level: 1,
        title: (organizedResult.title || "未命名思路整理").trim(),
        summary: organizedResult.summary?.trim() || "",
        content: organizedResult.summary?.trim() || "",
        event: organizedResult.summary?.trim() || "",
        timeframe: organizedResult.timeframe || "",
        location: organizedResult.location || "",
        wordCountEstimate: 5000,
        linkedCharacterIds: charIdsNum,
        linkedNoteIds: noteIdsNum,
        type: "volume" as const,
        status: "planned" as const,
        children: childPayload,
      };

      if (existingNodeId) {
        // 编辑模式：原地替换原数据
        await updateOutlineNode({
          id: existingNodeId,
          ...level1Payload,
          replaceChildren: true,
          children: childPayload,
        });
        useAlert.success("已成功保存并替换原思路大纲数据！");
      } else {
        // 新建模式：批量写入一级与二级节点
        await batchCreateOutlineNodes({
          workId: Number(workId),
          nodes: [level1Payload],
          batch: true,
        });
        useAlert.success("已成功将思路整理写入大纲（一级主纲+下属阶段）！");
      }

      await onOutlineUpdated();
      onClose();
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
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

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <FiCpu size={18} color="#0284c7" />
          <Text fw={700} fz={17} c="#0f172a">
            AI 思路整理 (时空与因果逻辑重构)
          </Text>
        </Group>
      }
      position="right"
      size="55vw"
    >
      <Stack gap="md" pb="xl">
        <Text fz={13} c="dimmed">
          输入脑海中的零散剧情点或突发灵感。AI 将从<b>时间推进、空间转换、人物动机</b>等维度，重构成带有<b>独立一级标题与下属各阶段</b>的完整大纲数据。采纳前可自由二次编辑。
        </Text>

        {/* 动态灵感文本框列表 */}
        <Paper p="md" withBorder radius="md" bg="gray.0">
          <Flex justify="space-between" align="center" mb="xs">
            <Text fz={14} fw={700} c="#0f172a">
              灵感与剧情点碎片（共 {thoughts.length} 条）
            </Text>
            <Button
              variant="default"
              leftSection={<FiPlus size={14} />}
              onClick={handleAddThought}
            >
              添加一条灵感
            </Button>
          </Flex>

          <Stack gap="xs">
            {thoughts.map((thought, idx) => (
              <Paper key={idx} p="xs" withBorder radius="sm" bg="#ffffff">
                <Flex align="flex-start" gap="xs">
                  <Badge size="sm" variant="light" color="blue" mt={6}>
                    {idx + 1}
                  </Badge>

                  <Textarea
                    placeholder={`输入第 ${idx + 1} 个灵感碎片或情节动作...`}
                    autosize
                    minRows={1}
                    maxRows={4}
                    value={thought}
                    onChange={(e) => handleUpdateThought(idx, e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />

                  <Group gap={4} mt={4}>
                    <Tooltip label="上移">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        disabled={idx === 0}
                        onClick={() => handleMoveThought(idx, "up")}
                      >
                        <FiArrowUp size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="下移">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        disabled={idx === thoughts.length - 1}
                        onClick={() => handleMoveThought(idx, "down")}
                      >
                        <FiArrowDown size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteThought(idx)}
                      >
                        <FiTrash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Flex>
              </Paper>
            ))}
          </Stack>

          <Group grow mt="sm">
            <MultiSelect
              label="关联参演角色"
              placeholder="选择角色..."
              data={charOptions}
              value={selectedCharIds}
              onChange={setSelectedCharIds}
              searchable
              clearable
              leftSection={<FiUser size={15} />}
            />
            <MultiSelect
              label="关联参考设定/笔记"
              placeholder="选择笔记..."
              data={noteOptions}
              value={selectedNoteIds}
              onChange={setSelectedNoteIds}
              searchable
              clearable
              leftSection={<FiFileText size={15} />}
            />
          </Group>

          <Button
            variant="filled"
            color="blue"
            fullWidth
            mt="md"
            leftSection={<FiCpu size={15} />}
            onClick={handleStartOrganize}
            loading={loading}
          >
            开始 AI 思路整理 (生成完整一级大纲实体)
          </Button>
        </Paper>

        {/* 整理后的树状大纲预览与采纳区 */}
        {organizedResult && (
          <Paper p="md" withBorder radius="md" bg="#ffffff" style={{ border: "2px solid #38bdf8" }}>
            <Flex justify="space-between" align="center" mb="md" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Badge variant="filled" color="blue">
                  一级主纲实体
                </Badge>
                <Text fw={700} fz={16} c="#0f172a">
                  整理结果预览（支持编辑修改）
                </Text>
              </Group>

              <Group gap="xs">
                <Button
                  variant={isEditingResult ? "filled" : "light"}
                  color="indigo"
                  leftSection={<FiEdit2 size={14} />}
                  onClick={() => setIsEditingResult((v) => !v)}
                >
                  {isEditingResult ? "完成编辑" : "直接编辑内容"}
                </Button>

                <Button
                  variant="filled"
                  color="teal"
                  leftSection={<FiCheck size={14} />}
                  loading={adopting}
                  onClick={handleAdoptTree}
                >
                  {existingNodeId ? "保存并替换原数据" : "一键采纳写入大纲"}
                </Button>
              </Group>
            </Flex>

            {/* 一级主纲标题与总括信息 */}
            <Paper p="md" withBorder radius="md" bg="blue.0" mb="md">
              <Stack gap="xs">
                {isEditingResult ? (
                  <>
                    <TextInput
                      label="一级主纲标题 (Title)"
                      value={organizedResult.title}
                      onChange={(e) => {
                        const val = e.currentTarget.value;
                        setOrganizedResult((prev) => (prev ? { ...prev, title: val } : null));
                      }}
                      placeholder="输入本次思路整理的总体标题"
                    />
                    <Textarea
                      label="整体脉络总括 (Summary)"
                      autosize
                      minRows={2}
                      value={organizedResult.summary}
                      onChange={(e) => {
                        const val = e.currentTarget.value;
                        setOrganizedResult((prev) => (prev ? { ...prev, summary: val } : null));
                      }}
                      placeholder="核心脉络概述"
                    />
                    <Group grow>
                      <TextInput
                        label="全局时空跨度"
                        value={organizedResult.timeframe || ""}
                        onChange={(e) => {
                          const val = e.currentTarget.value;
                          setOrganizedResult((prev) => (prev ? { ...prev, timeframe: val } : null));
                        }}
                      />
                      <TextInput
                        label="主要舞台场景"
                        value={organizedResult.location || ""}
                        onChange={(e) => {
                          const val = e.currentTarget.value;
                          setOrganizedResult((prev) => (prev ? { ...prev, location: val } : null));
                        }}
                      />
                    </Group>
                  </>
                ) : (
                  <>
                    <Group justify="space-between" align="center">
                      <Text fz={16} fw={700} c="#0f172a">
                        📑 标题：{organizedResult.title}
                      </Text>
                      <Group gap="xs">
                        {organizedResult.timeframe && (
                          <Badge variant="outline" color="blue">
                            时间：{organizedResult.timeframe}
                          </Badge>
                        )}
                        {organizedResult.location && (
                          <Badge variant="outline" color="teal">
                            地点：{organizedResult.location}
                          </Badge>
                        )}
                      </Group>
                    </Group>
                    <Text fz={13} c="#334155" style={{ lineHeight: 1.6 }}>
                      <b>整体总述：</b> {organizedResult.summary}
                    </Text>
                  </>
                )}
              </Stack>
            </Paper>

            {/* 下属二级阶段列表 */}
            <Stack gap="sm">
              <Text fz={14} fw={700} c="#0f172a">
                下属拆解阶段与情节点（共 {organizedResult.tree.length} 个阶段）：
              </Text>

              {organizedResult.tree.map((stage, pIdx) => (
                <Paper key={pIdx} p="sm" withBorder radius="md" bg="gray.0">
                  {isEditingResult ? (
                    <Stack gap="xs">
                      <Group grow>
                        <TextInput
                          label={`阶段 ${pIdx + 1} 标题`}
                          value={stage.title}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            setOrganizedResult((prev) => {
                              if (!prev) return null;
                              const tree = [...prev.tree];
                              tree[pIdx] = { ...tree[pIdx], title: val };
                              return { ...prev, tree };
                            });
                          }}
                        />
                        <TextInput
                          label="时间线与地点"
                          value={`${stage.timeframe || ""} | ${stage.location || ""}`}
                          onChange={(e) => {
                            const [tf, loc] = e.currentTarget.value.split("|");
                            setOrganizedResult((prev) => {
                              if (!prev) return null;
                              const tree = [...prev.tree];
                              tree[pIdx] = {
                                ...tree[pIdx],
                                timeframe: tf?.trim(),
                                location: loc?.trim(),
                              };
                              return { ...prev, tree };
                            });
                          }}
                        />
                      </Group>
                      <Textarea
                        label="核心情节说明"
                        autosize
                        minRows={2}
                        value={stage.content}
                        onChange={(e) => {
                          const val = e.currentTarget.value;
                          setOrganizedResult((prev) => {
                            if (!prev) return null;
                            const tree = [...prev.tree];
                            tree[pIdx] = { ...tree[pIdx], content: val };
                            return { ...prev, tree };
                          });
                        }}
                      />
                    </Stack>
                  ) : (
                    <>
                      <Flex justify="space-between" align="center" mb={4}>
                        <Group gap="xs">
                          <Badge variant="filled" color="indigo" size="sm">
                            第 {pIdx + 1} 阶段
                          </Badge>
                          <Text fz={14} fw={700} c="#0f172a">
                            {stage.title}
                          </Text>
                        </Group>
                        {(stage.timeframe || stage.location) && (
                          <Badge variant="outline" color="gray" size="xs">
                            {stage.timeframe} {stage.location ? `· ${stage.location}` : ""}
                          </Badge>
                        )}
                      </Flex>

                      <Text fz={13} c="#334155" mb="xs" style={{ lineHeight: 1.6 }}>
                        {stage.content}
                      </Text>
                    </>
                  )}

                  {/* 细节子项 */}
                  {Array.isArray(stage.children) && stage.children.length > 0 && (
                    <Stack gap="xs" pl="md" mt="xs" style={{ borderLeft: "2px solid #cbd5e1" }}>
                      {stage.children.map((child, cIdx) => (
                        <Paper key={cIdx} p="xs" withBorder radius="sm" bg="#ffffff">
                          <Flex align="center" gap={6} mb={2}>
                            <FiCornerDownRight size={13} color="#0284c7" />
                            <Text fz={13} fw={700} c="#0f172a">
                              {child.title}
                            </Text>
                            {child.timeframe && (
                              <Badge size="xs" variant="light" color="blue">
                                {child.timeframe}
                              </Badge>
                            )}
                          </Flex>
                          <Text fz={12} c="#475569" pl={18}>
                            {child.content}
                          </Text>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Drawer>
  );
}
