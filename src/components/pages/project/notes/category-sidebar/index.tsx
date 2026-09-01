// 组件：笔记分类侧边导航栏（全部/灵感/情节/角色/世界观/调研/已归档与新建入口）
"use client";

import React from "react";
import { Box, Text, Button, Badge, Stack } from "@mantine/core";

interface CategorySidebarProps {
  selectedCategory: string;
  counts: { all: number; idea: number; plot: number; character: number; world: number; research: number; archived: number };
  onSelectCategory: (cat: string) => void;
  onCreateNewNote: () => void;
}

export default function CategorySidebar({
  selectedCategory,
  counts,
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
        width: 200,
        minWidth: 180,
        borderRight: "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        backgroundColor: "#fafbfc",
      }}
    >
      <Button
        fullWidth
        color="cyan"
        size="sm"
        leftSection={<Box style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ffffff" }} />}
        onClick={onCreateNewNote}
        mb="lg"
        style={{ fontWeight: 600 }}
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
