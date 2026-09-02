// 组件：居中沉浸式章节文本编辑区（目录展开开关、面包屑导航、段落自动缩进与一键智能排版、光标精准插入、记忆碎片与版本快照历史）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Button, ActionIcon, Tooltip, TextInput, Textarea, Group, ScrollArea, Progress, Menu } from "@mantine/core";
import { FiSave, FiZap, FiFileText, FiMoreHorizontal, FiSidebar, FiBookmark, FiClock, FiAlignLeft } from "react-icons/fi";
import { ChapterItem, createChapterVersion } from "@/rest/chapter";
import DrawerVersionHistory from "../drawer-version-history";
import DrawerMemoryFragments from "../drawer-memory-fragments";

interface EditorAreaProps {
  chapter: ChapterItem | null;
  workId: number | string;
  treeCollapsed?: boolean;
  onToggleTree?: () => void;
  onUpdateChapter: (fields: Partial<ChapterItem>) => Promise<void>;
  onSelectionChange?: (selectedText: string) => void;
  onToggleAiPanel?: () => void;
  insertTextPayload?: { text: string; timestamp: number } | null;
  targetWords?: number;
}

export default function EditorArea({
  chapter,
  workId,
  treeCollapsed = false,
  onToggleTree,
  onUpdateChapter,
  onSelectionChange,
  onToggleAiPanel,
  insertTextPayload,
  targetWords = 4000,
}: EditorAreaProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [versionDrawerOpened, setVersionDrawerOpened] = useState(false);
  const [fragmentDrawerOpened, setFragmentDrawerOpened] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title || "");
      setSubtitle(chapter.subtitle || "");
      setContent(chapter.content || "");
      lastCursorRef.current = { start: chapter.content?.length || 0, end: chapter.content?.length || 0 };
      if (onSelectionChange) onSelectionChange("");
    }
  }, [chapter?.id]);

  const insertAtCursor = (textToInsert: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => (prev ? `${prev}\n\n${textToInsert}` : textToInsert));
      return;
    }

    const start = lastCursorRef.current.start ?? el.selectionStart ?? el.value.length;
    const end = lastCursorRef.current.end ?? el.selectionEnd ?? el.value.length;
    const current = content;
    const nextContent = current.substring(0, start) + textToInsert + current.substring(end);
    setContent(nextContent);

    const nextCursorPos = start + textToInsert.length;
    lastCursorRef.current = { start: nextCursorPos, end: nextCursorPos };

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(nextCursorPos, nextCursorPos);
    }, 0);
  };

  useEffect(() => {
    if (insertTextPayload && insertTextPayload.text) {
      insertAtCursor(insertTextPayload.text);
    }
  }, [insertTextPayload]);

  const liveWordCount = content.replace(/\s+/g, "").length;
  const progressPercent = Math.min(Math.round((liveWordCount / Math.max(targetWords, 1)) * 100), 100);

  const handleFormatIndent = () => {
    if (!content) return;
    const formatted = content
      .split("\n")
      .map((line) => {
        const trimmed = line.replace(/^[ 　\t]+/, "").trimEnd();
        return trimmed ? `　　${trimmed}` : "";
      })
      .join("\n");
    setContent(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.nativeEvent as any).isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? content.length;
      const end = el.selectionEnd ?? content.length;
      const indent = "　　";
      const nextContent = content.substring(0, start) + indent + content.substring(end);
      setContent(nextContent);
      const nextPos = start + indent.length;
      lastCursorRef.current = { start: nextPos, end: nextPos };
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      }, 0);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart ?? content.length;
      const end = el.selectionEnd ?? content.length;

      const beforeCursor = content.substring(0, start);
      const currentLine = beforeCursor.split("\n").pop() || "";

      let indent = "\n　　";
      if (currentLine.trim() === "") {
        indent = "\n";
      }

      const nextContent = content.substring(0, start) + indent + content.substring(end);
      setContent(nextContent);

      const nextPos = start + indent.length;
      lastCursorRef.current = { start: nextPos, end: nextPos };

      setTimeout(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      }, 0);
    }
  };

  const handleManualSave = async () => {
    if (!chapter) return;
    try {
      setSaving(true);
      await onUpdateChapter({
        title: title.trim() || chapter.title,
        subtitle: subtitle.trim() || undefined,
        content,
        wordCount: liveWordCount,
      });

      try {
        await createChapterVersion({
          workId: Number(workId),
          chapterId: Number(chapter.id),
          title: title.trim() || chapter.title,
          content,
          wordCount: liveWordCount,
          versionTag: "手动保存快照",
        });
      } catch (_) { }
    } catch (e: any) {
      alert("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleTrackCursor = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    lastCursorRef.current = { start, end };
    const text = el.value.substring(start, end).trim();
    if (onSelectionChange) {
      onSelectionChange(text.length >= 2 ? text : "");
    }
  };

  const handleRestoreVersion = async (restoredContent: string) => {
    setContent(restoredContent);
    await onUpdateChapter({ content: restoredContent, wordCount: restoredContent.replace(/\s+/g, "").length });
  };

  const handleInsertFragment = (fragmentContent: string) => {
    insertAtCursor(fragmentContent);
  };

  if (!chapter) {
    return (
      <Flex style={{ flex: 1, height: "100%" }} justify="center" align="center" direction="column" gap="sm">
        <FiFileText size={48} color="#cbd5e1" />
        <Text fz={15} fw={600} c="#94a3b8">请在左侧选择或新建章节开始创作</Text>
      </Flex>
    );
  }

  return (
    <Box style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", overflow: "hidden" }}>
      <Flex justify="space-between" align="center" px={14} py={10} style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Group gap={8} align="center">
          {onToggleTree && (
            <Tooltip label={treeCollapsed ? "展开目录大纲" : "收起目录大纲"} position="bottom">
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleTree}>
                <FiSidebar size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          <Text fz={12.5} c="#94a3b8">章节</Text>
          <Text fz={12.5} c="#cbd5e1">/</Text>
          <Text fz={13} fw={600} c="#334155">第{chapter.chapterNumber}章 · {title || chapter.title}</Text>
        </Group>

        <Group gap="xs" align="center">
          <Group gap={6} align="center" mr="xs">
            <Box style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#10b981" }} />
            <Text fz={12} c="#64748b">{liveWordCount.toLocaleString()} 字 / 目标 {targetWords.toLocaleString()} 字</Text>
          </Group>

          <Tooltip label="一键智能排版（所有段首缩进2空格）" position="bottom">
            <Button
              size="xs"
              variant="default"
              leftSection={<FiAlignLeft size={13} color="#0891b2" />}
              onClick={handleFormatIndent}
              styles={{ root: { borderColor: "#e2e8f0" } }}
            >
              一键缩进
            </Button>
          </Tooltip>

          <Button
            size="xs"
            variant="light"
            color="cyan"
            leftSection={<FiSave size={12} />}
            loading={saving}
            onClick={handleManualSave}
          >
            保存
          </Button>

          <Menu position="bottom-end" shadow="md" width={180}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <FiMoreHorizontal size={15} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<FiAlignLeft size={13} color="#0891b2" />} onClick={handleFormatIndent}>
                段首智能缩进排版
              </Menu.Item>
              <Menu.Item leftSection={<FiZap size={13} color="#0284c7" />} onClick={onToggleAiPanel}>
                唤起 AI 协同助手
              </Menu.Item>
              <Menu.Item leftSection={<FiBookmark size={13} color="#06b6d4" />} onClick={() => setFragmentDrawerOpened(true)}>
                记忆碎片灵感库
              </Menu.Item>
              <Menu.Item leftSection={<FiClock size={13} color="#64748b" />} onClick={() => setVersionDrawerOpened(true)}>
                版本生成历史
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Flex>

      <ScrollArea style={{ flex: 1 }} p={{ base: "md", md: 14 }}>
        <Box style={{ margin: "0 auto", minHeight: "calc(100vh - 180px)", position: "relative" }}>
          <TextInput
            variant="unstyled"
            placeholder="输入章节标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            styles={{
              input: {
                fontSize: 24,
                fontWeight: 800,
                color: "#0f172a",
              },
            }}
          />
          <TextInput
            variant="unstyled"
            placeholder="添加小标题 / 章节副标题 (选填)..."
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            styles={{
              input: {
                fontSize: 14,
                color: "#64748b",
                padding: "0 0 8px 0",
              },
            }}
          />

          <Box style={{ position: "relative", marginTop: 8 }}>
            <Textarea
              ref={textareaRef}
              variant="unstyled"
              autosize
              minRows={22}
              placeholder="在此开始撰写正文（回车自动段首缩进两格）..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                handleTrackCursor();
              }}
              onKeyDown={handleKeyDown}
              onSelect={handleTrackCursor}
              onMouseUp={handleTrackCursor}
              onKeyUp={handleTrackCursor}
              onClick={handleTrackCursor}
              styles={{
                input: {
                  fontSize: 16,
                  lineHeight: 1.9,
                  color: "#334155",
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  padding: "10px 0",
                },
              }}
            />
          </Box>
        </Box>
      </ScrollArea>

      <Flex justify="space-between" align="center" px="xl" py={8} style={{ borderTop: "1px solid #f1f5f9", backgroundColor: "#ffffff" }}>
        <Group gap="xs" align="center">
          <Text fz={12} c="#64748b">{liveWordCount.toLocaleString()} 字</Text>
          <Text fz={12} c="#cbd5e1">|</Text>
          <Text fz={12} c="#64748b">目标 {targetWords.toLocaleString()} 字</Text>
          <Box style={{ width: 60, marginLeft: 4 }}>
            <Progress value={progressPercent} size="xs" color="cyan" radius="xl" />
          </Box>
        </Group>

        <Group gap="md" align="center">
          <Text fz={11.5} c="#94a3b8">提示: 回车自动缩进 · 顶部提供「一键缩进」排版</Text>
          <Tooltip label="唤起/收起 AI 协同助手" position="top">
            <ActionIcon variant="subtle" color="cyan" size="sm" onClick={onToggleAiPanel}>
              <FiZap size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Flex>

      <DrawerVersionHistory
        opened={versionDrawerOpened}
        onClose={() => setVersionDrawerOpened(false)}
        chapterId={chapter.id}
        onRestoreVersion={handleRestoreVersion}
      />

      <DrawerMemoryFragments
        opened={fragmentDrawerOpened}
        onClose={() => setFragmentDrawerOpened(false)}
        workId={workId}
        chapterId={chapter.id}
        onInsertToContent={handleInsertFragment}
      />
    </Box>
  );
}
