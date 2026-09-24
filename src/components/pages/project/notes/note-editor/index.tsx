// 组件：笔记详情与沉浸编辑区（大标题、分类选择、正文Textarea与多维实体大纲转换操作栏）
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Box, Flex, Text, Button, ActionIcon, TextInput, Textarea, Select, ScrollArea, Group, Tooltip, Badge, Menu } from "@mantine/core";
import { FiTrash2, FiBookmark, FiArchive, FiLayers, FiBookOpen, FiUser, FiFileText, FiSidebar, FiSave, FiMoreHorizontal } from "react-icons/fi";
import { NoteData, updateNote } from "@/rest/project-extensions";
import { createCharacter } from "@/rest/world";
import { createChapter } from "@/rest/chapter";
import { createOutlineNode } from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";

interface NoteEditorProps {
  workId: string;
  activeNote: NoteData | null;
  saving: boolean;
  categorySidebarCollapsed?: boolean;
  onToggleCategorySidebar?: () => void;
  onUpdateSuccess: () => Promise<void>;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export default function NoteEditor({
  workId,
  activeNote,
  saving,
  categorySidebarCollapsed = false,
  onToggleCategorySidebar,
  onUpdateSuccess,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("idea");
  const [localSaving, setLocalSaving] = useState(false);

  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title || "");
      setContent(activeNote.content || "");
      setCategory(activeNote.category || "idea");
    } else {
      setTitle("");
      setContent("");
      setCategory("idea");
    }
  }, [activeNote?.id]);

  const isDirty = useMemo(() => {
    if (!activeNote) return false;
    return (
      title !== (activeNote.title || "") ||
      content !== (activeNote.content || "") ||
      category !== (activeNote.category || "idea")
    );
  }, [activeNote, title, content, category]);

  const handleSave = async () => {
    if (!activeNote) return;
    try {
      setLocalSaving(true);
      await updateNote({
        id: activeNote.id,
        title: title.trim() || activeNote.title,
        content,
        category,
      });
      useAlert.success("笔记已保存");
      await onUpdateSuccess();
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setLocalSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  const handleConvertToCharacter = async () => {
    if (!activeNote || !workId) return;
    try {
      await createCharacter({
        workId: Number(workId),
        name: activeNote.title,
        description: activeNote.content,
        roleType: "major",
      });
      useAlert.success("已成功将该笔记转为「角色设定」！可在世界观->角色库中查看。");
    } catch (e: any) {
      useAlert.error("转换失败: " + (e?.message || "网络异常"));
    }
  };

  const handleConvertToOutline = async () => {
    if (!activeNote || !workId) return;
    try {
      await createOutlineNode({
        workId: Number(workId),
        title: activeNote.title,
        eventDescription: activeNote.content,
        goal: activeNote.title,
        type: "scene",
      });
      useAlert.success("已成功将该笔记转为「大纲剧情节点」！可在大纲树中查看。");
    } catch (e: any) {
      useAlert.error("转换失败: " + (e?.message || "网络异常"));
    }
  };

  const handleConvertToChapter = async () => {
    if (!activeNote || !workId) return;
    try {
      await createChapter({
        workId: Number(workId),
        title: activeNote.title,
        summary: activeNote.content.slice(0, 200),
        content: activeNote.content,
        isVolume: 0,
      });
      useAlert.success("已成功将该笔记转为「章节规划」！可在章节列表中查看。");
    } catch (e: any) {
      useAlert.error("转换失败: " + (e?.message || "网络异常"));
    }
  };

  const formatRelativeTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const now = Date.now();
    const past = new Date(time).getTime();
    const diffMs = now - past;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "刚刚";
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    return `${new Date(time).toLocaleDateString()}`;
  };

  if (!activeNote) {
    return (
      <Box style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#ffffff" }}>
        {onToggleCategorySidebar && (
          <Flex align="center" px={16} py={10} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <Tooltip label={categorySidebarCollapsed ? "展开分类栏" : "收起分类栏"} position="bottom" withArrow>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCategorySidebar}>
                <FiSidebar size={15} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        )}
        <Flex style={{ flex: 1 }} justify="center" align="center" direction="column" gap="sm">
          <FiFileText size={48} color="#cbd5e1" />
          <Text fz={14} fw={600} c="#94a3b8">请选择或新建一条笔记查看详情</Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box
      onKeyDown={handleKeyDown}
      style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#ffffff" }}
    >
      {/* 顶部面包屑与操作栏 */}
      <Flex justify="space-between" align="center" px={18} py={10} style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Group gap={8} align="center">
          {onToggleCategorySidebar && (
            <Tooltip label={categorySidebarCollapsed ? "展开分类栏" : "收起分类栏"} position="bottom" withArrow>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCategorySidebar}>
                <FiSidebar size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          <Text fz={12.5} c="#94a3b8">随笔笔记</Text>
          <Text fz={12.5} c="#cbd5e1">/</Text>
          <Text fz={13} fw={600} c="#334155" lineClamp={1}>
            {title || activeNote.title || "未命名笔记"}
          </Text>
          {isDirty && (
            <Badge size="xs" color="orange" variant="light" styles={{ root: { fontSize: 10, padding: "0 6px" } }}>
              未保存
            </Badge>
          )}
        </Group>

        <Group gap="xs" align="center">
          <Button
            size="xs"
            variant={isDirty ? "filled" : "light"}
            color={isDirty ? "blue" : "gray"}
            leftSection={<FiSave size={12} />}
            onClick={handleSave}
            loading={saving || localSaving}
            styles={{ root: { height: 28, fontWeight: 600 } }}
            title="快捷键 Ctrl+S / Cmd+S"
          >
            {isDirty ? "保存" : "已保存"}
          </Button>

          <Button
            size="xs"
            variant={Boolean(activeNote.isPinned) ? "filled" : "default"}
            color={Boolean(activeNote.isPinned) ? "cyan" : "gray"}
            leftSection={<FiBookmark size={12} />}
            onClick={onTogglePin}
            styles={{ root: { height: 28 } }}
          >
            {Boolean(activeNote.isPinned) ? "已置顶" : "置顶"}
          </Button>

          <Button
            size="xs"
            variant={Boolean(activeNote.isArchived) ? "filled" : "default"}
            color="gray"
            leftSection={<FiArchive size={12} />}
            onClick={onToggleArchive}
            styles={{ root: { height: 28 } }}
          >
            {Boolean(activeNote.isArchived) ? "取消归档" : "归档"}
          </Button>

          <Menu shadow="md" width={180} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="default" size="sm" styles={{ root: { height: 28, width: 28 } }} title="更多操作">
                <FiMoreHorizontal size={14} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>实体转化与沉淀</Menu.Label>
              <Menu.Item
                leftSection={<FiUser size={13} color="#ec4899" />}
                onClick={handleConvertToCharacter}
              >
                转为角色设定
              </Menu.Item>
              <Menu.Item
                leftSection={<FiLayers size={13} color="#3b82f6" />}
                onClick={handleConvertToOutline}
              >
                转为大纲剧情
              </Menu.Item>
              <Menu.Item
                leftSection={<FiBookOpen size={13} color="#10b981" />}
                onClick={handleConvertToChapter}
              >
                转为章节规划
              </Menu.Item>

              <Menu.Divider />

              <Menu.Item
                color="red"
                leftSection={<FiTrash2 size={13} />}
                onClick={onDelete}
              >
                删除笔记
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Flex>

      <Box p="16px 28px 12px 28px" style={{ borderBottom: "1px solid #f8fafc" }}>
        <TextInput
          variant="unstyled"
          placeholder="笔记标题..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          styles={{
            input: {
              fontSize: 22,
              fontWeight: 800,
              color: "#0f172a",
              padding: 0,
            },
          }}
        />

        <Group gap="md" align="center" mt={8}>
          <Select
            size="xs"
            variant="unstyled"
            value={category}
            onChange={(val) => {
              if (val) {
                setCategory(val);
              }
            }}
            data={[
              { value: "idea", label: "灵感" },
              { value: "plot", label: "情节" },
              { value: "character", label: "角色" },
              { value: "world", label: "世界观" },
              { value: "research", label: "调研" },
              { value: "memo", label: "随笔" },
            ]}
            styles={{
              input: {
                fontSize: 11.5,
                fontWeight: 600,
                color: "#0284c7",
                backgroundColor: "#e0f2fe",
                borderRadius: 4,
                padding: "2px 8px",
                width: 80,
              },
            }}
          />

          <Text fz={11.5} c="#64748b" fw={500}>
            {content ? content.length : 0} 字
          </Text>
          <Text fz={11.5} c="#cbd5e1">·</Text>
          <Text fz={11.5} c="#94a3b8">
            创建于 {formatRelativeTime(activeNote.createdAt)}
          </Text>
          <Text fz={11.5} c="#cbd5e1">·</Text>
          <Text fz={11.5} c="#94a3b8">
            修改于 {formatRelativeTime(activeNote.updatedAt || activeNote.createdAt)}
          </Text>
        </Group>
      </Box>

      <ScrollArea style={{ flex: 1 }} p="20px 28px">
        <Textarea
          variant="unstyled"
          autosize
          minRows={24}
          placeholder="在此输入笔记详细内容、大纲推演或灵感草稿..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          styles={{
            input: {
              fontSize: 15,
              lineHeight: 1.8,
              color: "#334155",
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              padding: 0,
            },
          }}
        />
      </ScrollArea>
    </Box>
  );
}
