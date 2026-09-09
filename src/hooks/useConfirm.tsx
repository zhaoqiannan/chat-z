"use client";

import React, { useState } from "react";
import { modals } from "@mantine/modals";
import { Text, Box, Flex, ThemeIcon, TextInput, Stack, Button, Group } from "@mantine/core";
import { FiAlertTriangle, FiTrash2, FiHelpCircle, FiInfo } from "react-icons/fi";

export interface ConfirmOptions {
  title?: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  type?: "danger" | "warning" | "info";
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface PromptOptions {
  title?: string;
  message: string | React.ReactNode;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  expectedValue?: string;
  onConfirm: (val: string) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 弹出二次确认弹窗（支持 Promise 异步与回调两种写法）
 * @example
 * // 1. Promise 写法
 * if (await showConfirm({ message: "确定要删除此条记录吗？" })) {
 *   doDelete();
 * }
 * 
 * // 2. 回调写法
 * showConfirm({
 *   title: "删除确认",
 *   message: "确定要删除吗？此操作不可逆。",
 *   onConfirm: () => doDelete()
 * });
 */
export function showConfirm(options: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
  const {
    title = opts.type === "info" ? "提示" : "操作确认",
    message,
    confirmLabel = "确定",
    cancelLabel = "取消",
    confirmColor = opts.type === "info" ? "blue" : "red",
    type = "danger",
    onConfirm,
    onCancel,
  } = opts;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <FiTrash2 size={18} color="#ef4444" />;
      case "warning":
        return <FiAlertTriangle size={18} color="#f59e0b" />;
      case "info":
      default:
        return <FiInfo size={18} color="#00c9ff" />;
    }
  };

  return new Promise((resolve) => {
    modals.openConfirmModal({
      title: (
        <Flex align="center" gap={8}>
          {getIcon()}
          <Text fw={700} fz={15} c="#0f172a">
            {title}
          </Text>
        </Flex>
      ),
      children: typeof message === "string" ? (
        <Text fz={13.5} c="#475569" style={{ lineHeight: 1.6, padding: "6px 0" }}>
          {message}
        </Text>
      ) : (
        message
      ),
      labels: { confirm: confirmLabel, cancel: cancelLabel },
      confirmProps: { color: confirmColor, size: "xs", radius: "sm" },
      cancelProps: { variant: "subtle", color: "gray", size: "xs", radius: "sm" },
      centered: true,
      radius: "md",
      withCloseButton: false,
      onConfirm: async () => {
        if (onConfirm) {
          await onConfirm();
        }
        resolve(true);
      },
      onCancel: () => {
        if (onCancel) {
          onCancel();
        }
        resolve(false);
      },
      onClose: () => {
        resolve(false);
      },
    });
  });
}

/**
 * 弹出需要输入校验文本的高危二次确认弹窗
 */
export function showPromptModal(options: PromptOptions): Promise<string | null> {
  const {
    title = "高危操作确认",
    message,
    placeholder = "请输入确认内容...",
    confirmLabel = "确认执行",
    cancelLabel = "取消",
    confirmColor = "red",
    expectedValue,
    onConfirm,
    onCancel,
  } = options;

  return new Promise((resolve) => {
    const modalId = modals.open({
      title: (
        <Flex align="center" gap={8}>
          <FiAlertTriangle size={18} color="#ef4444" />
          <Text fw={700} fz={15} c="#0f172a">
            {title}
          </Text>
        </Flex>
      ),
      centered: true,
      radius: "md",
      children: (
        <PromptModalContent
          message={message}
          placeholder={placeholder}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          confirmColor={confirmColor}
          expectedValue={expectedValue}
          onConfirm={async (val) => {
            modals.close(modalId);
            if (onConfirm) {
              await onConfirm(val);
            }
            resolve(val);
          }}
          onCancel={() => {
            modals.close(modalId);
            if (onCancel) {
              onCancel();
            }
            resolve(null);
          }}
        />
      ),
    });
  });
}

function PromptModalContent({
  message,
  placeholder,
  confirmLabel,
  cancelLabel,
  confirmColor,
  expectedValue,
  onConfirm,
  onCancel,
}: {
  message: string | React.ReactNode;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmColor: string;
  expectedValue?: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const isMatch = expectedValue !== undefined ? value.trim() === expectedValue.trim() : value.trim().length > 0;

  return (
    <Stack gap={14} mt={6}>
      {typeof message === "string" ? (
        <Text fz={13.5} c="#475569" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {message}
        </Text>
      ) : (
        message
      )}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        size="xs"
        autoFocus
      />
      <Group justify="flex-end" gap={10} mt={6}>
        <Button variant="subtle" color="gray" size="xs" radius="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          color={confirmColor}
          size="xs"
          radius="sm"
          disabled={!isMatch}
          onClick={() => onConfirm(value)}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Stack>
  );
}

export const useConfirm = {
  show: showConfirm,
  prompt: showPromptModal,
};
