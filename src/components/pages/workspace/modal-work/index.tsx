"use client";

import React, { useEffect, useState } from "react";
import { Modal, TextInput, NumberInput, Button, Flex, Stack, Text } from "@mantine/core";
import { FiBook, FiTag, FiFileText } from "react-icons/fi";
import styles from "../style.module.scss";

export interface WorkFormData {
  id?: string | number;
  title: string;
  tag: string;
  expectedWords: number | string;
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
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [expectedWords, setExpectedWords] = useState<number | string>(50);
  const [error, setError] = useState("");

  useEffect(() => {
    if (opened) {
      if (initialData) {
        setTitle(initialData.title || "");
        setTag(initialData.tag || "");
        setExpectedWords(
          initialData.expectedWords !== undefined && initialData.expectedWords !== ""
            ? Number(initialData.expectedWords) || 50
            : 50
        );
      } else {
        setTitle("");
        setTag("");
        setExpectedWords(50);
      }
      setError("");
    }
  }, [opened, initialData]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("作品名称不能为空");
      return;
    }
    if (!tag.trim()) {
      setError("作品类别不能为空");
      return;
    }

    const numValue = Math.round(Number(expectedWords) || 50);

    onSubmit({
      id: initialData?.id,
      title: title.trim(),
      tag: tag.trim(),
      expectedWords: numValue,
    });
    onClose();
  };

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
      size={'50vw'}
    >
      <Stack gap={16} className="form-box">
        <TextInput
          label="作品名称 / 文件名"
          placeholder="请输入作品名称,如:AAA地产开发"
          value={title}
          onChange={(e) => {
            setTitle(e.currentTarget.value);
            setError("");
          }}
          leftSection={<FiBook size={15} color="#94a3b8" />}
          required
        />

        <TextInput
          label="作品类别"
          placeholder="逗号隔开：科幻,悬疑,都市,言情,奇幻"
          value={tag}
          onChange={(e) => {
            setTag(e.currentTarget.value);
            setError("");
          }}
          leftSection={<FiTag size={15} color="#94a3b8" />}
          required
        />

        <Flex gap={20} align={'flex-end'}>
          <NumberInput
            label="预计目标字数"
            value={expectedWords}
            onChange={(val) => setExpectedWords(val)}
            min={1}
            step={1}
            decimalScale={0}
            allowDecimal={false}
            leftSection={<FiFileText size={15} color="#94a3b8" />}
          />
          <Text pb={8}>万字</Text>
        </Flex>

        <Flex justify="flex-end" gap={12} mt={12}>
          <Button variant="subtle" color="gray" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
          >
            {mode === "create" ? "立即创建" : "保存修改"}
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
