// 组件：新建素材资料弹窗（极简线条表单、类型选择、来源链接与提炼正文）
"use client";

import React, { useState } from "react";
import { Flex, Text, Button, Modal, TextInput, Textarea, Select, Stack, Group, SimpleGrid } from "@mantine/core";
import { MaterialData, createMaterial } from "@/rest/project-extensions";

interface ModalCreateMaterialProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  onSuccess: (created: MaterialData) => void;
}

export default function ModalCreateMaterial({
  opened,
  onClose,
  workId,
  onSuccess,
}: ModalCreateMaterialProps) {
  const [title, setTitle] = useState("");
  const [fileType, setFileType] = useState("document");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [linkedTarget, setLinkedTarget] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("素材名称不能为空");
      return;
    }

    try {
      setSaving(true);
      const res = await createMaterial({
        workId: Number(workId),
        title: title.trim(),
        fileType,
        content,
        sourceUrl,
        linkedTarget,
        tags,
        status: "processed",
      });

      if (res && res.success && res.result) {
        onClose();
        setTitle("");
        setContent("");
        setSourceUrl("");
        setLinkedTarget("");
        setTags("");
        onSuccess(res.result);
      }
    } catch (e: any) {
      alert("创建素材失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} fz={15} c="#0f172a">新建素材资料</Text>}
      centered
      size="md"
      radius="sm"
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
        body: { paddingTop: 14 },
      }}
    >
      <Stack gap="xs">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <TextInput
            label="素材名称"
            placeholder="例如：空间跃迁理论 / 仙女座参考"
            size="xs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Select
            label="素材类型"
            size="xs"
            value={fileType}
            onChange={(val) => setFileType(val || "document")}
            data={[
              { value: "document", label: "文档" },
              { value: "image", label: "图片" },
              { value: "data", label: "数据" },
              { value: "audio", label: "音频" },
              { value: "video", label: "视频" },
              { value: "link", label: "链接" },
            ]}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <TextInput
            label="物理来源 / 原始链接"
            placeholder="https://..."
            size="xs"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />

          <TextInput
            label="关联小说内容"
            placeholder="例如：关联 3 章 / 曙光号"
            size="xs"
            value={linkedTarget}
            onChange={(e) => setLinkedTarget(e.target.value)}
          />
        </SimpleGrid>

        <TextInput
          label="标签 (逗号或空格隔开)"
          placeholder="例如：天文学, 星际科学, 设定参考"
          size="xs"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <Textarea
          label="素材详细内容 / 文字提炼"
          placeholder="在此输入素材正文、核心机制或硬核参数..."
          size="xs"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minRows={4}
          autosize
        />

        <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={onClose}>取消</Button>
          <Button color="cyan" size="xs" loading={saving} onClick={handleSubmit}>确认创建</Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
