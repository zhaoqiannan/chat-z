// 组件：笔记列表栏（标题筛选、搜索框、置顶项高亮与相对时间流）
"use client";

import React from "react";
import { Box, Flex, Text, TextInput, Stack, ScrollArea, Paper, Badge } from "@mantine/core";
import { FiSearch, FiBookmark, FiFileText } from "react-icons/fi";
import { NoteData } from "@/rest/project-extensions";

interface NotesListProps {
  category: string;
  notes: NoteData[];
  activeNoteId: number | null;
  searchKey: string;
  loading: boolean;
  onSearchChange: (val: string) => void;
  onSelectNote: (note: NoteData) => void;
}

export default function NotesList({
  category,
  notes,
  activeNoteId,
  searchKey,
  loading,
  onSearchChange,
  onSelectNote,
}: NotesListProps) {
  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case "idea":
        return "灵感";
      case "plot":
        return "情节";
      case "character":
        return "角色";
      case "world":
        return "世界观";
      case "research":
        return "调研";
      case "memo":
        return "随笔";
      case "archived":
        return "已归档";
      default:
        return "全部";
    }
  };

  const formatRelativeTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const now = Date.now();
    const past = new Date(time).getTime();
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return "昨天";
    if (diffDays < 30) return `${diffDays}天前`;
    return `${new Date(time).toLocaleDateString()}`;
  };

  return (
    <Box
      style={{
        width: 320,
        minWidth: 280,
        borderRight: "1px solid #f1f5f9",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
      }}
    >
      <Box p="14px 16px" style={{ borderBottom: "1px solid #f8fafc" }}>
        <Flex justify="space-between" align="center" mb={10}>
          <Text fz={15} fw={700} c="#1e293b">
            {getCategoryLabel(category)}笔记
          </Text>
        </Flex>
        <TextInput
          placeholder="搜索笔记标题、内容..."
          size="xs"
          leftSection={<FiSearch size={13} />}
          value={searchKey}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </Box>

      <ScrollArea style={{ flex: 1 }} p={8}>
        <Stack gap={6}>
          {notes.map((item) => {
            const isSelected = activeNoteId === item.id;
            return (
              <Paper
                key={item.id}
                p="10px 12px"
                radius="md"
                withBorder
                style={{
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#f0f9ff" : "#ffffff",
                  borderColor: isSelected ? "#7dd3fc" : "#f1f5f9",
                  transition: "all 0.15s ease",
                }}
                onClick={() => onSelectNote(item)}
              >
                <Flex justify="space-between" align="flex-start" mb={4}>
                  <Text fz={13.5} fw={700} c="#1e293b" truncate="end" style={{ flex: 1 }}>
                    {item.title || "未命名笔记"}
                  </Text>
                  {item.isPinned ? <FiBookmark size={13} color="#0284c7" style={{ marginLeft: 4, flexShrink: 0 }} /> : null}
                </Flex>

                <Text fz={12} c="#64748b" lineClamp={2} style={{ lineHeight: 1.5, marginBottom: 6 }}>
                  {item.content || "（暂无内容）"}
                </Text>

                <Flex justify="space-between" align="center" fz={10.5} c="#94a3b8">
                  <Text fz={10.5}>{formatRelativeTime(item.updatedAt || item.createdAt)}</Text>
                  <Badge size="xs" variant="outline" color="gray" styles={{ root: { fontSize: 10, height: 16, borderColor: "#e2e8f0" } }}>
                    {getCategoryLabel(item.category)}
                  </Badge>
                </Flex>
              </Paper>
            );
          })}

          {notes.length === 0 && !loading && (
            <Stack align="center" justify="center" p={40} c="#94a3b8" gap={6}>
              <FiFileText size={32} strokeWidth={1.2} />
              <Text fz={12.5}>该分类下暂无笔记</Text>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
