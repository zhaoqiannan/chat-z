// 组件：居中沉浸式章节文本编辑区（目录展开开关、面包屑导航、段落自动缩进与一键智能排版、光标精准插入、Ctrl/Cmd+S保存、上次保存时间、全高沉浸写作）
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Flex, Text, Button, ActionIcon, Tooltip, TextInput, Textarea, Group, ScrollArea, Badge, Menu } from "@mantine/core";
import { FiSave, FiZap, FiFileText, FiMoreHorizontal, FiSidebar, FiBookmark, FiClock, FiAlignLeft, FiLayers, FiTrash2 } from "react-icons/fi";
import { ChapterItem, createChapterVersion } from "@/rest/chapter";
import { extractChapterOutline } from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
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
  onDirtyChange?: (isDirty: boolean) => void;
  onDeleteChapter?: (chapterId: number | string) => void;
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
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
  onDirtyChange,
  onDeleteChapter,
  saveRef,
}: EditorAreaProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [extractingOutline, setExtractingOutline] = useState(false);
  const [versionDrawerOpened, setVersionDrawerOpened] = useState(false);
  const [fragmentDrawerOpened, setFragmentDrawerOpened] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | string | number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // 触发 autosize textarea 重新计算高度与重排
  const refreshTextareaHeight = useCallback(() => {
    window.dispatchEvent(new Event("resize"));
    if (textareaRef.current) {
      textareaRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, []);

  // 监听容器尺寸变化（左侧目录展开/收起、右侧 AI 面板拖拽或折叠）
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      refreshTextareaHeight();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [refreshTextareaHeight]);

  // 当目录折叠状态改变时，延时多次刷新以配合 CSS 动画过渡
  useEffect(() => {
    const timers = [
      setTimeout(refreshTextareaHeight, 30),
      setTimeout(refreshTextareaHeight, 100),
      setTimeout(refreshTextareaHeight, 250),
      setTimeout(refreshTextareaHeight, 400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [treeCollapsed, refreshTextareaHeight]);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title || "");
      setSubtitle(chapter.subtitle || "");
      setContent(chapter.content || "");
      setLastSavedAt(chapter.updatedAt || chapter.createdAt || null);
      lastCursorRef.current = { start: chapter.content?.length || 0, end: chapter.content?.length || 0 };
      if (onSelectionChange) onSelectionChange("");
      setTimeout(refreshTextareaHeight, 50);
    }
  }, [chapter?.id, refreshTextareaHeight]);

  const isDirty = useMemo(() => {
    if (!chapter) return false;
    return (
      title !== (chapter.title || "") ||
      subtitle !== (chapter.subtitle || "") ||
      content !== (chapter.content || "")
    );
  }, [chapter, title, subtitle, content]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
      refreshTextareaHeight();
    }, 0);
  };

  useEffect(() => {
    if (insertTextPayload && insertTextPayload.text) {
      insertAtCursor(insertTextPayload.text);
    }
  }, [insertTextPayload]);

  const liveWordCount = content.replace(/\s+/g, "").length;

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
    setTimeout(refreshTextareaHeight, 20);
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
        refreshTextareaHeight();
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
        refreshTextareaHeight();
      }, 0);
    }
  };

  const handleManualSave = useCallback(async (): Promise<boolean> => {
    if (!chapter) return false;
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

      setLastSavedAt(new Date());
      useAlert.success("章节保存成功！");
      return true;
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [chapter, title, subtitle, content, liveWordCount, onUpdateChapter, workId]);

  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleManualSave;
    }
    return () => {
      if (saveRef) {
        saveRef.current = null;
      }
    };
  }, [saveRef, handleManualSave]);

  // 全局快捷键保存 (兼容 macOS 的 Cmd+S 与 Windows/Linux 的 Ctrl+S)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        handleManualSave();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, [handleManualSave]);

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
    setTimeout(refreshTextareaHeight, 30);
  };

  const handleInsertFragment = (fragmentContent: string) => {
    insertAtCursor(fragmentContent);
  };

  const handleExtractToOutline = async () => {
    if (!chapter) return;
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length < 30) {
      useAlert.warning("本章正文内容过短，写满一段后再提取大纲吧！");
      return;
    }

    try {
      setExtractingOutline(true);
      const res = await extractChapterOutline({
        chapterId: chapter.id,
        workId,
        content: cleanContent,
        title: title.trim() || chapter.title,
      });

      if (res && res.success) {
        useAlert.success("已提炼本章核心剧情并同步至大纲故事轴！");
      } else {
        useAlert.error("提取大纲失败: " + (res?.message || "网络异常"));
      }
    } catch (e: any) {
      useAlert.error("提取异常: " + (e?.message || "网络错误"));
    } finally {
      setExtractingOutline(false);
    }
  };

  const formatExactDateTime = (dateVal?: string | number | Date | null) => {
    if (!dateVal) return "未记录";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "未记录";
    const YYYY = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
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
    <Box
      ref={containerRef}
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* 顶部面包屑与工具栏 */}
      <Flex justify="space-between" align="center" px={16} py={10} style={{ borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
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
          {isDirty && (
            <Badge size="xs" color="orange" variant="light" styles={{ root: { fontSize: 10, padding: "0 6px" } }}>
              未保存
            </Badge>
          )}
        </Group>

        <Group gap="xs" align="center">
          <Group gap={6} align="center" mr="xs">
            <Box style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: isDirty ? "#f59e0b" : "#10b981" }} />
            <Text fz={12} c="#64748b">{liveWordCount.toLocaleString()} 字 / 目标 {targetWords.toLocaleString()} 字</Text>
          </Group>

          <Tooltip label="一键智能排版（所有段首缩进2空格）" position="bottom">
            <Button
              size="xs"
              variant="default"
              leftSection={<FiAlignLeft size={13} color="#0891b2" />}
              onClick={handleFormatIndent}
              styles={{ root: { borderColor: "#e2e8f0", height: 28 } }}
            >
              一键缩进
            </Button>
          </Tooltip>

          <Button
            size="xs"
            variant={isDirty ? "filled" : "light"}
            color={isDirty ? "blue" : "gray"}
            leftSection={<FiSave size={12} />}
            loading={saving}
            onClick={handleManualSave}
            styles={{ root: { height: 28, fontWeight: 600 } }}
            title="快捷键 Ctrl+S / Cmd+S"
          >
            {isDirty ? "保存" : "已保存"}
          </Button>

          <Menu position="bottom-end" shadow="md" width={180}>
            <Menu.Target>
              <ActionIcon variant="default" size="sm" styles={{ root: { height: 28, width: 28 } }} title="更多操作">
                <FiMoreHorizontal size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>智能与辅助</Menu.Label>
              <Menu.Item
                leftSection={<FiLayers size={13} color="#16a34a" />}
                onClick={handleExtractToOutline}
                disabled={extractingOutline}
              >
                {extractingOutline ? "提取大纲中..." : "提取剧情到大纲"}
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

              {onDeleteChapter && (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<FiTrash2 size={13} />}
                    onClick={() => onDeleteChapter(chapter.id)}
                  >
                    删除本章
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Flex>

      {/* 沉浸式正文全高滚动区域 */}
      <ScrollArea
        style={{ flex: 1, height: "100%" }}
        p={{ base: "md", md: 24 }}
        styles={{
          viewport: {
            paddingBottom: 0,
          },
        }}
      >
        <Box
          style={{
            margin: "0 auto",
            maxWidth: 820,
            minHeight: "calc(100vh - 120px)",
            paddingBottom: "25vh",
            position: "relative",
          }}
        >
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
                padding: "0 0 4px 0",
              },
            }}
          />

          {/* 上次保存时间与状态提示 */}
          <Group gap="xs" align="center" mt={4} mb={12}>
            <Group gap={4} align="center">
              <FiClock size={11.5} color="#94a3b8" />
              <Text fz={11.5} c="#94a3b8">
                上次修改时间：{formatExactDateTime(lastSavedAt || chapter.updatedAt || chapter.createdAt)}
              </Text>
            </Group>
          </Group>

          <Box style={{ position: "relative", marginTop: 4 }}>
            <Textarea
              ref={textareaRef}
              variant="unstyled"
              autosize
              minRows={26}
              placeholder="在此开始撰写正文（回车自动段首缩进两格，支持 Ctrl+S / Cmd+S 快速保存）..."
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
                  padding: "8px 0",
                },
              }}
            />
          </Box>
        </Box>
      </ScrollArea>

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
