"use client";

import React from "react";
import { Box, Flex, Text, Badge, Card, Menu, Avatar, Group, ActionIcon, Tooltip } from "@mantine/core";
import { FiBookmark, FiMoreHorizontal } from "react-icons/fi";
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
        backgroundColor: "#ffffff",
        borderColor: item.isPinned ? BRAND.borderMedium : "#edf2f7",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
        transition: "all 0.2s ease",
        cursor: "pointer",
        position: "relative",
      }}
      styles={{
        root: {
          "&:hover": {
            borderColor: BRAND.primary,
            boxShadow: `0 4px 12px ${BRAND.bgLight}`,
            transform: "translateY(-1px)",
          },
        },
      }}
      onClick={() => onViewDetail(item)}
    >
      <Box>
        {/* 第一行：头像（avatar-circle）+ 姓名（显示全不省略）+ 置顶图标 + 更多按钮 */}
        <Flex justify="space-between" align="center" mb={10}>
          <Group gap={10} align="center" style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Avatar
              src={item.avatarUrl || undefined}
              radius="100%"
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

            <Text
              fz={14.5}
              fw={700}
              c="#0f172a"
              style={{
                lineHeight: 1.35,
                wordBreak: "break-word",
              }}
            >
              {item.name}
            </Text>
          </Group>

          <Group gap={4} align="center" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <Tooltip label={item.isPinned ? "取消置顶" : "置顶角色"} position="top" withArrow offset={4}>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={(e) => onTogglePin(item, e)}
                styles={{
                  root: {
                    color: item.isPinned ? BRAND.primary : "#94a3b8",
                    "&:hover": {
                      backgroundColor: BRAND.bgLight,
                    },
                  },
                }}
              >
                <FiBookmark
                  size={15}
                  style={{
                    fill: item.isPinned ? BRAND.primary : "none",
                  }}
                />
              </ActionIcon>
            </Tooltip>

            <Menu position="bottom-end" shadow="md" width={110}>
              <Menu.Target>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  styles={{
                    root: {
                      color: "#94a3b8",
                      "&:hover": {
                        backgroundColor: "#f1f5f9",
                        color: "#0f172a",
                      },
                    },
                  }}
                >
                  <FiMoreHorizontal size={15} />
                </ActionIcon>
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

        {/* 第二行：性别、定位、年龄、身份等，比标签颜色稍深的 Badge 显示 */}
        <Flex align="center" gap={6} wrap="wrap" mb={10}>
          <Badge
            size="xs"
            styles={{
              root: {
                fontSize: 11,
                height: 20,
                padding: "0 7px",
                fontWeight: isProtagonist ? 600 : 500,
                backgroundColor: isProtagonist ? BRAND.bgMedium : BRAND.bgLight,
                border: `1px solid ${isProtagonist ? BRAND.borderMedium : BRAND.borderLight}`,
                color: isProtagonist ? BRAND.textDark : BRAND.text,
              },
            }}
          >
            {roleName}
          </Badge>

          {item.gender && (
            <Badge
              size="xs"
              styles={{
                root: {
                  fontSize: 11,
                  height: 20,
                  padding: "0 7px",
                  fontWeight: 500,
                  backgroundColor: BRAND.bgLight,
                  border: `1px solid ${BRAND.borderLight}`,
                  color: BRAND.text,
                },
              }}
            >
              {item.gender}
            </Badge>
          )}

          {item.age && (
            <Badge
              size="xs"
              styles={{
                root: {
                  fontSize: 11,
                  height: 20,
                  padding: "0 7px",
                  fontWeight: 500,
                  backgroundColor: BRAND.bgLight,
                  border: `1px solid ${BRAND.borderLight}`,
                  color: BRAND.text,
                },
              }}
            >
              {item.age.includes("岁") ? item.age : `${item.age}岁`}
            </Badge>
          )}

          {item.identity && (
            <Badge
              size="xs"
              styles={{
                root: {
                  fontSize: 11,
                  height: 20,
                  padding: "0 7px",
                  fontWeight: 500,
                  backgroundColor: BRAND.bgLight,
                  border: `1px solid ${BRAND.borderLight}`,
                  color: BRAND.text,
                },
              }}
            >
              {item.identity}
            </Badge>
          )}

          {item.faction && (
            <Badge
              size="xs"
              styles={{
                root: {
                  fontSize: 11,
                  height: 20,
                  padding: "0 7px",
                  fontWeight: 500,
                  backgroundColor: BRAND.bgLight,
                  border: `1px solid ${BRAND.borderLight}`,
                  color: BRAND.text,
                },
              }}
            >
              {item.faction}
            </Badge>
          )}
        </Flex>

        {/* 标签以下部分保持现有 */}
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

      {/* 底部出场章节与详情链接保持现有 */}
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
