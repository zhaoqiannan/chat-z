// 组件：编辑器划词悬浮 AI 快捷工具条（零右键劫持，一键触发“无脑操作”）
"use client";

import React from "react";
import { Paper, Group, Button, Menu, Divider } from "@mantine/core";
import { FiChevronDown } from "react-icons/fi";

interface SelectionBubbleBarProps {
  x: number;
  y: number;
  selectedText: string;
  onTrigger: (actionType: string, selectedText: string, subMode?: string) => void;
  onClose: () => void;
}

const EXPAND_OPTIONS = [
  { key: "action", label: "🎬 加动作与镜头感" },
  { key: "atmosphere", label: "🌫️ 加环境与氛围" },
  { key: "psychology", label: "💭 加心理暗流" },
  { key: "dialogue", label: "💬 加对话张力" },
];

const TONE_OPTIONS = [
  { key: "cold", label: "🧊 冷峻克制" },
  { key: "suspense", label: "🕵️ 悬疑紧绷" },
  { key: "humor", label: "😄 轻快诙谐" },
  { key: "lyrical", label: "🌙 细腻抒情" },
  { key: "ancient", label: "🏮 古风雅致" },
];

export default function SelectionBubbleBar({
  x,
  y,
  selectedText,
  onTrigger,
  onClose,
}: SelectionBubbleBarProps) {
  const safeLeft =
    typeof window !== "undefined" ? Math.max(12, Math.min(x - 190, window.innerWidth - 460)) : x;
  const safeTop = Math.max(68, y - 48);

  const fire = (actionType: string, subMode?: string) => {
    onTrigger(actionType, selectedText, subMode);
    onClose();
  };

  return (
    <Paper
      shadow="lg"
      radius="xl"
      px={8}
      py={4}
      bg="#ffffff"
      bd="1px solid #e2e8f0"
      pos="fixed"
      left={safeLeft}
      top={safeTop}
      style={{ zIndex: 900, boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Group gap={2} wrap="nowrap">
        <Button size="compact-xs" variant="subtle" color="cyan" onClick={() => fire("polish", "refined")}>
          ✨ 一键变好
        </Button>

        <Menu shadow="md" width={160} position="bottom-start" withinPortal>
          <Menu.Target>
            <Button
              size="compact-xs"
              variant="subtle"
              color="teal"
              rightSection={<FiChevronDown size={10} />}
            >
              🌱 写丰富点
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item fz={12} onClick={() => fire("expand", "general")}>
              ✨ 综合丰富细节
            </Menu.Item>
            <Menu.Divider />
            {EXPAND_OPTIONS.map((opt) => (
              <Menu.Item key={opt.key} fz={12} onClick={() => fire("expand", opt.key)}>
                {opt.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        <Button size="compact-xs" variant="subtle" color="orange" onClick={() => fire("shorten", "tight")}>
          ✂️ 精简提速
        </Button>

        <Menu shadow="md" width={140} position="bottom-start" withinPortal>
          <Menu.Target>
            <Button
              size="compact-xs"
              variant="subtle"
              color="grape"
              rightSection={<FiChevronDown size={10} />}
            >
              🎭 换个味道
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {TONE_OPTIONS.map((opt) => (
              <Menu.Item key={opt.key} fz={12} onClick={() => fire("tone", opt.key)}>
                {opt.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>

        <Divider orientation="vertical" my={4} />

        <Button size="compact-xs" variant="subtle" color="red" onClick={() => fire("critique")}>
          🔍 挑挑毛病
        </Button>

        <Button size="compact-xs" variant="subtle" color="blue" onClick={() => fire("custom_focus")}>
          💬 自定义
        </Button>
      </Group>
    </Paper>
  );
}
