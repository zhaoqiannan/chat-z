"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Stack,
  Flex,
  Text,
  SimpleGrid,
} from "@mantine/core";
import { OutlineNode, CreateOutlinePayload, OutlineNodeType, PlotPointType } from "@/rest/outline";
import ChapterPicker from "../chapter-picker";

interface ModalCreateNodeProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  parentOptions: { value: string; label: string }[];
  defaultParentId?: string | null;
  defaultType?: OutlineNodeType;
  onSubmit: (data: CreateOutlinePayload) => Promise<void>;
}

export default function ModalCreateNode({
  opened,
  onClose,
  workId,
  parentOptions,
  defaultParentId,
  defaultType = "scene",
  onSubmit,
}: ModalCreateNodeProps) {
  const [type, setType] = useState<OutlineNodeType>(defaultType);
  const [pointType, setPointType] = useState<PlotPointType>("conflict");
  const [parentId, setParentId] = useState<string | null>(defaultParentId || null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [conflict, setConflict] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [characters, setCharacters] = useState("");
  const [locations, setLocations] = useState("");
  const [foreshadowing, setForeshadowing] = useState("");
  const [linkedChapters, setLinkedChapters] = useState<number[]>([]);
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (opened) {
      setType(defaultType || "scene");
      setPointType("conflict");
      setParentId(defaultParentId || null);
      setTitle("");
      setGoal("");
      setConflict("");
      setEventDescription("");
      setExpectedOutcome("");
      setCharacters("");
      setLocations("");
      setForeshadowing("");
      setLinkedChapters([]);
      setRemarks("");
      setError("");
    }
  }, [opened, defaultParentId, defaultType]);

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
        pointType: type === "scene" ? pointType : undefined,
        title: title.trim(),
        goal: goal.trim(),
        conflict: conflict.trim(),
        eventDescription: eventDescription.trim(),
        expectedOutcome: expectedOutcome.trim(),
        characters: characters.trim(),
        locations: locations.trim(),
        foreshadowing: foreshadowing.trim(),
        linkedChapters: linkedChapters,
        remarks: remarks.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "创建大纲节点失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} fz={16}>
          新建大纲节点
        </Text>
      }
      centered
      size="lg"
      radius="md"
    >
      <Stack gap="14px" className="form-box">
        <Flex gap="12px">
          <Select
            label="节点层级类型"
            value={type}
            onChange={(val) => setType((val as OutlineNodeType) || "scene")}
            data={[
              { value: "story", label: "🌟 故事主线 (Story)" },
              { value: "volume", label: "📁 卷 / 篇章 (Volume)" },
              { value: "act", label: "🎬 幕 / 阶段 (Act)" },
              { value: "scene", label: "📍 情节点 (Scene)" },
              { value: "branch", label: "🌿 支线 / 副本 (Branch)" },
            ]}
            style={{ width: "200px" }}
          />

          {type === "scene" && (
            <Select
              label="情节点细分类型"
              value={pointType}
              onChange={(val) => setPointType((val as PlotPointType) || "conflict")}
              data={[
                { value: "conflict", label: "⚡ 核心冲突" },
                { value: "twist", label: "🔄 剧情转折" },
                { value: "foreshadow", label: "🌱 伏笔铺垫" },
                { value: "climax", label: "🔥 情绪高潮" },
                { value: "transition", label: "🍃 日常过渡" },
                { value: "reveal", label: "💡 悬念揭示" },
              ]}
              style={{ width: "160px" }}
            />
          )}

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
          label="🎯 故事目标 (*必填)"
          placeholder="该节点要解决什么故事问题/达成什么叙事目标？"
          value={goal}
          onChange={(e) => setGoal(e.currentTarget.value)}
          minRows={2}
          required
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="12px">
          <Textarea
            label="⚡ 主要冲突 (选填)"
            placeholder="人物或力量之间的核心矛盾..."
            value={conflict}
            onChange={(e) => setConflict(e.currentTarget.value)}
            minRows={2}
          />

          <Textarea
            label="📖 事件描述 (发生什么)"
            placeholder="简述该节点具体发生的核心事件脉络..."
            value={eventDescription}
            onChange={(e) => setEventDescription(e.currentTarget.value)}
            minRows={2}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="12px">
          <TextInput
            label="🎁 结果 / 状态变化 (选填)"
            placeholder="事件结束后局势与角色状态如何变化..."
            value={expectedOutcome}
            onChange={(e) => setExpectedOutcome(e.currentTarget.value)}
          />

          <TextInput
            label="🌱 伏笔 (新增或回收)"
            placeholder="本节点新增的悬念线索或回收的前文伏笔..."
            value={foreshadowing}
            onChange={(e) => setForeshadowing(e.currentTarget.value)}
          />
        </SimpleGrid>

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

        <ChapterPicker
          value={linkedChapters}
          onChange={(val) => setLinkedChapters(val)}
        />

        <TextInput
          label="📝 备注说明 (作者备忘)"
          placeholder="作者临时记录的构思提醒..."
          value={remarks}
          onChange={(e) => setRemarks(e.currentTarget.value)}
        />

        {error && (
          <Text c="red" fz="xs" fw={500}>
            {error}
          </Text>
        )}

        <Flex justify="flex-end" gap="10px" mt="10px">
          <Button variant="outline" color="gray" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            确认创建
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
