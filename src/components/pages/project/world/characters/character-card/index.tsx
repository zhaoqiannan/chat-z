"use client";

import React from "react";
import { Box, Flex, Text, Badge, ActionIcon, Card, Tooltip, Menu, Avatar, Group } from "@mantine/core";
import { FiEdit, FiTrash2, FiBookmark, FiMoreHorizontal, FiEye, FiBookOpen, FiShield } from "react-icons/fi";
import { CharacterItem } from "@/rest/world";
import { ROLE_THEME_MAP, DEFAULT_ROLE_THEME } from "../constants";

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
  const roleTheme = ROLE_THEME_MAP[item.roleType] || DEFAULT_ROLE_THEME;
  const tagsList = item.tags ? item.tags.split(/[,，\s]+/).filter(Boolean) : [];
  const oneLineDesc = item.personalIntro || item.personality || item.identity || "";

  return (
    <Card
      p="14px 16px"
      radius="md"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 128,
        borderColor: item.isPinned ? "#cbd5e1" : "#e2e8f0",
        backgroundColor: item.isPinned ? "#fafbfc" : "#ffffff",
        boxShadow: item.isPinned ? "0 2px 6px rgba(15, 23, 42, 0.05)" : "0 1px 3px rgba(15, 23, 42, 0.03)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        position: "relative",
      }}
      styles={{
        root: {
          "&:hover": {
            borderColor: "#94a3b8",
            boxShadow: "0 6px 18px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)",
            transform: "translateY(-2px)",
          },
        },
      }}
      onClick={() => onViewDetail(item)}
    >
      <Box>
        <Flex justify="space-between" align="flex-start" mb={10}>
          <Group gap={10} align="center" style={{ flex: 1, minWidth: 0 }}>
            <Avatar
              src={item.avatarUrl || undefined}
              radius="xl"
              size={38}
              styles={{
                root: {
                  border: `1.5px solid ${roleTheme.avatarBorder}`,
                  backgroundColor: roleTheme.avatarBg,
                  flexShrink: 0,
                },
                placeholder: {
                  fontSize: 14,
                  fontWeight: 700,
                  color: roleTheme.avatarColor,
                },
              }}
            >
              {item.name ? item.name.slice(0, 1) : "?"}
            </Avatar>

            <Box style={{ minWidth: 0, flex: 1 }}>
              <Flex align="center" gap={6} wrap="nowrap">
                <Text fz={14.5} fw={700} c="#0f172a" truncate="end">
                  {item.name}
                </Text>
                {item.gender && (
                  <Text fz={11} c="#94a3b8" style={{ flexShrink: 0 }}>
                    ({item.gender})
                  </Text>
                )}
                <Badge
                  size="xs"
                  styles={{
                    root: {
                      fontSize: 10.5,
                      height: 18,
                      padding: "0 6px",
                      fontWeight: 600,
                      flexShrink: 0,
                      backgroundColor: roleTheme.badgeBg,
                      border: `1px solid ${roleTheme.badgeBorder}`,
                      color: roleTheme.badgeColor,
                    },
                  }}
                >
                  {item.roleType === "protagonist" && "👑 "}
                  {roleTheme.name}
                </Badge>
              </Flex>

              {item.alias && (
                <Text fz={11.5} c="#64748b" truncate="end" mt={2}>
                  尊号：{item.alias}
                </Text>
              )}
            </Box>
          </Group>

          <Group gap={4} align="center" style={{ flexShrink: 0 }} ml={4}>
            <Tooltip label={item.isPinned ? "取消置顶" : "置顶角色"} position="top" withArrow offset={4}>
              <ActionIcon
                size="xs"
                variant="subtle"
                color={item.isPinned ? "yellow" : "gray"}
                onClick={(e) => onTogglePin(item, e)}
              >
                <FiBookmark
                  size={14}
                  style={{
                    fill: item.isPinned ? "#f59e0b" : "none",
                    color: item.isPinned ? "#f59e0b" : "#94a3b8",
                  }}
                />
              </ActionIcon>
            </Tooltip>

            <Menu position="bottom-end" shadow="md" width={120}>
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FiMoreHorizontal size={14} color="#94a3b8" />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<FiEye size={12} />} onClick={(e) => { e.stopPropagation(); onViewDetail(item); }}>
                  查看档案
                </Menu.Item>
                <Menu.Item leftSection={<FiEdit size={12} />} onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                  编辑档案
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<FiTrash2 size={12} />} onClick={(e) => onDelete(item, e)}>
                  删除角色
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Flex>

        {(item.faction || item.identity) && (
          <Flex align="center" gap={6} wrap="wrap" mb={8}>
            {item.faction && (
              <Badge
                size="xs"
                variant="outline"
                leftSection={<FiShield size={9.5} />}
                styles={{
                  root: {
                    fontSize: 10.5,
                    padding: "0 6px",
                    height: 18,
                    borderColor: "#e2e8f0",
                    backgroundColor: "#f8fafc",
                    color: "#475569",
                    fontWeight: 500,
                  },
                }}
              >
                {item.faction}
              </Badge>
            )}

            {item.identity && (
              <Text fz={11.5} c="#475569" truncate="end" style={{ maxWidth: 160 }}>
                {item.identity}
              </Text>
            )}
          </Flex>
        )}

        {tagsList.length > 0 && (
          <Group gap={4} wrap="wrap" mb={8}>
            {tagsList.slice(0, 3).map((tag, idx) => (
              <Box
                key={idx}
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                #{tag}
              </Box>
            ))}
            {tagsList.length > 3 && (
              <Text fz={10} c="#94a3b8">
                +{tagsList.length - 3}
              </Text>
            )}
          </Group>
        )}

        {oneLineDesc && (
          <Text fz={11} c="#64748b" lineClamp={2} style={{ lineHeight: 1.55, marginBottom: 8 }}>
            {oneLineDesc}
          </Text>
        )}
      </Box>

      <Flex
        justify="space-between"
        align="center"
        pt={8}
        style={{ borderTop: "1px solid #f1f5f9" }}
      >
        <Group gap={5} align="center" style={{ minWidth: 0, flex: 1 }}>
          <FiBookOpen size={12} color="#64748b" />
          <Text fz={11} c="#64748b" fw={500} truncate="end">
            {item.appearanceChapters ? `出场：${item.appearanceChapters}` : "全书贯穿"}
          </Text>
        </Group>
        <Text fz={10.5} c="#94a3b8" style={{ flexShrink: 0 }}>
          查看详情 →
        </Text>
      </Flex>
    </Card>
  );
}
