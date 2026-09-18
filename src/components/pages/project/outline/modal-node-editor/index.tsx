// 组件：大白话大纲卡片编辑/创建弹窗（4要素提问、关联角色标签与关联笔记）
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
  ScrollArea,
} from "@mantine/core";
import { FiSave, FiUser, FiFileText, FiTag } from "react-icons/fi";
import { OutlineNode, CreateOutlinePayload, UpdateOutlinePayload } from "@/rest/outline";
import { CharacterItem, getCharacterList } from "@/rest/world";
import { NoteData, NoteListResult, getNoteList } from "@/rest/project-extensions";
import { useAlert } from "@/hooks/useAlert";

interface ModalNodeEditorProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  editingNode: OutlineNode | null;
  onSaved: () => Promise<void>;
  onSubmitCreate: (data: CreateOutlinePayload) => Promise<any>;
  onSubmitUpdate: (data: UpdateOutlinePayload) => Promise<any>;
}

export default function ModalNodeEditor({
  opened,
  onClose,
  workId,
  editingNode,
  onSaved,
  onSubmitCreate,
  onSubmitUpdate,
}: ModalNodeEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);

  // 表单状态
  const [title, setTitle] = useState("");
  const [event, setEvent] = useState("");
  const [twist, setTwist] = useState("");
  const [nextGoal, setNextGoal] = useState("");
  const [suspense, setSuspense] = useState("");
  const [wordCountEstimate, setWordCountEstimate] = useState<number>(3000);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  useEffect(() => {
    if (opened && workId) {
      // 获取角色与笔记供选择
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
        setEvent(editingNode.event || editingNode.content || "");
        setTwist(editingNode.twist || editingNode.conflict || "");
        setNextGoal(editingNode.nextGoal || editingNode.goal || "");
        setSuspense(editingNode.suspense || editingNode.foreshadowing || "");
        setWordCountEstimate(editingNode.wordCountEstimate || 3000);
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
      } else {
        setTitle("");
        setEvent("");
        setTwist("");
        setNextGoal("");
        setSuspense("");
        setWordCountEstimate(3000);
        setSelectedCharIds([]);
        setSelectedNoteIds([]);
      }
    }
  }, [opened, workId, editingNode]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      useAlert.warning("请输入卡片标题");
      return;
    }

    try {
      setSubmitting(true);
      const charIdsNum = selectedCharIds.map(Number).filter((n) => !isNaN(n));
      const noteIdsNum = selectedNoteIds.map(Number).filter((n) => !isNaN(n));

      if (editingNode) {
        await onSubmitUpdate({
          id: editingNode.id,
          title: title.trim(),
          event: event.trim(),
          twist: twist.trim(),
          nextGoal: nextGoal.trim(),
          suspense: suspense.trim(),
          wordCountEstimate: Number(wordCountEstimate) || 3000,
          linkedCharacterIds: charIdsNum,
          linkedNoteIds: noteIdsNum,
        });
        useAlert.success("大纲卡片已更新");
      } else {
        await onSubmitCreate({
          workId: Number(workId),
          title: title.trim(),
          event: event.trim(),
          twist: twist.trim(),
          nextGoal: nextGoal.trim(),
          suspense: suspense.trim(),
          wordCountEstimate: Number(wordCountEstimate) || 3000,
          linkedCharacterIds: charIdsNum,
          linkedNoteIds: noteIdsNum,
          type: "scene",
          status: "planned",
        });
        useAlert.success("已添加新大纲卡片");
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

  // 选中的角色标签预览
  const activeSelectedChars = characters.filter((c) =>
    selectedCharIds.includes(String(c.id))
  );

  // 选中的笔记预览
  const activeSelectedNotes = notes.filter((n) =>
    selectedNoteIds.includes(String(n.id))
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} fz={16}>
          {editingNode ? "编辑大纲情节点" : "随手添加大纲情节"}
        </Text>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <TextInput
          label="卡片标题 / 场景名称"
          placeholder="如：黑市交易、绝境反击、解开身份谜团..."
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />

        <Paper p="sm" withBorder radius="md" bg="gray.0">
          <Text fz={13} fw={600} mb="xs" c="dimmed">
            大白话情节 4 要素（选填，帮助理顺思路）
          </Text>
          <Stack gap="xs">
            <Textarea
              label="📍 发生了什么事？（主要经过）"
              placeholder="主要事件经过、谁做了什么..."
              autosize
              minRows={2}
              maxRows={4}
              value={event}
              onChange={(e) => setEvent(e.currentTarget.value)}
            />

            <Textarea
              label="⚡ 出了什么岔子 / 意外？（转折点）"
              placeholder="意料之外的阻碍、突发的矛盾危机、反转..."
              autosize
              minRows={1}
              maxRows={3}
              value={twist}
              onChange={(e) => setTwist(e.currentTarget.value)}
            />

            <Textarea
              label="🎯 人物接下来打算怎么办？（下一步动机）"
              placeholder="这件事情发生后，主角或主要人物的下一步计划..."
              autosize
              minRows={1}
              maxRows={3}
              value={nextGoal}
              onChange={(e) => setNextGoal(e.currentTarget.value)}
            />

            <Textarea
              label="🕳️ 留下了什么悬念 / 伏笔？（未解的坑）"
              placeholder="新埋下的线索、神秘线人、待解的秘密..."
              autosize
              minRows={1}
              maxRows={3}
              value={suspense}
              onChange={(e) => setSuspense(e.currentTarget.value)}
            />
          </Stack>
        </Paper>

        <Group grow align="flex-start">
          <Stack gap={4}>
            <MultiSelect
              label="👥 关联出场角色"
              placeholder="选择本段出场的角色..."
              data={charOptions}
              value={selectedCharIds}
              onChange={setSelectedCharIds}
              searchable
              clearable
              leftSection={<FiUser size={14} />}
            />
            {activeSelectedChars.length > 0 && (
              <Box mt={4}>
                <Text fz={11} c="dimmed" mb={2}>
                  角色标签预览：
                </Text>
                <Group gap={4}>
                  {activeSelectedChars.map((c) => (
                    <Badge key={c.id} variant="light" color="blue" size="xs">
                      {c.name} {c.identity ? `· ${c.identity}` : ""}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}
          </Stack>

          <NumberInput
            label="📏 预期字数篇幅 (字)"
            placeholder="3000"
            min={500}
            max={50000}
            step={500}
            value={wordCountEstimate}
            onChange={(val) => setWordCountEstimate(Number(val) || 3000)}
          />
        </Group>

        <Stack gap={4}>
          <MultiSelect
            label="📑 关联设定/灵感笔记"
            placeholder="选择本段需参考的设定集或随笔笔记..."
            data={noteOptions}
            value={selectedNoteIds}
            onChange={setSelectedNoteIds}
            searchable
            clearable
            leftSection={<FiFileText size={14} />}
          />
          {activeSelectedNotes.length > 0 && (
            <Paper p="xs" withBorder radius="sm" mt={4} bg="gray.0">
              <Text fz={11} fw={600} c="dimmed" mb={4}>
                关联笔记全文将在故事轴卡片上直接展开显示：
              </Text>
              <Stack gap={4}>
                {activeSelectedNotes.map((n) => (
                  <Text key={n.id} fz={12} lineClamp={1}>
                    📘 <b>{n.title}</b>: {n.content || "(空)"}
                  </Text>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant="filled"
            color="blue"
            leftSection={<FiSave size={14} />}
            onClick={handleSubmit}
            loading={submitting}
          >
            保存卡片
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
