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
  Badge,
} from "@mantine/core";
import { ChapterItem, CreateChapterPayload, ChapterStatus } from "@/rest/chapter";

interface ModalCreateChapterProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  volumes: ChapterItem[];
  defaultVolumeId?: number | string | null;
  nextChapterNum: number;
  onSubmit: (data: CreateChapterPayload) => Promise<void>;
}

export default function ModalCreateChapter({
  opened,
  onClose,
  workId,
  volumes,
  defaultVolumeId,
  nextChapterNum,
  onSubmit,
}: ModalCreateChapterProps) {
  const [title, setTitle] = useState("");
  const [volumeId, setVolumeId] = useState<number | string | null>(defaultVolumeId || null);
  const [status, setStatus] = useState<ChapterStatus>("not_started");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (opened) {
      setTitle(`第 ${nextChapterNum} 章 `);
      setVolumeId(defaultVolumeId || null);
      setStatus("not_started");
      setSummary("");
      setError("");
    }
  }, [opened, defaultVolumeId, nextChapterNum]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("章节标题不能为空");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await onSubmit({
        workId,
        volumeId: volumeId ? Number(volumeId) : null,
        isVolume: false,
        title: title.trim(),
        status,
        summary: summary.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const volumeOptions = [
    { value: "", label: "未分卷 / 根目录" },
    ...volumes.map((v) => ({
      value: String(v.id),
      label: `📁 ${v.title}`,
    })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <Text fw={700} fz={16}>
            新建正文章节
          </Text>
          <Badge color="blue" variant="light">
            预计序号: 第 {nextChapterNum} 章
          </Badge>
        </Flex>
      }
      centered
      size="70vw"
      radius="md"
      padding="xl"
    >
      <Stack gap="14px" className="form-box">
        <TextInput
          label="章节标题"
          placeholder="例如：第 1 章 少年与剑"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />

        <Select
          label="归属分卷"
          placeholder="请选择所属卷（可选）"
          value={volumeId !== null && volumeId !== undefined ? String(volumeId) : ""}
          onChange={(val) => setVolumeId(val ? Number(val) : null)}
          data={volumeOptions}
          clearable
        />

        <Select
          label="写作初始状态"
          value={status}
          onChange={(val) => setStatus((val as ChapterStatus) || "not_started")}
          data={[
            { value: "not_started", label: "未开始 (草稿未动)" },
            { value: "revising", label: "修改/写作中" },
            { value: "completed", label: "已完成" },
          ]}
        />

        <Textarea
          label="本章大纲摘要 / 伏笔备忘 (选填)"
          placeholder="记录本章要交代的核心情节、登场角色等..."
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
          minRows={3}
        />

        {error && <Text c="red" fz="xs">{error}</Text>}

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
