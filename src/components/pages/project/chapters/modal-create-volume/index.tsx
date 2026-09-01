// 组件：新建分卷弹窗（极简线条表单、分卷标题与主线备忘录入）
"use client";

import React, { useState, useEffect } from "react";
import { Modal, TextInput, Textarea, Button, Stack, Flex, Text } from "@mantine/core";
import { CreateChapterPayload } from "@/rest/chapter";

interface ModalCreateVolumeProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  onSubmit: (data: CreateChapterPayload) => Promise<void>;
}

export default function ModalCreateVolume({
  opened,
  onClose,
  workId,
  onSubmit,
}: ModalCreateVolumeProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (opened) {
      setTitle("");
      setSummary("");
      setError("");
    }
  }, [opened]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("卷名不能为空");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await onSubmit({
        workId,
        isVolume: true,
        title: title.trim(),
        summary: summary.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} fz={15} c="#0f172a">新建分卷 (Volume)</Text>}
      centered
      size="md"
      radius="sm"
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
        body: { paddingTop: 14 },
      }}
    >
      <Stack gap="xs">
        <TextInput
          label="分卷名称"
          placeholder="例如：第一卷 龙潜深渊"
          size="xs"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <Textarea
          label="分卷概要 / 主线备忘 (选填)"
          placeholder="简述本卷的核心主线目标与大纲规划..."
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
          <Button color="cyan" size="xs" onClick={handleSubmit} loading={loading}>
            确认创建
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
