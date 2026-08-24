"use client";

import React from "react";
import { Modal, Text, Button, Flex, Box } from "@mantine/core";
import { FiAlertTriangle } from "react-icons/fi";

interface ModalDeleteConfirmProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
}

export default function ModalDeleteConfirm({
  opened,
  onClose,
  onConfirm,
  title,
}: ModalDeleteConfirmProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex align="center" gap={8} c="#e11d48">
          <FiAlertTriangle size={18} />
          <Text fw={700} fz={16}>
            删除作品确认
          </Text>
        </Flex>
      }
      centered
      radius="md"
      padding="xl"
      overlayProps={{
        backgroundOpacity: 0.45,
        blur: 3,
      }}
    >
      <Box mb={24}>
        <Text fz={14} c="#475569" lh={1.6}>
          确定要删除作品 <Text component="span" fw={700} c="#1e293b">「{title}」</Text> 吗？
        </Text>
        <Text fz={12} c="#94a3b8" mt={6}>
          该操作不可逆，删除后作品的所有章节、大纲及相关设定将被彻底移除。
        </Text>
      </Box>

      <Flex justify="flex-end" gap={12}>
        <Button variant="subtle" color="gray" onClick={onClose}>
          取消
        </Button>
        <Button
          color="red"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          radius="md"
        >
          确认删除
        </Button>
      </Flex>
    </Modal>
  );
}
