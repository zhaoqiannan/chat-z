// 组件：章节属性设定弹窗（极简线条排版、字数统计速览、标题卷名与大纲备忘修改）
"use client";

import React, { useState, useEffect } from "react";
import { Modal, TextInput, Textarea, Select, Button, Stack, Flex, Text, Badge, SimpleGrid, Group } from "@mantine/core";
import { FiSave } from "react-icons/fi";
import { ChapterItem, ChapterStatus, UpdateChapterPayload } from "@/rest/chapter";

interface ModalChapterDetailProps {
  opened: boolean;
  onClose: () => void;
  chapter: ChapterItem | null;
  volumes: ChapterItem[];
  onUpdate: (data: UpdateChapterPayload) => Promise<void>;
}

export default function ModalChapterDetail({
  opened,
  onClose,
  chapter,
  volumes,
  onUpdate,
}: ModalChapterDetailProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [volumeId, setVolumeId] = useState<number | string | null>(null);
  const [status, setStatus] = useState<ChapterStatus>("not_started");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (chapter && opened) {
      setTitle(chapter.title || "");
      setSubtitle(chapter.subtitle || "");
      setVolumeId(chapter.volumeId || null);
      setStatus(chapter.status || "not_started");
      setSummary(chapter.summary || "");
      setError("");
    }
  }, [chapter, opened]);

  if (!chapter) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("章节标题不能为空");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onUpdate({
        id: chapter.id,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        volumeId: volumeId ? Number(volumeId) : null,
        status,
        summary: summary.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "更新失败");
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
          <Text fw={700} fz={15} c="#0f172a">
            {chapter.isVolume ? "分卷详情设定" : `第 ${chapter.chapterNumber} 章 属性设定`}
          </Text>
        </Flex>
      }
      centered
      size="md"
      radius="sm"
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
        body: { paddingTop: 14 },
      }}
    >
      <Stack gap="xs">
        <SimpleGrid cols={3} spacing="xs" p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 4, backgroundColor: "#fafbfc" }}>
          <div>
            <Text fz={10.5} c="#94a3b8">实际字数</Text>
            <Text fz={13.5} fw={700} c="#0284c7">
              {(chapter.wordCount || 0).toLocaleString()} 字
            </Text>
          </div>
          <div>
            <Text fz={10.5} c="#94a3b8">章节序号</Text>
            <Text fz={13.5} fw={600} c="#334155">
              {chapter.isVolume ? "分卷" : `第 ${chapter.chapterNumber} 章`}
            </Text>
          </div>
          <div>
            <Text fz={10.5} c="#94a3b8">创作状态</Text>
            <Badge
              size="xs"
              color={status === "completed" ? "teal" : status === "revising" ? "yellow" : "gray"}
              variant="outline"
              styles={{ root: { fontSize: 10, height: 18 } }}
            >
              {status === "completed" ? "已完成" : status === "revising" ? "写作中" : "未开始"}
            </Badge>
          </div>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <TextInput
            label="章节标题"
            placeholder="请输入章节标题"
            size="xs"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />

          <TextInput
            label="副标题 (选填)"
            placeholder="例如：一剑霜寒十四州"
            size="xs"
            value={subtitle}
            onChange={(e) => setSubtitle(e.currentTarget.value)}
          />
        </SimpleGrid>

        {!chapter.isVolume && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="归属分卷"
              placeholder="选择所属分卷"
              size="xs"
              value={volumeId !== null && volumeId !== undefined ? String(volumeId) : ""}
              onChange={(val) => setVolumeId(val ? Number(val) : null)}
              data={volumeOptions}
              clearable
            />

            <Select
              label="写作状态"
              size="xs"
              value={status}
              onChange={(val) => setStatus((val as ChapterStatus) || "not_started")}
              data={[
                { value: "not_started", label: "未开始 (待动笔)" },
                { value: "revising", label: "修改/写作中" },
                { value: "completed", label: "已完成" },
              ]}
            />
          </SimpleGrid>
        )}

        <Textarea
          label="本章大纲梗概 / 剧情备忘"
          placeholder="记录本章的核心事件走向、出场人物或后续伏笔..."
          size="xs"
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
          minRows={3}
          autosize
        />

        {error && <Text c="red" fz="xs">{error}</Text>}

        <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            color="cyan"
            size="xs"
            leftSection={<FiSave size={12} />}
            loading={loading}
            onClick={handleSave}
          >
            保存设定
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
