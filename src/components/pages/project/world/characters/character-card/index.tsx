"use client";

import React from "react";
import { Box, Flex, Text, Badge, ActionIcon, Card, Tooltip, Menu, Avatar, Group } from "@mantine/core";
import { FiEdit, FiTrash2, FiBookmark, FiMoreHorizontal, FiEye, FiBookOpen, FiShield } from "react-icons/fi";
import { CharacterItem } from "@/rest/world";

interface CharacterCardProps {
  item: CharacterItem;
  onViewDetail: (item: CharacterItem) => void;
  onEdit: (item: CharacterItem) => void;
  onTogglePin: (item: CharacterItem, e: React.MouseEvent) => void;
  onDelete: (item: CharacterItem, e: React.MouseEvent) => void;
}

const ROLE_NAME_MAP: Record<string, string> = {
  protagonist: "主角",
  major: "重要配角",
  antagonist: "反派",
  supporting: "配角",
  mob: "龙套",
};

export default function CharacterCard({
  item,
  onViewDetail,
  onEdit,
  onTogglePin,
  onDelete,
}: CharacterCardProps) {
  const roleName = ROLE_NAME_MAP[item.roleType] || "配角";
  const tagsList = item.tags ? item.tags.split(/[,，\s]+/).filter(Boolean) : [];
  const oneLineDesc = item.personalIntro || item.personality || item.identity || "";

  return (
    <Card
      p="12px 14px"
      radius="md"
      withBorder
      bg="#ffffff"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 120,
        borderColor: item.isPinned ? "#80e5fa" : "#e2e8f0",
        backgroundColor: item.isPinned ? "#fafdff" : "#ffffff",
        boxShadow: item.isPinned ? "0 2px 10px rgba(0, 201, 255, 0.08)" : "0 1px 3px rgba(0, 0, 0, 0.02)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        position: "relative",
      }}
      styles={{
        root: {
          "&:hover": {
            borderColor: "#00b2e0",
            boxShadow: "0 6px 18px rgba(0, 201, 255, 0.12)",
            transform: "translateY(-2px)",
          },
        },
      }}
      onClick={() => onViewDetail(item)}
    >
      <Box>
        <Flex justify="space-between" align="flex-start" mb={8}>
          <Group gap={10} align="center" style={{ flex: 1, minWidth: 0 }}>
            <Avatar
              src={item.avatarUrl || undefined}
              radius="xl"
              size={36}
              styles={{
                root: {
                  border: "1.5px solid #b3effc",
                  backgroundColor: "#e0f7fc",
                  flexShrink: 0,
                },
                placeholder: {
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#0096bd",
                },
              }}
            >
              {item.name ? item.name.slice(0, 1) : "?"}
            </Avatar>

            <Box style={{ minWidth: 0, flex: 1 }}>
              <Flex align="center" gap={6}>
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
                  variant="light"
                  color="blue"
                  styles={{
                    root: {
                      fontSize: 10.5,
                      height: 18,
                      padding: "0 5px",
                      fontWeight: 600,
                      flexShrink: 0,
                    },
                  }}
                >
                  {roleName}
                </Badge>
              </Flex>

              {item.alias && (
                <Text fz={11.5} c="#64748b" truncate="end" mt={1}>
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
                color={item.isPinned ? "blue" : "gray"}
                onClick={(e) => onTogglePin(item, e)}
              >
                <FiBookmark
                  size={14}
                  style={{
                    fill: item.isPinned ? "#00b2e0" : "none",
                    color: item.isPinned ? "#00b2e0" : "#94a3b8",
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
          <Flex align="center" gap={6} wrap="wrap" mb={6}>
            {item.faction && (
              <Badge
                size="xs"
                variant="outline"
                color="blue"
                leftSection={<FiShield size={9} />}
                styles={{
                  root: {
                    fontSize: 10.5,
                    padding: "0 6px",
                    height: 18,
                    borderColor: "#b3effc",
                    backgroundColor: "#f4fcfe",
                    color: "#0096bd",
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
          <Group gap={4} wrap="wrap" mb={6}>
            {tagsList.slice(0, 3).map((tag, idx) => (
              <Box
                key={idx}
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  padding: "1px 6px",
                  borderRadius: 3,
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
          <Text fz={11} c="#64748b" lineClamp={2} style={{ lineHeight: 1.5, marginBottom: 8 }}>
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
        <Group gap={4} align="center" style={{ minWidth: 0, flex: 1 }}>
          <FiBookOpen size={11.5} color="#0096bd" />
          <Text fz={11} c="#0096bd" fw={500} truncate="end">
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
