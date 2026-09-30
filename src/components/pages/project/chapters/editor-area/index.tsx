// 组件：居中沉浸式章节文本编辑区（目录展开开关、面包屑导航、段落自动缩进与一键智能排版、光标精准插入、Ctrl/Cmd+S保存、上次保存时间、全高沉浸写作）
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Flex, Text, Button, ActionIcon, Tooltip, TextInput, Textarea, Group, ScrollArea, Badge, Menu, Paper, Stack } from "@mantine/core";
import { FiSave, FiZap, FiFileText, FiMoreHorizontal, FiSidebar, FiBookmark, FiClock, FiAlignLeft, FiLayers, FiTrash2, FiCopy, FiAlignJustify, FiMinimize2 } from "react-icons/fi";
import { ChapterItem, createChapterVersion, ActiveAiTask, HIGHLIGHT_COLORS } from "@/rest/chapter";
import { extractChapterOutline } from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
import DrawerVersionHistory from "../drawer-version-history";
import DrawerMemoryFragments from "../drawer-memory-fragments";

interface EditorAreaProps {
  chapter: ChapterItem | null;
  workId: number | string;
  treeCollapsed?: boolean;
  aiPanelCollapsed?: boolean;
  aiPanelWidth?: number;
  onToggleTree?: () => void;
  onUpdateChapter: (fields: Partial<ChapterItem>) => Promise<void>;
  onSelectionChange?: (selectedText: string) => void;
  onTriggerAiAction?: (actionType: string, selectedText: string) => void;
  activeTasks?: ActiveAiTask[];
  onToggleAiPanel?: () => void;
  insertTextPayload?: { text: string; targetSnippet?: string; timestamp: number } | null;
  locateSnippetPayload?: { snippet: string; timestamp: number } | null;
  targetWords?: number;
  onDirtyChange?: (isDirty: boolean) => void;
  onDeleteChapter?: (chapterId: number | string) => void;
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

export default function EditorArea({
  chapter,
  workId,
  treeCollapsed = false,
  aiPanelCollapsed = true,
  aiPanelWidth = 360,
  onToggleTree,
  onUpdateChapter,
  onSelectionChange,
  onTriggerAiAction,
  activeTasks = [],
  onToggleAiPanel,
  insertTextPayload,
  locateSnippetPayload,
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
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const editorViewportRef = useRef<HTMLDivElement>(null);
  const lastCursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastPayloadTimestampRef = useRef<number>(0);
  const lastLocateTimestampRef = useRef<number>(0);

  // 触发 autosize textarea 重新计算高度与重排
  const refreshTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, 600)}px`;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    window.dispatchEvent(new Event("resize"));
  }, []);

  // 监听容器尺寸变化（左侧目录展开/收起、右侧 AI 面板拖拽或折叠、视口变化）
  useEffect(() => {
    const el = containerRef.current;
    const viewEl = editorViewportRef.current;
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      refreshTextareaHeight();
    });

    if (el) observer.observe(el);
    if (viewEl) observer.observe(viewEl);

    return () => observer.disconnect();
  }, [refreshTextareaHeight]);

  // 当目录折叠状态或 AI 面板折叠/宽度改变时，延时多次刷新以配合 CSS 动画过渡
  useEffect(() => {
    refreshTextareaHeight();
    const timers = [
      setTimeout(refreshTextareaHeight, 20),
      setTimeout(refreshTextareaHeight, 80),
      setTimeout(refreshTextareaHeight, 180),
      setTimeout(refreshTextareaHeight, 300),
      setTimeout(refreshTextareaHeight, 450),
    ];
    return () => timers.forEach(clearTimeout);
  }, [treeCollapsed, aiPanelCollapsed, aiPanelWidth, content, refreshTextareaHeight]);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title || "");
      setSubtitle(chapter.subtitle || "");
      setContent(chapter.content || "");
      setLastSavedAt(chapter.updatedAt || chapter.createdAt || null);
      lastCursorRef.current = { start: chapter.content?.length || 0, end: chapter.content?.length || 0 };
      if (onSelectionChange) onSelectionChange("");
      setTimeout(refreshTextareaHeight, 30);
    }
  }, [chapter?.id, refreshTextareaHeight]);

  // 全局关闭右键菜单监听
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

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

  const applyAiText = useCallback((textToInsert: string, targetSnippet?: string) => {
    setContent((prevContent) => {
      const current = prevContent || "";
      const el = textareaRef.current;

      // 1. 如果存在明确的目标片段，优先精确/模糊替换目标文本
      if (targetSnippet && targetSnippet.trim()) {
        const cleanSnippet = targetSnippet.trim();
        let startIdx = current.indexOf(cleanSnippet);
        let matchLength = cleanSnippet.length;

        // 尝试去除换行差异等空白干扰
        if (startIdx === -1) {
          const noCrCurrent = current.replace(/\r/g, "");
          const noCrSnippet = cleanSnippet.replace(/\r/g, "");
          const idx = noCrCurrent.indexOf(noCrSnippet);
          if (idx !== -1) {
            startIdx = idx;
            matchLength = noCrSnippet.length;
          } else {
            // 尝试头尾锚点匹配
            const prefix = cleanSnippet.slice(0, Math.min(20, cleanSnippet.length));
            const prefixIdx = current.indexOf(prefix);
            if (prefixIdx !== -1) {
              const suffix = cleanSnippet.slice(-Math.min(20, cleanSnippet.length));
              const suffixIdx = current.indexOf(suffix, prefixIdx);
              if (suffixIdx !== -1) {
                startIdx = prefixIdx;
                matchLength = suffixIdx + suffix.length - prefixIdx;
              }
            }
          }
        }

        if (startIdx !== -1) {
          const nextContent = current.substring(0, startIdx) + textToInsert + current.substring(startIdx + matchLength);
          const nextCursorPos = startIdx + textToInsert.length;
          lastCursorRef.current = { start: nextCursorPos, end: nextCursorPos };
          const scrollPos = editorViewportRef.current?.scrollTop;
          useAlert.success("已精准替换所选协同文本！");
          setTimeout(() => {
            if (el) {
              el.focus({ preventScroll: true });
              el.setSelectionRange(nextCursorPos, nextCursorPos);
            }
            if (editorViewportRef.current && scrollPos !== undefined) {
              editorViewportRef.current.scrollTop = scrollPos;
            }
          }, 20);
          return nextContent;
        }
      }

      // 2. 回退：在当前光标处精准插入或追加
      if (!el) {
        useAlert.success("已采纳写入正文！");
        return current ? `${current}\n\n${textToInsert}` : textToInsert;
      }

      const start = lastCursorRef.current.start ?? el.selectionStart ?? current.length;
      const end = lastCursorRef.current.end ?? el.selectionEnd ?? current.length;
      const nextContent = current.substring(0, start) + textToInsert + current.substring(end);
      const nextCursorPos = start + textToInsert.length;
      lastCursorRef.current = { start: nextCursorPos, end: nextCursorPos };
      const scrollPos = editorViewportRef.current?.scrollTop;
      useAlert.success("已采纳写入正文！");

      setTimeout(() => {
        if (el) {
          el.focus({ preventScroll: true });
          el.setSelectionRange(nextCursorPos, nextCursorPos);
        }
        if (editorViewportRef.current && scrollPos !== undefined) {
          editorViewportRef.current.scrollTop = scrollPos;
        }
      }, 0);

      return nextContent;
    });
  }, []);

  useEffect(() => {
    if (insertTextPayload && insertTextPayload.text && insertTextPayload.timestamp !== lastPayloadTimestampRef.current) {
      lastPayloadTimestampRef.current = insertTextPayload.timestamp;
      applyAiText(insertTextPayload.text, insertTextPayload.targetSnippet);
    }
  }, [insertTextPayload, applyAiText]);

  // 定位正文划选片段并平滑滚动
  useEffect(() => {
    if (locateSnippetPayload && locateSnippetPayload.snippet && locateSnippetPayload.timestamp !== lastLocateTimestampRef.current) {
      lastLocateTimestampRef.current = locateSnippetPayload.timestamp;
      const snippet = locateSnippetPayload.snippet.trim();
      const current = content;
      if (!snippet || !current) return;

      let idx = current.indexOf(snippet);
      let matchLen = snippet.length;

      if (idx === -1) {
        const noCrCurrent = current.replace(/\r/g, "");
        const noCrSnippet = snippet.replace(/\r/g, "");
        idx = noCrCurrent.indexOf(noCrSnippet);
        if (idx !== -1) {
          matchLen = noCrSnippet.length;
        }
      }

      if (idx !== -1) {
        const el = textareaRef.current;
        if (el) {
          el.focus({ preventScroll: true });
          el.setSelectionRange(idx, idx + matchLen);
          lastCursorRef.current = { start: idx, end: idx + matchLen };

          const charRatio = idx / Math.max(1, current.length);
          const totalHeight = el.scrollHeight || 1000;
          const targetScroll = Math.max(0, charRatio * totalHeight - 140);

          editorViewportRef.current?.scrollTo({
            top: targetScroll,
            behavior: "smooth",
          });

          useAlert.info("已定位到该片段！");
        }
      } else {
        useAlert.warning("正文中未找到完全匹配的片段（可能已被修改）");
      }
    }
  }, [locateSnippetPayload, content]);

  const liveWordCount = content.replace(/\s+/g, "").length;

  const handleFormatIndent = () => {
    if (!content) return;
    const formatted = content
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.replace(/^[ 　\t]+/, "").trimEnd();
        return trimmed ? `　　${trimmed}` : "";
      })
      .join("\n");
    setContent(formatted);
    setTimeout(refreshTextareaHeight, 20);
    useAlert.success("已完成一键段首缩进");
  };

  const handleFormatDoubleNewline = () => {
    if (!content) return;
    const validLines = content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");

    if (validLines.length === 0) return;

    const formatted = validLines.join("\n\n");
    setContent(formatted);
    setTimeout(refreshTextareaHeight, 20);
    useAlert.success("已完成整理分段（段落间空一行）");
  };

  const handleFormatCompactNewline = () => {
    if (!content) return;
    const validLines = content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");

    if (validLines.length === 0) return;

    const formatted = validLines.join("\n");
    setContent(formatted);
    setTimeout(refreshTextareaHeight, 20);
    useAlert.success("已取消段间空行（恢复紧凑段落）");
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = textareaRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    const selected = el ? el.value.substring(start, end).trim() : "";

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      selectedText: selected,
    });
  };

  const renderHighlightedBackdrop = (text: string, tasks: ActiveAiTask[] = []) => {
    if (!text) return null;
    if (!tasks || tasks.length === 0) {
      return <span>{text}</span>;
    }

    interface MatchSpan {
      start: number;
      end: number;
      color: (typeof HIGHLIGHT_COLORS)[0];
      id: string | number;
    }

    const matches: MatchSpan[] = [];

    tasks.forEach((task) => {
      if (!task.snippet || !task.snippet.trim()) return;
      const cleanSnippet = task.snippet.trim();
      let idx = text.indexOf(cleanSnippet);
      if (idx !== -1) {
        matches.push({
          start: idx,
          end: idx + cleanSnippet.length,
          color: HIGHLIGHT_COLORS[task.colorIndex % HIGHLIGHT_COLORS.length],
          id: task.id,
        });
      }
    });

    if (matches.length === 0) {
      return <span>{text}</span>;
    }

    // 按起始位置升序排序
    matches.sort((a, b) => a.start - b.start);

    // 过滤重叠区间
    const nonOverlapping: MatchSpan[] = [];
    let lastEnd = 0;
    matches.forEach((m) => {
      if (m.start >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.end;
      }
    });

    const nodes: React.ReactNode[] = [];
    let currentIdx = 0;

    nonOverlapping.forEach((m, i) => {
      if (m.start > currentIdx) {
        nodes.push(<span key={`plain-${i}`}>{text.substring(currentIdx, m.start)}</span>);
      }
      nodes.push(
        <mark
          key={`mark-${m.id}-${i}`}
          style={{
            backgroundColor: m.color.bg,
            borderBottom: `2px solid ${m.color.border}`,
            borderRadius: "3px",
            color: "transparent",
            padding: "1px 0",
          }}
        >
          {text.substring(m.start, m.end)}
        </mark>
      );
      currentIdx = m.end;
    });

    if (currentIdx < text.length) {
      nodes.push(<span key="plain-tail">{text.substring(currentIdx)}</span>);
    }

    return nodes;
  };

  const handleRestoreVersion = async (restoredContent: string) => {
    setContent(restoredContent);
    await onUpdateChapter({ content: restoredContent, wordCount: restoredContent.replace(/\s+/g, "").length });
    setTimeout(refreshTextareaHeight, 30);
  };

  const handleInsertFragment = (fragmentContent: string) => {
    applyAiText(fragmentContent);
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

          <Menu position="bottom-end" shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="default" size="sm" styles={{ root: { height: 28, width: 28 } }} title="更多操作">
                <FiMoreHorizontal size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>文本排版</Menu.Label>
              <Menu.Item
                leftSection={<FiAlignLeft size={13} color="#0891b2" />}
                onClick={handleFormatIndent}
              >
                一键段首缩进
              </Menu.Item>
              <Menu.Item
                leftSection={<FiAlignJustify size={13} color="#6366f1" />}
                onClick={handleFormatDoubleNewline}
              >
                整理分段 (段间空行)
              </Menu.Item>
              <Menu.Item
                leftSection={<FiMinimize2 size={13} color="#8b5cf6" />}
                onClick={handleFormatCompactNewline}
              >
                取消分段 (紧凑段落)
              </Menu.Item>

              <Menu.Divider />

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
        viewportRef={editorViewportRef}
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

          <Box
            style={{ position: "relative", marginTop: 4 }}
            onContextMenu={handleContextMenu}
          >
            {/* 高亮背景衬底层 (Backdrop Highlight Layer) */}
            <div
              ref={backdropRef}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                fontSize: 16,
                lineHeight: 1.9,
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: "8px 0",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "transparent",
                pointerEvents: "none",
                zIndex: 1,
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {renderHighlightedBackdrop(content, activeTasks)}
            </div>

            {/* 前台文本编辑区 (透明背景确保原生打字与高亮对齐) */}
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
                setContextMenu(null);
              }}
              onKeyDown={(e) => {
                handleKeyDown(e);
                if (e.key === "Escape") {
                  setContextMenu(null);
                }
              }}
              onSelect={handleTrackCursor}
              onMouseUp={handleTrackCursor}
              onKeyUp={handleTrackCursor}
              onClick={() => {
                handleTrackCursor();
                setContextMenu(null);
              }}
              onContextMenu={handleContextMenu}
              styles={{
                input: {
                  fontSize: 16,
                  lineHeight: 1.9,
                  color: "#334155",
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  padding: "8px 0",
                  backgroundColor: "transparent",
                  position: "relative",
                  zIndex: 2,
                },
              }}
            />
          </Box>
        </Box>
      </ScrollArea>

      {/* 自定义右键快捷操作菜单 (彻底拦截并替代原生弹窗) */}
      {contextMenu && (
        <Paper
          shadow="xl"
          radius="md"
          p={6}
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 190),
            top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 260),
            zIndex: 1000,
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            minWidth: 175,
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.16)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Stack gap={2}>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              justify="flex-start"
              leftSection={<FiCopy size={13} color="#475569" />}
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) {
                  navigator.clipboard.writeText(txt);
                  useAlert.success(contextMenu.selectedText ? "已复制选中文本到剪贴板" : "已复制全篇内容到剪贴板");
                }
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, color: "#334155", fontWeight: 500 } }}
            >
              复制 {contextMenu.selectedText ? "选中文本" : "全篇内容"}
            </Button>

            <Box style={{ height: 1, backgroundColor: "#f1f5f9", margin: "3px 0" }} />

            <Button
              size="xs"
              variant="subtle"
              color="blue"
              justify="flex-start"
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) onTriggerAiAction?.("polish", txt);
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, fontWeight: 500 } }}
            >
              ✨ 文学润色
            </Button>

            <Button
              size="xs"
              variant="subtle"
              color="teal"
              justify="flex-start"
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) onTriggerAiAction?.("expand", txt);
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, fontWeight: 500 } }}
            >
              🌱 场景扩写
            </Button>

            <Button
              size="xs"
              variant="subtle"
              color="orange"
              justify="flex-start"
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) onTriggerAiAction?.("shorten", txt);
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, fontWeight: 500 } }}
            >
              ✂️ 精简去水
            </Button>

            <Button
              size="xs"
              variant="subtle"
              color="grape"
              justify="flex-start"
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) onTriggerAiAction?.("tone", txt);
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, fontWeight: 500 } }}
            >
              🎭 语气重塑
            </Button>

            <Button
              size="xs"
              variant="subtle"
              color="red"
              justify="flex-start"
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) onTriggerAiAction?.("critique", txt);
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, fontWeight: 500 } }}
            >
              🔍 逻辑审查
            </Button>

            <Box style={{ height: 1, backgroundColor: "#f1f5f9", margin: "3px 0" }} />

            <Button
              size="xs"
              variant="subtle"
              color="indigo"
              justify="flex-start"
              onClick={() => {
                const txt = contextMenu.selectedText || content;
                if (txt) onTriggerAiAction?.("custom_focus", txt);
                setContextMenu(null);
              }}
              styles={{ root: { height: 28, fontSize: 12, fontWeight: 500 } }}
            >
              💬 自定义调整诉求...
            </Button>
          </Stack>
        </Paper>
      )}

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
