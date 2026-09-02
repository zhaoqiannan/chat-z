// 组件：极简大纲情节点新建与编辑弹窗（标题、剧情发生经过、涉及人物与篇章归属）
"use client";

import React, { useState, useEffect } from "react";
import { Flex, Text, Button, Modal, TextInput, Textarea, Select, Stack, Group } from "@mantine/core";
import { OutlineNode, CreateOutlinePayload, UpdateOutlinePayload } from "@/rest/outline";

interface ModalSimpleNodeProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  editingNode: OutlineNode | null;
  volumes: OutlineNode[];
  onSuccess: () => Promise<void>;
  onCreateNode: (data: CreateOutlinePayload) => Promise<any>;
  onUpdateNode: (data: UpdateOutlinePayload) => Promise<any>;
}

export default function ModalSimpleNode({
  opened,
  onClose,
  workId,
  editingNode,
  volumes,
  onSuccess,
  onCreateNode,
  onUpdateNode,
}: ModalSimpleNodeProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [characters, setCharacters] = useState("");
  const [volumeId, setVolumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingNode) {
      setTitle(editingNode.title || "");
      setContent(editingNode.content || editingNode.eventDescription || "");
      setCharacters(editingNode.characters || "");
      setVolumeId(editingNode.volumeId || editingNode.parentId || null);
    } else {
      setTitle("");
      setContent("");
      setCharacters("");
      setVolumeId(null);
    }
  }, [editingNode, opened]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("情节点标题不能为空");
      return;
    }

    try {
      setLoading(true);
      if (editingNode) {
        await onUpdateNode({
          id: editingNode.id,
          title: title.trim(),
          content: content.trim(),
          characters: characters.trim(),
          volumeId: volumeId || null,
          parentId: volumeId || null,
        });
      } else {
        await onCreateNode({
          workId,
          title: title.trim(),
          content: content.trim(),
          characters: characters.trim(),
          volumeId: volumeId || null,
          parentId: volumeId || null,
          type: "scene",
        });
      }
      onClose();
      await onSuccess();
    } catch (e: any) {
      alert("保存情节点失败: " + (e?.message || "网络异常"));
    } finally {
      setLoading(false);
    }
  };

  const volumeOptions = [
    { value: "", label: "未归属篇章" },
    ...volumes.map((v) => ({
      value: String(v.id),
      label: v.title,
    })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} fz={15} c="#0f172a">{editingNode ? "编辑情节点" : "新建情节点"}</Text>}
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
          label="情节点标题"
          placeholder="例如：黑市偶遇残卷 / 探秘古宗门秘境"
          size="xs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {volumes.length > 0 && (
          <Select
            label="所属分卷 / 篇章"
            size="xs"
            placeholder="选择归属篇章（可选）"
            value={volumeId || ""}
            onChange={(val) => setVolumeId(val || null)}
            data={volumeOptions}
            clearable
          />
        )}

        <TextInput
          label="涉及主要人物 (选填)"
          placeholder="例如：林尘, 萧长老, 柳若曦"
          size="xs"
          value={characters}
          onChange={(e) => setCharacters(e.target.value)}
        />

        <Textarea
          label="剧情发生经过 / 内容梗概"
          placeholder="在此记录本情节点的核心事件、动机与推进过程..."
          size="xs"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minRows={4}
          autosize
        />

        <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={onClose}>
            取消
          </Button>
          <Button color="cyan" size="xs" loading={loading} onClick={handleSave}>
            保存情节点
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
