"use client";

import React from "react";
import { Box, Flex, Text, Badge, Card, Menu, Avatar, Group, Button } from "@mantine/core";
import { CharacterItem } from "@/rest/world";
import { ROLE_NAME_MAP, BRAND } from "../constants";

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
  const roleName = ROLE_NAME_MAP[item.roleType] || "配角";
  const tagsList = item.tags ? item.tags.split(/[,，\s]+/).filter(Boolean) : [];
  const oneLineDesc = item.personalIntro || item.personality || item.identity || "";
  const isProtagonist = item.roleType === "protagonist";

  return (
    <Card
      p="14px 16px"
      radius="md"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 124,
        backgroundColor: item.isPinned ? BRAND.bgSubtle : "#ffffff",
        borderColor: item.isPinned ? BRAND.borderMedium : "#e8ecf0",
        boxShadow: item.isPinned ? `0 1px 4px ${BRAND.bgLight}` : "0 1px 2px rgba(0, 0, 0, 0.02)",
        transition: "all 0.2s ease",
        cursor: "pointer",
        position: "relative",
      }}
      styles={{
        root: {
          "&:hover": {
            borderColor: BRAND.primary,
            boxShadow: `0 4px 14px ${BRAND.bgLight}`,
            transform: "translateY(-1px)",
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
              size={36}
              styles={{
                root: {
                  backgroundColor: BRAND.bgLight,
                  border: `1px solid ${BRAND.borderLight}`,
                  flexShrink: 0,
                },
                placeholder: {
                  fontSize: 14,
                  fontWeight: 700,
                  color: BRAND.text,
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
                      fontWeight: isProtagonist ? 700 : 500,
                      flexShrink: 0,
                      backgroundColor: isProtagonist ? BRAND.bgMedium : BRAND.bgLight,
                      border: `1px solid ${isProtagonist ? BRAND.borderMedium : BRAND.borderLight}`,
                      color: isProtagonist ? BRAND.textDark : BRAND.text,
                    },
                  }}
                >
                  {roleName}
                </Badge>
              </Flex>

              {item.alias && (
                <Text fz={11.5} c="#64748b" truncate="end" mt={2}>
                  尊号：{item.alias}
                </Text>
              )}
            </Box>
          </Group>

          <Group gap={4} align="center" style={{ flexShrink: 0 }} ml={4} onClick={(e) => e.stopPropagation()}>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={(e) => onTogglePin(item, e)}
              styles={{
                root: {
                  fontSize: 10.5,
                  height: 20,
                  padding: "0 5px",
                  color: item.isPinned ? BRAND.text : "#94a3b8",
                  backgroundColor: item.isPinned ? BRAND.bgLight : "transparent",
                  fontWeight: item.isPinned ? 600 : 400,
                  "&:hover": {
                    backgroundColor: BRAND.bgLight,
                    color: BRAND.text,
                  },
                },
              }}
            >
              {item.isPinned ? "已置顶" : "置顶"}
            </Button>

            <Menu position="bottom-end" shadow="md" width={100}>
              <Menu.Target>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  styles={{
                    root: {
                      fontSize: 11,
                      height: 20,
                      padding: "0 4px",
                      color: "#94a3b8",
                      letterSpacing: 1,
                      "&:hover": {
                        backgroundColor: "#f1f5f9",
                        color: "#0f172a",
                      },
                    },
                  }}
                >
                  ···
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => onViewDetail(item)}>
                  查看档案
                </Menu.Item>
                <Menu.Item onClick={() => onEdit(item)}>
                  编辑档案
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={(e) => onDelete(item, e)}>
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
                styles={{
                  root: {
                    fontSize: 10.5,
                    padding: "0 6px",
                    height: 18,
                    borderColor: BRAND.borderLight,
                    backgroundColor: BRAND.bgSubtle,
                    color: BRAND.text,
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
        <Text fz={11} c="#64748b" fw={500} truncate="end" style={{ flex: 1, minWidth: 0 }}>
          {item.appearanceChapters ? `出场：${item.appearanceChapters}` : "全书贯穿"}
        </Text>
        <Text fz={10.5} c={BRAND.text} fw={500} style={{ flexShrink: 0 }}>
          查看详情 →
        </Text>
      </Flex>
    </Card>
  );
}
