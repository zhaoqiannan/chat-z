// 组件：笔记详情与沉浸编辑区（大标题、分类选择、正文Textarea与多维实体大纲转换操作栏）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, ActionIcon, TextInput, Textarea, Select, ScrollArea, Group } from "@mantine/core";
import { FiTrash2, FiBookmark, FiArchive, FiLayers, FiBookOpen, FiUser, FiFileText } from "react-icons/fi";
import { NoteData, updateNote } from "@/rest/project-extensions";
import { createCharacter } from "@/rest/world";
import { createChapter } from "@/rest/chapter";
import { createOutlineNode } from "@/rest/outline";

interface NoteEditorProps {
  workId: string;
  activeNote: NoteData | null;
  saving: boolean;
  onUpdateSuccess: () => Promise<void>;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export default function NoteEditor({
  workId,
  activeNote,
  saving,
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
      await onUpdateSuccess();
    } catch (e: any) {
      alert("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setLocalSaving(false);
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
      alert("已成功将该笔记转为「角色设定」！可在世界观->角色库中查看。");
    } catch (e: any) {
      alert("转换失败: " + (e?.message || "网络异常"));
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
      alert("已成功将该笔记转为「大纲剧情节点」！可在大纲树中查看。");
    } catch (e: any) {
      alert("转换失败: " + (e?.message || "网络异常"));
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
      alert("已成功将该笔记转为「章节规划」！可在章节列表中查看。");
    } catch (e: any) {
      alert("转换失败: " + (e?.message || "网络异常"));
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
      <Flex style={{ flex: 1 }} justify="center" align="center" direction="column" gap="sm">
        <FiFileText size={48} color="#cbd5e1" />
        <Text fz={14} fw={600} c="#94a3b8">请选择或新建一条笔记查看详情</Text>
      </Flex>
    );
  }

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      <Box p="20px 28px 12px 28px" style={{ borderBottom: "1px solid #f8fafc" }}>
        <TextInput
          variant="unstyled"
          placeholder="笔记标题..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
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
                updateNote({ id: activeNote.id, category: val }).then(onUpdateSuccess);
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
          minRows={20}
          placeholder="在此输入笔记详细内容、大纲推演或灵感草稿..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleSave}
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

      <Flex justify="space-between" align="center" px="28px" py={12} style={{ borderTop: "1px solid #f1f5f9", backgroundColor: "#fafbfc" }}>
        <Group gap={8} wrap="wrap">
          <Button
            size="xs"
            variant={activeNote.isPinned ? "filled" : "default"}
            color={activeNote.isPinned ? "cyan" : "gray"}
            leftSection={<FiBookmark size={12} />}
            onClick={onTogglePin}
          >
            {activeNote.isPinned ? "已置顶" : "置顶"}
          </Button>

          <Button
            size="xs"
            variant={activeNote.isArchived ? "filled" : "default"}
            color={activeNote.isArchived ? "gray" : "gray"}
            leftSection={<FiArchive size={12} />}
            onClick={onToggleArchive}
          >
            {activeNote.isArchived ? "取消归档" : "归档"}
          </Button>

          <Button size="xs" variant="default" leftSection={<FiUser size={12} />} onClick={handleConvertToCharacter}>
            转为实体
          </Button>

          <Button size="xs" variant="default" leftSection={<FiLayers size={12} />} onClick={handleConvertToOutline}>
            转为大纲节点
          </Button>

          <Button size="xs" variant="default" leftSection={<FiBookOpen size={12} />} onClick={handleConvertToChapter}>
            转为章节规划
          </Button>
        </Group>

        <Group gap="xs">
          <Button size="xs" color="cyan" onClick={handleSave} loading={saving || localSaving}>
            保存更改
          </Button>
          <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete}>
            <FiTrash2 size={14} />
          </ActionIcon>
        </Group>
      </Flex>
    </Box>
  );
}
