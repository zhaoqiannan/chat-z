// 组件：大纲编辑/创建弹窗（宽度 55vw，支持一级主纲与整组子情节联动编辑替换原数据，无 xs 按钮）
"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  MultiSelect,
  Paper,
  Box,
  Flex,
  ActionIcon,
} from "@mantine/core";
import {
  FiSave,
  FiUser,
  FiFileText,
  FiBookOpen,
  FiZap,
  FiEdit3,
  FiPlus,
  FiTrash2,
  FiCornerDownRight,
} from "react-icons/fi";
import { OutlineNode, CreateOutlinePayload, UpdateOutlinePayload } from "@/rest/outline";
import { CharacterItem, getCharacterList } from "@/rest/world";
import { NoteData, NoteListResult, getNoteList } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";

interface ModalNodeEditorProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  category: "chapter" | "deduction" | "memo";
  editingNode: OutlineNode | null;
  onSaved: () => Promise<void>;
  onSubmitCreate: (data: CreateOutlinePayload) => Promise<any>;
  onSubmitUpdate: (data: UpdateOutlinePayload) => Promise<any>;
}

export default function ModalNodeEditor({
  opened,
  onClose,
  workId,
  category,
  editingNode,
  onSaved,
  onSubmitCreate,
  onSubmitUpdate,
}: ModalNodeEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);

  // 表单字段
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [location, setLocation] = useState("");
  const [chapterNumber, setChapterNumber] = useState<number | string>("");
  const [twist, setTwist] = useState("");
  const [nextGoal, setNextGoal] = useState("");
  const [suspense, setSuspense] = useState("");
  const [wordCountEstimate, setWordCountEstimate] = useState<number>(3000);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // 子情节列表（若编辑的是一级节点）
  const [subScenes, setSubScenes] = useState<
    { id?: number | string; title: string; content: string; timeframe?: string; location?: string }[]
  >([]);

  // 剧情推演专属字段
  const [deductionOrigin, setDeductionOrigin] = useState("");
  const [deductionPremise, setDeductionPremise] = useState("");
  const [deductionTarget, setDeductionTarget] = useState("");
  const [deductionStepIndex, setDeductionStepIndex] = useState<number | string>(1);

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

      if (editingNode) {
        setTitle(editingNode.title || "");
        setSummary(editingNode.summary || "");
        setContent(editingNode.content || editingNode.event || "");
        setTimeframe(editingNode.timeframe || "");
        setLocation(editingNode.location || "");
        setChapterNumber(editingNode.chapterNumber ?? "");
        setTwist(editingNode.twist || "");
        setNextGoal(editingNode.nextGoal || "");
        setSuspense(editingNode.suspense || "");
        setWordCountEstimate(editingNode.wordCountEstimate || 3000);
        setDeductionOrigin(editingNode.deductionOrigin || "");
        setDeductionPremise(editingNode.deductionPremise || "");
        setDeductionTarget(editingNode.deductionTarget || "");
        setDeductionStepIndex(editingNode.deductionStepIndex ?? 1);
        setSelectedCharIds(
          Array.isArray(editingNode.linkedCharacterIds)
            ? editingNode.linkedCharacterIds.map(String)
            : []
        );
        setSelectedNoteIds(
          Array.isArray(editingNode.linkedNoteIds)
            ? editingNode.linkedNoteIds.map(String)
            : []
        );

        if (Array.isArray(editingNode.children) && editingNode.children.length > 0) {
          setSubScenes(
            editingNode.children.map((c) => ({
              id: c.id,
              title: c.title || "",
              content: c.content || c.event || "",
              timeframe: c.timeframe || "",
              location: c.location || "",
            }))
          );
        } else {
          setSubScenes([]);
        }
      } else {
        setTitle("");
        setSummary("");
        setContent("");
        setTimeframe("");
        setLocation("");
        setChapterNumber("");
        setTwist("");
        setNextGoal("");
        setSuspense("");
        setWordCountEstimate(3000);
        setDeductionOrigin("");
        setDeductionPremise("");
        setDeductionTarget("");
        setDeductionStepIndex(1);
        setSelectedCharIds([]);
        setSelectedNoteIds([]);
        setSubScenes([]);
      }
    }
  }, [opened, workId, editingNode, category]);

  const handleAddSubScene = () => {
    setSubScenes((prev) => [
      ...prev,
      {
        title: `子情节点 ${prev.length + 1}`,
        content: "",
        timeframe: "",
        location: "",
      },
    ]);
  };

  const handleUpdateSubScene = (
    index: number,
    field: "title" | "content" | "timeframe" | "location",
    value: string
  ) => {
    setSubScenes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleDeleteSubScene = (index: number) => {
    setSubScenes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      useAlert.warning("请输入标题");
      return;
    }

    try {
      setSubmitting(true);
      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      const payload: any = {
        category,
        title: title.trim(),
        summary: summary.trim() || null,
        content: content.trim() || summary.trim() || "",
        event: content.trim() || summary.trim() || "",
        timeframe: timeframe.trim() || null,
        location: location.trim() || null,
        twist: twist.trim(),
        nextGoal: nextGoal.trim(),
        suspense: suspense.trim(),
        wordCountEstimate: Number(wordCountEstimate) || 3000,
        linkedCharacterIds: charIdsNum,
        linkedNoteIds: noteIdsNum,
      };

      if (category === "chapter") {
        if (chapterNumber !== "") {
          payload.chapterNumber = Number(chapterNumber);
        }
      } else if (category === "deduction") {
        payload.deductionOrigin = deductionOrigin.trim();
        payload.deductionPremise = deductionPremise.trim();
        payload.deductionTarget = deductionTarget.trim();
        payload.deductionStepIndex = Number(deductionStepIndex) || 1;
      }

      if (editingNode) {
        // 如果原本包含子情节或者添加了子情节，则开启 replaceChildren 原子替换原数据
        const hasChildrenToSync =
          subScenes.length > 0 ||
          (Array.isArray(editingNode.children) && editingNode.children.length > 0);

        if (hasChildrenToSync) {
          payload.replaceChildren = true;
          payload.children = subScenes.map((s, idx) => ({
            title: s.title.trim(),
            content: s.content.trim(),
            event: s.content.trim(),
            timeframe: s.timeframe?.trim() || null,
            location: s.location?.trim() || null,
            level: 2,
            type: "scene",
            status: "planned",
            orderIndex: idx,
            linkedCharacterIds: charIdsNum,
            linkedNoteIds: noteIdsNum,
          }));
        }

        await onSubmitUpdate({
          id: editingNode.id,
          ...payload,
        });
        useAlert.success("大纲及下属情节更新成功（已替换原数据）！");
      } else {
        await onSubmitCreate({
          workId: Number(workId),
          ...payload,
          level: 1,
          type: subScenes.length > 0 ? "volume" : "scene",
          status: "planned",
          children: subScenes.map((s, idx) => ({
            title: s.title.trim(),
            content: s.content.trim(),
            event: s.content.trim(),
            timeframe: s.timeframe?.trim() || null,
            location: s.location?.trim() || null,
            level: 2,
            type: "scene",
            status: "planned",
            orderIndex: idx,
            linkedCharacterIds: charIdsNum,
            linkedNoteIds: noteIdsNum,
          })),
        });
        useAlert.success("已添加大纲条目");
      }

      await onSaved();
      onClose();
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSubmitting(false);
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

  const categoryConfig = {
    chapter: {
      title: editingNode ? "编辑章节大纲" : "新建章节大纲",
      badge: "📖 章节大纲",
      color: "teal",
      titlePlaceholder: "例如：第一卷 · 建材对峙与专利反击",
      contentLabel: "章节核心剧情脉络 / 正文梗概",
      contentPlaceholder: "清晰写明本章节发生的主要事件经过、人物行为与发展结局...",
    },
    deduction: {
      title: editingNode ? "编辑推演方案" : "新建推演节点",
      badge: "🔮 剧情推演",
      color: "blue",
      titlePlaceholder: "例如：推演：暗中搜集证据➔打破商会僵局",
      contentLabel: "推演方案整体逻辑说明",
      contentPlaceholder: "概括本推演方案的递进思路与关键突破口...",
    },
    memo: {
      title: editingNode ? "编辑思路卡片" : "新建随手卡片",
      badge: "💡 随手灵感 / 思路整理",
      color: "gray",
      titlePlaceholder: "例如：思路整理：商会晚宴逆袭与专利反制",
      contentLabel: "思路总述 / 灵感经过",
      contentPlaceholder: "记录当前阶段的宏观脉络或突发点子...",
    },
  }[category];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Badge color={categoryConfig.color} variant="light">
            {categoryConfig.badge}
          </Badge>
          <Text fw={700} fz={17}>
            {categoryConfig.title}
          </Text>
        </Group>
      }
      size="55vw"
    >
      <Stack gap="md" pb="xs">
        {/* 一级主纲标题 */}
        <TextInput
          label="大纲标题"
          placeholder={categoryConfig.titlePlaceholder}
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />

        {/* 宏观总述 Summary */}
        <Textarea
          label="整体总括 (Summary / 核心梗概)"
          placeholder="说明该一级节点的核心脉络或全局概要..."
          autosize
          minRows={2}
          maxRows={4}
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
        />

        {/* 时空维度 */}
        <Group grow>
          <TextInput
            label="时间线 (Timeframe)"
            placeholder="例如：前三天 / 商会晚宴当晚"
            value={timeframe}
            onChange={(e) => setTimeframe(e.currentTarget.value)}
          />
          <TextInput
            label="地点场景 (Location)"
            placeholder="例如：建材展厅 / 拍卖行"
            value={location}
            onChange={(e) => setLocation(e.currentTarget.value)}
          />
        </Group>

        {category === "chapter" && (
          <NumberInput
            label="章节序号（选填）"
            placeholder="例如：1、2、3"
            value={chapterNumber}
            onChange={setChapterNumber}
            min={1}
          />
        )}

        {category === "deduction" && (
          <Paper p="sm" withBorder radius="md" bg="gray.0">
            <Stack gap="xs">
              <TextInput
                label="起点剧情 A"
                placeholder="现状或起始情节"
                value={deductionPremise}
                onChange={(e) => setDeductionPremise(e.currentTarget.value)}
              />
              <TextInput
                label="终点剧情 B"
                placeholder="预期达到的结果"
                value={deductionTarget}
                onChange={(e) => setDeductionTarget(e.currentTarget.value)}
              />
            </Stack>
          </Paper>
        )}

        {/* 核心内容叙述 */}
        <Textarea
          label={categoryConfig.contentLabel}
          placeholder={categoryConfig.contentPlaceholder}
          autosize
          minRows={3}
          maxRows={6}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
        />

        {/* 转折冲突与下一步目标 */}
        <Group grow>
          <TextInput
            label="核心转折 / 冲突阻碍"
            placeholder="遭遇的变故或对手阻挠"
            value={twist}
            onChange={(e) => setTwist(e.currentTarget.value)}
          />
          <TextInput
            label="下一步行动目标"
            placeholder="主角接下来的意图"
            value={nextGoal}
            onChange={(e) => setNextGoal(e.currentTarget.value)}
          />
        </Group>

        <TextInput
          label="伏笔悬念 (选填)"
          placeholder="留下的未解谜团或关键线索"
          value={suspense}
          onChange={(e) => setSuspense(e.currentTarget.value)}
        />

        {/* 下属子情节点列表管理（支持直接编辑整组并替换原数据） */}
        <Paper p="sm" withBorder radius="md" bg="gray.0">
          <Flex justify="space-between" align="center" mb="xs">
            <Text fz={14} fw={700} c="#0f172a">
              下属细分情节点（共 {subScenes.length} 个）
            </Text>
            <Button
              variant="default"
              leftSection={<FiPlus size={14} />}
              onClick={handleAddSubScene}
            >
              添加子情节
            </Button>
          </Flex>

          {subScenes.length === 0 ? (
            <Text fz={12} c="dimmed">
              暂无下属子情节点。如需将该节点作为一级容器，可点击右上角添加子情节。
            </Text>
          ) : (
            <Stack gap="xs">
              {subScenes.map((sub, idx) => (
                <Paper key={idx} p="xs" withBorder radius="sm" bg="#ffffff">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Group gap="xs" style={{ flex: 1 }}>
                      <Badge variant="light" color="blue" size="sm">
                        {idx + 1}
                      </Badge>
                      <TextInput
                        placeholder="子情节标题"
                        style={{ flex: 1, maxWidth: 220 }}
                        value={sub.title}
                        onChange={(e) => handleUpdateSubScene(idx, "title", e.currentTarget.value)}
                      />
                      <TextInput
                        placeholder="时间 / 地点"
                        style={{ flex: 1, maxWidth: 180 }}
                        value={sub.timeframe || sub.location ? `${sub.timeframe || ""} | ${sub.location || ""}` : ""}
                        onChange={(e) => {
                          const [t, l] = e.currentTarget.value.split("|");
                          handleUpdateSubScene(idx, "timeframe", t?.trim() || "");
                          handleUpdateSubScene(idx, "location", l?.trim() || "");
                        }}
                      />
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteSubScene(idx)}
                      title="删除该子情节"
                    >
                      <FiTrash2 size={14} />
                    </ActionIcon>
                  </Flex>
                  <Textarea
                    placeholder="具体的事件发生经过与互动描写..."
                    autosize
                    minRows={1}
                    maxRows={3}
                    value={sub.content}
                    onChange={(e) => handleUpdateSubScene(idx, "content", e.currentTarget.value)}
                  />
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        {/* 关联人物与设定 */}
        <Group grow>
          <MultiSelect
            label="关联参演人物"
            placeholder="选择出场角色..."
            data={charOptions}
            value={selectedCharIds}
            onChange={setSelectedCharIds}
            searchable
            clearable
            leftSection={<FiUser size={15} />}
          />
          <MultiSelect
            label="关联参考设定/笔记"
            placeholder="选择关联的参考设定..."
            data={noteOptions}
            value={selectedNoteIds}
            onChange={setSelectedNoteIds}
            searchable
            clearable
            leftSection={<FiFileText size={15} />}
          />
        </Group>

        {/* 底部按钮 */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="filled"
            color="blue"
            leftSection={<FiSave size={15} />}
            loading={submitting}
            onClick={handleSubmit}
          >
            {editingNode ? "保存并替换原数据" : "确认添加"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
