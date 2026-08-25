"use client";

import React, { useState } from "react";
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

  React.useEffect(() => {
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
      title={<Text fw={700} fz={16}>新建分卷 (Volume)</Text>}
      centered
      radius="md"
      padding="xl"
    >
      <Stack gap="14px" className="form-box">
        <TextInput
          label="分卷名称"
          placeholder="例如：第一卷 龙潜深渊"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <Textarea
          label="分卷概要/主线备忘 (选填)"
          placeholder="简述本卷的核心主线目标..."
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
