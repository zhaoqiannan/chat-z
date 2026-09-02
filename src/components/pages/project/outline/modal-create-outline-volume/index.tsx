// 组件：大纲分卷/篇章新建弹窗（篇章标题与主线目标录入）
"use client";

import React, { useState } from "react";
import { Flex, Text, Button, Modal, TextInput, Textarea, Stack } from "@mantine/core";
import { CreateOutlinePayload } from "@/rest/outline";

interface ModalCreateOutlineVolumeProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  onSuccess: () => Promise<void>;
  onCreateNode: (data: CreateOutlinePayload) => Promise<any>;
}

export default function ModalCreateOutlineVolume({
  opened,
  onClose,
  workId,
  onSuccess,
  onCreateNode,
}: ModalCreateOutlineVolumeProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("篇章标题不能为空");
      return;
    }

    try {
      setLoading(true);
      await onCreateNode({
        workId,
        title: title.trim(),
        content: content.trim(),
        type: "volume",
        goal: title.trim(),
      });
      onClose();
      setTitle("");
      setContent("");
      await onSuccess();
    } catch (e: any) {
      alert("创建篇章失败: " + (e?.message || "网络异常"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} fz={15} c="#0f172a">新建分卷 / 大纲篇章</Text>}
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
          label="篇章 / 分卷名称"
          placeholder="例如：第一卷 龙潜边荒 / 第二篇 宗门风云"
          size="xs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="篇章核心主线目标 / 备忘 (选填)"
          placeholder="简述本篇章的核心主线与预期高潮走向..."
          size="xs"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minRows={3}
          autosize
        />

        <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={onClose}>
            取消
          </Button>
          <Button color="cyan" size="xs" loading={loading} onClick={handleSave}>
            确认创建
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
