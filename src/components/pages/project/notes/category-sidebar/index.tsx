// 组件：笔记分类侧边导航栏（全部/灵感/情节/角色/世界观/调研/已归档与新建入口）
"use client";

import React from "react";
import { Box, Flex, Text, Button, Badge, Stack, ActionIcon, Tooltip, Group } from "@mantine/core";
import { FiSidebar, FiPlus } from "react-icons/fi";

interface CategorySidebarProps {
  selectedCategory: string;
  counts: { all: number; idea: number; plot: number; character: number; world: number; research: number; archived: number };
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectCategory: (cat: string) => void;
  onCreateNewNote: () => void;
}

export default function CategorySidebar({
  selectedCategory,
  counts,
  collapsed = false,
  onToggleCollapse,
  onSelectCategory,
  onCreateNewNote,
}: CategorySidebarProps) {
  const categoriesConfig = [
    { key: "all", label: "全部", count: counts.all },
    { key: "idea", label: "灵感", count: counts.idea },
    { key: "plot", label: "情节", count: counts.plot },
    { key: "character", label: "角色", count: counts.character },
    { key: "world", label: "世界观", count: counts.world },
    { key: "research", label: "调研", count: counts.research },
    { key: "archived", label: "已归档", count: counts.archived },
  ];

  return (
    <Box
      style={{
        width: collapsed ? 0 : 200,
        minWidth: collapsed ? 0 : 200,
        maxWidth: collapsed ? 0 : 200,
        borderRight: collapsed ? "none" : "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        padding: collapsed ? 0 : "12px 10px",
        backgroundColor: "#fafbfc",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden",
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? "none" : "auto",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <Flex justify="space-between" align="center" px={4} mb={10}>
        <Text fz={13} fw={700} c="#334155">
          分类导航
        </Text>
        {onToggleCollapse && (
          <Tooltip label="收起分类栏" position="right" withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCollapse}>
              <FiSidebar size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Flex>

      <Button
        fullWidth

        size="xs"
        leftSection={<FiPlus size={13} />}
        onClick={onCreateNewNote}
        mb="md"
        style={{ fontWeight: 600, height: 32 }}
      >
        新建笔记
      </Button>

      <Stack gap={4} style={{ flex: 1 }}>
        {categoriesConfig.map((cat) => {
          const isActive = selectedCategory === cat.key;
          return (
            <Box
              key={cat.key}
              onClick={() => onSelectCategory(cat.key)}
              p="8px 12px"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: 6,
                cursor: "pointer",
                backgroundColor: isActive ? "#e0f2fe" : "transparent",
                color: isActive ? "#0284c7" : "#475569",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                transition: "all 0.15s ease",
              }}
            >
              <Text fz={13} fw={isActive ? 700 : 500} c={isActive ? "#0284c7" : "#475569"}>
                {cat.label}
              </Text>
              <Badge
                size="xs"
                variant="subtle"
                color={isActive ? "cyan" : "gray"}
                styles={{ root: { fontSize: 11, padding: "0 6px" } }}
              >
                {cat.count}
              </Badge>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
