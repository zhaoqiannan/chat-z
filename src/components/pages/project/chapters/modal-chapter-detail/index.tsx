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
  Badge,
  Paper,
  SimpleGrid,
} from "@mantine/core";
import { FiFileText, FiSave, FiCheckCircle } from "react-icons/fi";
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
          <FiFileText color="#00c9ff" size={18} />
          <Text fw={700} fz={16} c="#1e293b">
            {chapter.isVolume ? "分卷详情设定" : `第 ${chapter.chapterNumber} 章 详情设定`}
          </Text>
        </Flex>
      }
      centered
      size="70vw"
      radius="md"
    >
      <Stack gap="14px" className="form-box">
        {/* 数据统计横幅 */}
        <Paper p="12px 16px" bg="#f8fafc" withBorder radius="md">
          <SimpleGrid cols={3}>
            <div>
              <Text fz={11} c="#94a3b8">当前实际字数</Text>
              <Text fz={16} fw={700} c="#00c9ff">
                {(chapter.wordCount || 0).toLocaleString()} 字
              </Text>
            </div>
            <div>
              <Text fz={11} c="#94a3b8">章节序号</Text>
              <Text fz={15} fw={600} c="#334155">
                {chapter.isVolume ? "分卷目录" : `第 ${chapter.chapterNumber} 章`}
              </Text>
            </div>
            <div>
              <Text fz={11} c="#94a3b8">创作状态</Text>
              <Badge
                color={
                  status === "completed"
                    ? "green"
                    : status === "revising"
                    ? "yellow"
                    : "gray"
                }
                variant="light"
                mt={2}
              >
                {status === "completed"
                  ? "已完成"
                  : status === "revising"
                  ? "修改/写作中"
                  : "未开始"}
              </Badge>
            </div>
          </SimpleGrid>
        </Paper>

        <SimpleGrid cols={2} spacing="12px">
          <TextInput
            label="章节标题"
            placeholder="请输入章节标题"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />

          <TextInput
            label="小标题 / 章节副标题 (选填)"
            placeholder="例如：一剑霜寒十四州 / 命运齿轮的转动"
            value={subtitle}
            onChange={(e) => setSubtitle(e.currentTarget.value)}
          />
        </SimpleGrid>

        {!chapter.isVolume && (
          <SimpleGrid cols={2} spacing="12px">
            <Select
              label="归属分卷"
              placeholder="选择所属分卷"
              value={volumeId !== null && volumeId !== undefined ? String(volumeId) : ""}
              onChange={(val) => setVolumeId(val ? Number(val) : null)}
              data={volumeOptions}
              clearable
            />

            <Select
              label="写作状态"
              value={status}
              onChange={(val) => setStatus((val as ChapterStatus) || "not_started")}
              data={[
                { value: "not_started", label: "⚪ 未开始 (待动笔)" },
                { value: "revising", label: "🟡 修改/写作中" },
                { value: "completed", label: "🟢 已完成" },
              ]}
            />
          </SimpleGrid>
        )}

        <Textarea
          label="本章大纲梗概 / 伏笔与剧情备忘"
          placeholder="记录本章的核心事件走向、出场人物、关键线索或后续伏笔..."
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
          minRows={4}
        />

        {error && <Text c="red" fz="xs">{error}</Text>}

        <Flex justify="flex-end" gap="10px" mt="10px">
          <Button variant="outline" color="gray" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            leftSection={<FiSave size={14} />}
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
