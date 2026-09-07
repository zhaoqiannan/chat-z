// 组件：笔记树级菜单导航（树状文件夹收折分类、快捷添加、置顶标记与实时搜索过滤）
"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Stack,
  ActionIcon,
  Tooltip,
  Group,
  TextInput,
  ScrollArea,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import {
  FiChevronRight,
  FiChevronDown,
  FiPlus,
  FiSearch,
  FiFileText,
  FiBookmark,
  FiFolder,
  FiFolderMinus,
  FiArchive,
  FiZap,
  FiBook,
  FiUser,
  FiGlobe,
  FiSearch as FiResearch,
  FiEdit3,
} from "react-icons/fi";
import { NoteData } from "@/rest/project-extensions";

export interface NoteTreeMenuProps {
  notes: NoteData[];
  activeNoteId: number | null;
  loading: boolean;
  onSelectNote: (note: NoteData) => void;
  onCreateNewNote: (category?: string) => void;
}

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORY_DEFINITIONS: CategoryDef[] = [
  { key: "idea", label: "灵感脑洞", icon: <FiZap size={13} />, color: "#eab308" },
  { key: "plot", label: "大纲情节", icon: <FiBook size={13} />, color: "#3b82f6" },
  { key: "character", label: "角色随笔", icon: <FiUser size={13} />, color: "#ec4899" },
  { key: "world", label: "世界设定", icon: <FiGlobe size={13} />, color: "#10b981" },
  { key: "research", label: "资料考据", icon: <FiResearch size={13} />, color: "#8b5cf6" },
  { key: "memo", label: "随想杂记", icon: <FiEdit3 size={13} />, color: "#06b6d4" },
  { key: "archived", label: "归档备忘", icon: <FiArchive size={13} />, color: "#64748b" },
];

export default function NoteTreeMenu({
  notes,
  activeNoteId,
  loading,
  onSelectNote,
  onCreateNewNote,
}: NoteTreeMenuProps) {
  const [searchKey, setSearchKey] = useState("");
  // 记录各分类文件夹的展开/折叠状态（默认全部展开）
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    idea: true,
    plot: true,
    character: true,
    world: true,
    research: true,
    memo: true,
    archived: false,
  });

  const toggleCategory = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 根据搜索关键字过滤笔记
  const filteredNotes = useMemo(() => {
    if (!searchKey.trim()) return notes;
    const lower = searchKey.toLowerCase().trim();
    return notes.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(lower)) ||
        (n.content && n.content.toLowerCase().includes(lower))
    );
  }, [notes, searchKey]);

  // 按分类分组笔记
  const groupedNotes = useMemo(() => {
    const groups: Record<string, NoteData[]> = {
      idea: [],
      plot: [],
      character: [],
      world: [],
      research: [],
      memo: [],
      archived: [],
    };

    filteredNotes.forEach((note) => {
      if (note.isArchived) {
        groups.archived.push(note);
      } else {
        const cat = note.category || "idea";
        if (groups[cat]) {
          groups[cat].push(note);
        } else {
          groups.idea.push(note);
        }
      }
    });

    // 置顶项排在前面
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    });

    return groups;
  }, [filteredNotes]);

  const isSearching = searchKey.trim().length > 0;

  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8fafc",
        borderRight: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      {/* 头部控制栏：新建与搜索 */}
      <Box p="12px 14px 10px" style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#ffffff" }}>
        <Flex justify="space-between" align="center" mb={10}>
          <Text fz={13.5} fw={700} c="#1e293b">
            随笔与笔记库
          </Text>
          <Badge size="xs" variant="light" >
            {notes.length} 篇
          </Badge>
        </Flex>

        <Button
          fullWidth
          size="xs"

          leftSection={<FiPlus size={13} />}
          onClick={() => onCreateNewNote("idea")}
          mb={8}
          styles={{ root: { height: 30, fontWeight: 600 } }}
        >
          新建灵感随笔
        </Button>

        <TextInput
          placeholder="搜索笔记标题或内容..."
          size="xs"
          leftSection={<FiSearch size={13} />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          styles={{
            input: {
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              fontSize: 12,
            },
          }}
        />
      </Box>

      {/* 树状结构节点区 */}
      <ScrollArea style={{ flex: 1 }} p="8px 6px">
        <Stack gap={3}>
          {CATEGORY_DEFINITIONS.map((cat) => {
            const list = groupedNotes[cat.key] || [];
            const isExpanded = isSearching ? true : !!expandedCategories[cat.key];
            const hasChildren = list.length > 0;

            return (
              <Box key={cat.key} style={{ borderRadius: 6, overflow: "hidden" }}>
                {/* 树分类目录节点 */}
                <Box
                  onClick={() => toggleCategory(cat.key)}
                  p="5px 8px"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    borderRadius: 6,
                    backgroundColor: isExpanded ? "#f1f5f9" : "transparent",
                    transition: "all 0.15s ease",
                    userSelect: "none",
                  }}
                >
                  <Group gap={6} align="center" style={{ flex: 1, minWidth: 0 }}>
                    <Box style={{ color: "#64748b", display: "flex", alignItems: "center" }}>
                      {isExpanded ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}
                    </Box>
                    <Box style={{ color: cat.color, display: "flex", alignItems: "center" }}>
                      {cat.icon}
                    </Box>
                    <Text fz={12.5} fw={600} c="#334155" truncate="end">
                      {cat.label}
                    </Text>
                  </Group>

                  <Group gap={4} align="center">
                    <Badge
                      size="xs"
                      variant="subtle"
                      color="gray"
                      styles={{ root: { fontSize: 10, padding: "0 5px", height: 16 } }}
                    >
                      {list.length}
                    </Badge>
                    {cat.key !== "archived" && (
                      <Tooltip label={`在「${cat.label}」下新建`} position="top" withArrow>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateNewNote(cat.key);
                          }}
                        >
                          <FiPlus size={11} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Box>

                {/* 子节点：该分类下的笔记列表 */}
                <Collapse expanded={isExpanded}>
                  <Box pl={18} pr={2} py={2}>
                    <Stack gap={2}>
                      {list.map((note) => {
                        const isSelected = activeNoteId === note.id;
                        return (
                          <Box
                            key={note.id}
                            onClick={() => onSelectNote(note)}
                            p="6px 8px"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              borderRadius: 6,
                              cursor: "pointer",
                              backgroundColor: isSelected ? "#e0f2fe" : "transparent",
                              borderLeft: isSelected ? "3px solid #0284c7" : "3px solid transparent",
                              transition: "all 0.12s ease",
                            }}
                          >
                            <Group gap={6} align="center" style={{ flex: 1, minWidth: 0 }}>
                              <FiFileText
                                size={12}
                                color={isSelected ? "#0284c7" : "#94a3b8"}
                                style={{ flexShrink: 0 }}
                              />
                              <Text
                                fz={12}
                                fw={isSelected ? 700 : 500}
                                c={isSelected ? "#0369a1" : "#475569"}
                                truncate="end"
                                style={{ flex: 1 }}
                              >
                                {note.title || "未命名笔记"}
                              </Text>
                            </Group>

                            {note.isPinned && (
                              <FiBookmark
                                size={11}
                                color="#0284c7"
                                style={{ flexShrink: 0, marginLeft: 4 }}
                              />
                            )}
                          </Box>
                        );
                      })}

                      {list.length === 0 && (
                        <Text fz={11} c="#cbd5e1" pl={6} py={4}>
                          (暂无笔记)
                        </Text>
                      )}
                    </Stack>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
