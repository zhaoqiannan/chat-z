// 组件：角色极简线条卡片（紧凑轻盈、主要信息速览、同款置顶与点击查看详情）
"use client";

import React from "react";
import { Box, Flex, Text, Badge, ActionIcon, Card, Tooltip, Menu, Avatar, Group } from "@mantine/core";
import { FiEdit, FiTrash2, FiBookmark, FiMoreHorizontal, FiEye } from "react-icons/fi";
import { CharacterItem } from "@/rest/world";

interface CharacterCardProps {
  item: CharacterItem;
  onViewDetail: (item: CharacterItem) => void;
  onEdit: (item: CharacterItem) => void;
  onTogglePin: (item: CharacterItem, e: React.MouseEvent) => void;
  onDelete: (item: CharacterItem, e: React.MouseEvent) => void;
}

export default function CharacterCard({
  item,
  onViewDetail,
  onEdit,
  onTogglePin,
  onDelete,
}: CharacterCardProps) {
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "protagonist":
        return "主角";
      case "major":
        return "重要配角";
      case "antagonist":
        return "反派";
      case "supporting":
        return "配角";
      default:
        return "龙套";
    }
  };

  const formatTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const d = new Date(time);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <Card
      p="10px 14px"
      radius="sm"
      withBorder
      bg="#ffffff"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 96,
        borderColor: item.isPinned ? "#bae6fd" : "#e2e6eaff",
        transition: "all 0.15s ease",
        cursor: "pointer",
      }}
      onClick={() => onViewDetail(item)}
    >
      <Box>
        <Flex justify="space-between" align="center" mb={6}>
          <Group gap={8} align="center" style={{ flex: 1, minWidth: 0 }}>
            <Avatar
              src={item.avatarUrl || undefined}
              radius="xl"
              size={28}
              color="gray"
              styles={{
                placeholder: {
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: "#f8fafc",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                },
              }}
            >
              {item.name ? item.name.slice(0, 1) : "?"}
            </Avatar>

            <Flex align="center" gap={6} style={{ minWidth: 0, flex: 1 }}>
              {item.isPinned ? (
                <Badge size="xs" variant="outline" color="cyan" styles={{ root: { height: 16, padding: "0 4px", fontSize: 9.5, borderColor: "#7dd3fc" } }}>
                  置顶
                </Badge>
              ) : null}
              <Text fz={13.5} fw={700} c="#1e293b" truncate="end">
                {item.name}
              </Text>
              <Text fz={10.5} c="#94a3b8" style={{ border: "1px solid #f1f5f9", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>
                {getRoleLabel(item.roleType)}
              </Text>
            </Flex>
          </Group>

          <Group gap={2} align="center" style={{ flexShrink: 0 }}>
            <Tooltip label={item.isPinned ? "取消置顶" : "置顶角色"} position="top" withArrow offset={4}>
              <ActionIcon
                size="xs"
                variant="subtle"
                color={item.isPinned ? "cyan" : "gray"}
                onClick={(e) => onTogglePin(item, e)}
              >
                <FiBookmark size={13} style={{ fill: item.isPinned ? "currentColor" : "none" }} />
              </ActionIcon>
            </Tooltip>

            <Menu position="bottom-end" shadow="md" width={130}>
              <Menu.Target>
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={(e) => e.stopPropagation()}>
                  <FiMoreHorizontal size={13} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<FiEye size={11} />} onClick={(e) => { e.stopPropagation(); onViewDetail(item); }}>
                  查看详情
                </Menu.Item>
                <Menu.Item leftSection={<FiEdit size={11} />} onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                  编辑档案
                </Menu.Item>
                <Menu.Item color="red" leftSection={<FiTrash2 size={11} />} onClick={(e) => onDelete(item, e)}>
                  删除角色
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Flex>

        <Flex align="center" gap={6} fz={11.5} c="#64748b" mb={4}>
          <Text fz={11.5} truncate="end">
            {item.alias ? `「${item.alias}」` : ""} {item.identity || item.faction || "暂无身份描述"}
          </Text>
        </Flex>

        {item.tags && (
          <Text fz={10.5} c="#94a3b8" truncate="end" mb={4}>
            {item.tags.split(/[,，\s]+/).filter(Boolean).map((t) => `#${t}`).join(" ")}
          </Text>
        )}
      </Box>

      <Flex justify="space-between" align="center" pt={4} style={{ borderTop: "1px solid #f8fafc" }}>
        <Text fz={10} c="#0891b2" truncate="end" style={{ maxWidth: 160 }}>
          {item.appearanceChapters ? `出场：${item.appearanceChapters}` : "全书贯穿"}
        </Text>
        <Text fz={10} c="#cbd5e1">{formatTime(item.updatedAt || item.createdAt)}</Text>
      </Flex>
    </Card>
  );
}
