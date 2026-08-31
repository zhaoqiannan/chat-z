"use client";

import React, { useEffect } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Switch,
  Button,
  Flex,
  Stack,
  Text,
  SimpleGrid,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { FiBook, FiTag, FiFileText, FiLayers } from "react-icons/fi";

export interface WorkFormData {
  id?: string | number;
  title: string;
  tag: string;
  expectedWords: number | string;
  expectedChapters?: number | string;
  description?: string;
  isPinned?: boolean | number;
}

interface ModalWorkProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: WorkFormData) => void;
  initialData?: WorkFormData | null;
  mode?: "create" | "edit";
}

export default function ModalWork({
  opened,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: ModalWorkProps) {
  const form = useForm({
    initialValues: {
      title: "",
      tag: "",
      expectedWords: 50,
      expectedChapters: 100,
      description: "",
      isPinned: false,
    },
    validate: {
      title: (value) => (!value?.trim() ? "作品名称不能为空" : null),
      tag: (value) => (!value?.trim() ? "作品类别不能为空" : null),
      expectedWords: (value) =>
        value === undefined || value === null || Number(value) <= 0
          ? "预计目标字数必须大于 0"
          : null,
      expectedChapters: (value) =>
        value === undefined || value === null || Number(value) <= 0
          ? "预计总章节数必须大于 0"
          : null,
    },
  });

  useEffect(() => {
    if (opened) {
      if (initialData) {
        const rawWords =
          initialData.expectedWords !== undefined && initialData.expectedWords !== ""
            ? Number(initialData.expectedWords)
            : 500000;
        const displayWords =
          rawWords >= 1000 ? Math.round((rawWords / 10000) * 100) / 100 : rawWords;

        form.setValues({
          title: initialData.title || "",
          tag: initialData.tag || "",
          expectedWords: displayWords,
          expectedChapters: Number(initialData.expectedChapters) || 100,
          description: initialData.description || "",
          isPinned: Boolean(initialData.isPinned),
        });
      } else {
        form.setValues({
          title: "",
          tag: "",
          expectedWords: 50,
          expectedChapters: 100,
          description: "",
          isPinned: false,
        });
      }
      form.clearErrors();
    }
  }, [opened, initialData]);

  const handleSubmit = form.onSubmit((values) => {
    const targetWordsInUnit = Math.round(Number(values.expectedWords) * 10000);
    const targetChapters = Math.round(Number(values.expectedChapters) || 100);

    onSubmit({
      id: initialData?.id,
      title: values.title.trim(),
      tag: values.tag.trim(),
      expectedWords: targetWordsInUnit,
      expectedChapters: targetChapters,
      description: values.description?.trim() || "",
      isPinned: values.isPinned,
    });
    onClose();
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={700} fz={17} c="#1e293b">
          {mode === "create" ? "新建作品" : "编辑作品"}
        </Text>
      }
      centered
      radius="md"
      padding="xl"
      size="50vw"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap={16} className="form-box">
          <TextInput
            label="作品名称 / 文件名"
            placeholder="请输入作品名称,如:AAA地产开发"
            leftSection={<FiBook size={15} color="#94a3b8" />}
            required
            {...form.getInputProps("title")}
          />

          <TextInput
            label="作品类别"
            placeholder="逗号隔开：科幻,悬疑,都市,言情,奇幻"
            leftSection={<FiTag size={15} color="#94a3b8" />}
            required
            {...form.getInputProps("tag")}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={16}>
            <Flex gap={10} align="flex-end">
              <NumberInput
                label="预计目标字数"
                placeholder="如：50 或 12.55"
                min={0.01}
                step={0.5}
                decimalScale={2}
                allowDecimal={true}
                leftSection={<FiFileText size={15} color="#94a3b8" />}
                style={{ flex: 1 }}
                {...form.getInputProps("expectedWords")}
              />
              <Text pb={8} fw={600} fz={14} c="#475569">
                万字
              </Text>
            </Flex>

            <Flex gap={10} align="flex-end">
              <NumberInput
                label="预计总章节数"
                placeholder="如：100"
                min={1}
                step={10}
                decimalScale={0}
                allowDecimal={false}
                leftSection={<FiLayers size={15} color="#94a3b8" />}
                style={{ flex: 1 }}
                {...form.getInputProps("expectedChapters")}
              />
              <Text pb={8} fw={600} fz={14} c="#475569">
                章
              </Text>
            </Flex>
          </SimpleGrid>

          <Textarea
            label="故事梗概"
            placeholder="简述作品的核心主线、核心矛盾与故事梗概（选填）..."
            minRows={3}
            maxRows={6}
            autosize
            {...form.getInputProps("description")}
          />

          <Flex justify="space-between" align="center" mt={4} py={4}>
            <Text fz={14} fw={600} c="#475569">
              是否置顶该作品
            </Text>
            <Switch
              size="md"
              color="#00c9ff"
              {...form.getInputProps("isPinned", { type: "checkbox" })}
            />
          </Flex>

          <Flex justify="flex-end" gap={12} mt={12}>
            <Button variant="outline" color="gray" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">
              {mode === "create" ? "立即创建" : "保存修改"}
            </Button>
          </Flex>
        </Stack>
      </form>
    </Modal>
  );
}
