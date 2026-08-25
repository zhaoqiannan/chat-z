"use client";

import React, { useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Stack,
  Flex,
  Text,
} from "@mantine/core";
import { OutlineNodeType, CreateOutlinePayload, OutlineNode } from "@/rest/outline";
import ChapterPicker from "../chapter-picker";

interface ModalCreateNodeProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  parentNodes: OutlineNode[];
  defaultParentId?: string | null;
  onSubmit: (data: CreateOutlinePayload) => Promise<void>;
}

export default function ModalCreateNode({
  opened,
  onClose,
  workId,
  parentNodes,
  defaultParentId,
  onSubmit,
}: ModalCreateNodeProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<OutlineNodeType>("scene");
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<string | null>(defaultParentId || null);
  const [goal, setGoal] = useState("");
  const [conflict, setConflict] = useState("");
  const [characters, setCharacters] = useState("");
  const [locations, setLocations] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [linkedChapters, setLinkedChapters] = useState("");
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (opened) {
      setParentId(defaultParentId || null);
      setTitle("");
      setGoal("");
      setConflict("");
      setCharacters("");
      setLocations("");
      setExpectedOutcome("");
      setLinkedChapters("");
      setError("");
    }
  }, [opened, defaultParentId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("节点标题不能为空");
      return;
    }
    if (!goal.trim()) {
      setError("节点目标为必填项");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSubmit({
        workId,
        parentId: parentId || null,
        type,
        title: title.trim(),
        goal: goal.trim(),
        conflict: conflict.trim(),
        characters: characters.trim(),
        locations: locations.trim(),
        expectedOutcome: expectedOutcome.trim(),
        linkedChapters: linkedChapters.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "创建节点失败");
    } finally {
      setLoading(false);
    }
  };

  const parentOptions = [
    { value: "", label: "作为顶级节点 (根层级)" },
    ...parentNodes.map((n) => ({
      value: n.id,
      label: `[${n.type.toUpperCase()}] ${n.title}`,
    })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} fz={16} c="#1e293b">
          新增大纲节点
        </Text>
      }
      centered
      size="lg"
      radius="md"
    >
      <Stack gap="14px">
        <Flex gap="12px">
          <Select
            label="节点类型"
            value={type}
            onChange={(val) => setType((val as OutlineNodeType) || "scene")}
            data={[
              { value: "volume", label: "卷 / 篇章 (Volume)" },
              { value: "act", label: "幕 / 阶段 (Act)" },
              { value: "scene", label: "情景点 (Scene)" },
              { value: "event", label: "关键事件 (Event)" },
            ]}
            style={{ width: "180px" }}
          />
          <TextInput
            label="节点标题"
            placeholder="例如：第一卷 潜龙在渊 / 议事厅退婚"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            style={{ flex: 1 }}
            required
          />
        </Flex>

        <Select
          label="挂载父级节点 (所属层级)"
          placeholder="请选择父节点（非必选）"
          value={parentId || ""}
          onChange={(val) => setParentId(val || null)}
          data={parentOptions}
          clearable
        />

        <Textarea
          label="🎯 节点目标 (必填)"
          placeholder="该节点要达成的核心叙事目标是什么？例如：交代主角身世背景，激化与反派矛盾..."
          value={goal}
          onChange={(e) => setGoal(e.currentTarget.value)}
          minRows={2}
          required
        />

        <Textarea
          label="⚡ 冲突点 / 阻碍 (选填)"
          placeholder="剧情阻碍、敌人压迫、心理障碍等..."
          value={conflict}
          onChange={(e) => setConflict(e.currentTarget.value)}
          minRows={2}
        />

        <Flex gap="12px">
          <TextInput
            label="👥 涉及角色 (选填)"
            placeholder="如：主角, 长老, 反派"
            value={characters}
            onChange={(e) => setCharacters(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <TextInput
            label="🏰 涉及地点 (选填)"
            placeholder="如：家族正厅, 演武场"
            value={locations}
            onChange={(e) => setLocations(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
        </Flex>

        <TextInput
          label="🎁 预期结果 / 伏笔 (选填)"
          placeholder="如：立下三年之约，金手指苏醒"
          value={expectedOutcome}
          onChange={(e) => setExpectedOutcome(e.currentTarget.value)}
        />

        <ChapterPicker
          value={linkedChapters}
          onChange={(val) => setLinkedChapters(val)}
        />

        {error && (
          <Text c="red" fz="xs" fw={500}>
            {error}
          </Text>
        )}

        <Flex justify="flex-end" gap="10px" mt="10px">
          <Button variant="default" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            bg="#00c9ff"
            onClick={handleSubmit}
            loading={loading}
          >
            确认创建
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
