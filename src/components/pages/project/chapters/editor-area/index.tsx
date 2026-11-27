// 组件：居中沉浸式章节文本编辑区（划词悬浮快捷 AI 工具条、卡文一键续写、安全采纳与一键撤销、Ctrl/Cmd+S 快捷保存）
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Flex, Text, Button, ActionIcon, Tooltip, TextInput, Textarea, Group, ScrollArea, Badge, Menu, Paper } from "@mantine/core";
import { FiSave, FiZap, FiFileText, FiMoreHorizontal, FiSidebar, FiBookmark, FiClock, FiAlignLeft, FiLayers, FiTrash2, FiCopy, FiMinimize2, FiRotateCcw, FiChevronDown } from "react-icons/fi";
import { ChapterItem, createChapterVersion, ActiveAiTask, ChapterAiApplyMode, HIGHLIGHT_COLORS } from "@/rest/chapter";
import { extractChapterOutline } from "@/rest/outline";
import { useAlert } from "@/hooks/useAlert";
import { countWords, formatDateTime, copyToClipboard } from "@/utils/text";
import DrawerVersionHistory from "../drawer-version-history";
import DrawerMemoryFragments from "../drawer-memory-fragments";
import SelectionBubbleBar from "./SelectionBubbleBar";

interface EditorAreaProps {
  chapter: ChapterItem | null;
  workId: number | string;
  treeCollapsed?: boolean;
  aiPanelCollapsed?: boolean;
  aiPanelWidth?: number;
  onToggleTree?: () => void;
  onUpdateChapter: (fields: Partial<ChapterItem>) => Promise<void>;
  onContentChange?: (content: string) => void;
  onSelectionChange?: (selectedText: string) => void;
  onTriggerAiAction?: (actionType: string, selectedText: string, subMode?: string) => void;
  activeTasks?: ActiveAiTask[];
  onToggleAiPanel?: () => void;
  insertTextPayload?: { text: string; mode: ChapterAiApplyMode; targetSnippet?: string; timestamp: number } | null;
  locateSnippetPayload?: { snippet: string; timestamp: number } | null;
  targetWords?: number;
  onDirtyChange?: (isDirty: boolean) => void;
  onDeleteChapter?: (chapterId: number | string) => void;
  onOutlineExtracted?: (chapterId: number | string) => void;
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

function locateSnippetInText(current: string, snippet: string): { start: number; length: number } | null {
  const cleanSnippet = snippet.trim();
  if (!cleanSnippet) return null;

  const exactIdx = current.indexOf(cleanSnippet);
  if (exactIdx !== -1) return { start: exactIdx, length: cleanSnippet.length };

  const noCrCurrent = current.replace(/\r/g, "");
  const noCrSnippet = cleanSnippet.replace(/\r/g, "");
  const noCrIdx = noCrCurrent.indexOf(noCrSnippet);
  if (noCrIdx !== -1) return { start: noCrIdx, length: noCrSnippet.length };

  if (cleanSnippet.length >= 24) {
    const prefix = cleanSnippet.slice(0, 20);
    const prefixIdx = current.indexOf(prefix);
    if (prefixIdx !== -1) {
      const suffix = cleanSnippet.slice(-20);
      const suffixIdx = current.indexOf(suffix, prefixIdx);
      if (suffixIdx !== -1) {
        return { start: prefixIdx, length: suffixIdx + suffix.length - prefixIdx };
      }
    }
  }
  return null;
}

export default function EditorArea({
  chapter,
  workId,
  treeCollapsed = false,
  aiPanelCollapsed = true,
  aiPanelWidth = 360,
  onToggleTree,
  onUpdateChapter,
  onContentChange,
  onSelectionChange,
  onTriggerAiAction,
  activeTasks = [],
  onToggleAiPanel,
  insertTextPayload,
  locateSnippetPayload,
  targetWords = 4000,
  onDirtyChange,
  onDeleteChapter,
  onOutlineExtracted,
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
  const [selectionBubble, setSelectionBubble] = useState<{ x: number; y: number; text: string } | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<{ prevContent: string; label: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const editorViewportRef = useRef<HTMLDivElement>(null);
  const lastCursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastPayloadTimestampRef = useRef<number>(0);
  const lastLocateTimestampRef = useRef<number>(0);
  const savingRef = useRef<boolean>(false);
  const resizeRafRef = useRef<number | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHandlerRef = useRef<() => Promise<boolean>>(async () => false);

  const refreshTextareaHeight = useCallback(() => {
    if (resizeRafRef.current !== null) {
      cancelAnimationFrame(resizeRafRef.current);
    }
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = null;
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, 600)}px`;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (typeof ResizeObserver === "undefined" || !el) return;
    const observer = new ResizeObserver(() => refreshTextareaHeight());
    observer.observe(el);
    return () => observer.disconnect();
  }, [refreshTextareaHeight]);

  useEffect(() => {
    refreshTextareaHeight();
  }, [content, refreshTextareaHeight]);

  useEffect(() => {
    refreshTextareaHeight();
    const timer = setTimeout(refreshTextareaHeight, 220);
    return () => clearTimeout(timer);
  }, [treeCollapsed, aiPanelCollapsed, aiPanelWidth, refreshTextareaHeight]);

  useEffect(() => {
    if (chapter) {
      const nextContent = chapter.content || "";
      setTitle(chapter.title || "");
      setSubtitle(chapter.subtitle || "");
      setContent(nextContent);
      onContentChange?.(nextContent);
      setLastSavedAt(chapter.updatedAt || chapter.createdAt || null);
      setSelectionBubble(null);
      setUndoSnapshot(null);
      lastCursorRef.current = { start: nextContent.length, end: nextContent.length };
      onSelectionChange?.("");
      setTimeout(refreshTextareaHeight, 30);
    }
  }, [chapter?.id, refreshTextareaHeight]);

  // 实时同步正文给父组件，确保右侧 AI 助手始终读取未保存的最新正文
  useEffect(() => {
    onContentChange?.(content);
  }, [content, onContentChange]);

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

  const pushUndoSnapshot = useCallback((prevContent: string, label: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoSnapshot({ prevContent, label });
    undoTimerRef.current = setTimeout(() => {
      setUndoSnapshot(null);
      undoTimerRef.current = null;
    }, 8000);
  }, []);

  const handleUndoAiApply = () => {
    if (!undoSnapshot) return;
    setContent(undoSnapshot.prevContent);
    setUndoSnapshot(null);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    useAlert.info("已撤销上次 AI 采纳，恢复原正文");
  };

  const applyAiText = useCallback(
    (textToInsert: string, mode: ChapterAiApplyMode = "insert_after_selection", targetSnippet?: string) => {
      if (mode === "readonly") return;

      setContent((prevContent) => {
        const current = prevContent || "";
        const el = textareaRef.current;
        const scrollPos = editorViewportRef.current?.scrollTop;

        const restoreCursor = (nextPos: number) => {
          lastCursorRef.current = { start: nextPos, end: nextPos };
          setTimeout(() => {
            if (el) {
              el.focus({ preventScroll: true });
              el.setSelectionRange(nextPos, nextPos);
            }
            if (editorViewportRef.current && scrollPos !== undefined) {
              editorViewportRef.current.scrollTop = scrollPos;
            }
          }, 20);
        };

        // 1. 替换整章正文（全章润色/精简/换风格）
        if (mode === "replace_full_chapter") {
          pushUndoSnapshot(current, "已替换本章正文");
          restoreCursor(textToInsert.length);
          useAlert.success("已用改写结果更新本章正文（8 秒内可一键撤销）");
          return textToInsert;
        }

        // 2. 精准替换选中片段
        if (mode === "replace_selection" && targetSnippet?.trim()) {
          const match = locateSnippetInText(current, targetSnippet);
          if (match) {
            pushUndoSnapshot(current, "已替换选中片段");
            const nextContent =
              current.substring(0, match.start) + textToInsert + current.substring(match.start + match.length);
            restoreCursor(match.start + textToInsert.length);
            useAlert.success("已精准替换选中片段（8 秒内可一键撤销）");
            return nextContent;
          }
        }

        // 3. 在目标片段之后或光标/章末安全续写插入（绝不覆盖原文）
        pushUndoSnapshot(current, "已接续插入正文");
        if (targetSnippet?.trim()) {
          const match = locateSnippetInText(current, targetSnippet);
          if (match) {
            const insertAt = match.start + match.length;
            const sep = current[insertAt - 1] === "\n" ? "" : "\n\n";
            const nextContent = current.substring(0, insertAt) + sep + textToInsert + current.substring(insertAt);
            restoreCursor(insertAt + sep.length + textToInsert.length);
            useAlert.success("已紧接所选片段之后插入正文（8 秒内可一键撤销）");
            return nextContent;
          }
        }

        const insertPos = Math.min(
          current.length,
          Math.max(lastCursorRef.current.end ?? current.length, lastCursorRef.current.start ?? current.length)
        );
        const prefixSep = insertPos > 0 && current[insertPos - 1] !== "\n" ? "\n\n" : "";
        const nextContent = current.substring(0, insertPos) + prefixSep + textToInsert + current.substring(insertPos);
        restoreCursor(insertPos + prefixSep.length + textToInsert.length);
        useAlert.success("已安全写入正文（8 秒内可一键撤销）");
        return nextContent;
      });
    },
    [pushUndoSnapshot]
  );

  useEffect(() => {
    if (insertTextPayload && insertTextPayload.text && insertTextPayload.timestamp !== lastPayloadTimestampRef.current) {
      lastPayloadTimestampRef.current = insertTextPayload.timestamp;
      applyAiText(insertTextPayload.text, insertTextPayload.mode, insertTextPayload.targetSnippet);
    }
  }, [insertTextPayload, applyAiText]);

  useEffect(() => {
    if (locateSnippetPayload && locateSnippetPayload.snippet && locateSnippetPayload.timestamp !== lastLocateTimestampRef.current) {
      lastLocateTimestampRef.current = locateSnippetPayload.timestamp;
      const match = locateSnippetInText(content, locateSnippetPayload.snippet);
      if (match) {
        const el = textareaRef.current;
        if (el) {
          el.focus({ preventScroll: true });
          el.setSelectionRange(match.start, match.start + match.length);
          lastCursorRef.current = { start: match.start, end: match.start + match.length };
          const charRatio = match.start / Math.max(1, content.length);
          const totalHeight = el.scrollHeight || 1000;
          editorViewportRef.current?.scrollTo({
            top: Math.max(0, charRatio * totalHeight - 140),
            behavior: "smooth",
          });
          useAlert.info("已定位到该片段！");
        }
      } else {
        useAlert.warning("正文中未找到完全匹配的片段（可能已被修改）");
      }
    }
  }, [locateSnippetPayload, content]);

  const liveWordCount = useMemo(() => countWords(content), [content]);

  const handleFormatAll = () => {
    if (!content) return;
    const validLines = content
      .split(/\r?\n/)
      .map((line) => line.replace(/^[ 　\t]+/, "").trimEnd())
      .filter((line) => line.trim() !== "");
    if (validLines.length === 0) return;

    const formatted = validLines.map((line) => `　　${line}`).join("\n\n");
    setContent(formatted);
    setTimeout(refreshTextareaHeight, 20);
    useAlert.success("已完成一键格式化（段首缩进与整理分段）");
  };

  const handleFormatCompactNewline = () => {
    if (!content) return;
    const validLines = content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "");
    if (validLines.length === 0) return;

    setContent(validLines.join("\n"));
    setTimeout(refreshTextareaHeight, 20);
    useAlert.success("已取消分段（恢复紧凑段落）");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.nativeEvent as any).isComposing || e.keyCode === 229) return;

    if (e.key === "Escape") {
      setSelectionBubble(null);
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
      const currentLine = content.substring(0, start).split("\n").pop() || "";
      const indent = currentLine.trim() === "" ? "\n" : "\n　　";
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

  const handleCopyContent = async () => {
    if (!content) {
      useAlert.warning("当前章节正文内容为空");
      return;
    }
    const ok = await copyToClipboard(content);
    if (ok) useAlert.success("已复制本章正文内容至剪贴板！");
    else useAlert.error("复制失败，请手动选择复制");
  };

  const handleManualSave = useCallback(async (): Promise<boolean> => {
    if (!chapter || savingRef.current) return false;
    savingRef.current = true;
    try {
      setSaving(true);
      await onUpdateChapter({
        id: chapter.id,
        title: title.trim() || chapter.title,
        subtitle: subtitle.trim(),
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
      } catch {}

      setLastSavedAt(new Date());
      useAlert.success("章节保存成功！");
      return true;
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [chapter, title, subtitle, content, liveWordCount, onUpdateChapter, workId]);

  saveHandlerRef.current = handleManualSave;

  useEffect(() => {
    if (saveRef) saveRef.current = handleManualSave;
    return () => {
      if (saveRef) saveRef.current = null;
    };
  }, [saveRef, handleManualSave]);

  // 全局快捷键保存：仅绑定一次，不再随每次击键解绑重绑
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        saveHandlerRef.current();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, []);

  const handleTrackCursor = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    lastCursorRef.current = { start, end };
    const text = el.value.substring(start, end).trim();
    onSelectionChange?.(text.length >= 2 ? text : "");
    if (text.length < 4) {
      setSelectionBubble(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    handleTrackCursor();
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = el.value.substring(start, end).trim();
    if (selected.length >= 4) {
      setSelectionBubble({ x: e.clientX, y: e.clientY, text: selected });
    } else {
      setSelectionBubble(null);
    }
  };

  const highlightedBackdrop = useMemo(() => {
    if (!content) return null;
    if (!activeTasks || activeTasks.length === 0) return <span>{content}</span>;

    interface MatchSpan {
      start: number;
      end: number;
      color: (typeof HIGHLIGHT_COLORS)[0];
      id: string | number;
    }

    const matches: MatchSpan[] = [];
    activeTasks.forEach((task) => {
      const cleanSnippet = task.snippet?.trim();
      if (!cleanSnippet) return;
      const idx = content.indexOf(cleanSnippet);
      if (idx !== -1) {
        matches.push({
          start: idx,
          end: idx + cleanSnippet.length,
          color: HIGHLIGHT_COLORS[task.colorIndex % HIGHLIGHT_COLORS.length],
          id: task.id,
        });
      }
    });

    if (matches.length === 0) return <span>{content}</span>;

    matches.sort((a, b) => a.start - b.start);
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
        nodes.push(<span key={`plain-${i}`}>{content.substring(currentIdx, m.start)}</span>);
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
          {content.substring(m.start, m.end)}
        </mark>
      );
      currentIdx = m.end;
    });
    if (currentIdx < content.length) {
      nodes.push(<span key="plain-tail">{content.substring(currentIdx)}</span>);
    }
    return nodes;
  }, [content, activeTasks]);

  const handleRestoreVersion = async (restoredContent: string) => {
    setContent(restoredContent);
    await onUpdateChapter({ content: restoredContent, wordCount: countWords(restoredContent) });
    setTimeout(refreshTextareaHeight, 30);
  };

  const handleInsertFragment = (fragmentContent: string) => {
    applyAiText(fragmentContent, "insert_after_selection");
  };

  const handleExtractToOutline = async () => {
    if (!chapter || extractingOutline) return;
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length < 30) {
      useAlert.warning("本章正文内容过短，写满一段后再提取大纲吧！");
      return;
    }

    if (isDirty) {
      const saved = await handleManualSave();
      if (!saved) return;
    }

    try {
      setExtractingOutline(true);
      useAlert.info("正在提取本章剧情到大纲，请不要跳转页面...", { autoClose: 5000 });
      const res = await extractChapterOutline({
        chapterId: chapter.id,
        workId,
        content: cleanContent,
        title: title.trim() || chapter.title,
      });

      if (res && res.success) {
        onOutlineExtracted?.(chapter.id);
        useAlert.success("提取完毕！已将本章核心剧情同步至故事大纲", { autoClose: 3500 });
      } else {
        useAlert.error("提取大纲失败: " + (res?.message || "网络异常"));
      }
    } catch (e: any) {
      useAlert.error("提取异常: " + (e?.message || "网络错误"));
    } finally {
      setExtractingOutline(false);
    }
  };

  if (!chapter) {
    return (
      <Flex flex={1} h="100%" justify="center" align="center" direction="column" gap="sm">
        <FiFileText size={48} color="#cbd5e1" />
        <Text fz={15} fw={600} c="#94a3b8">
          请在左侧选择或新建章节开始创作
        </Text>
      </Flex>
    );
  }

  return (
    <Flex ref={containerRef} flex={1} h="100%" direction="column" bg="#ffffff" miw={0} pos="relative" style={{ overflow: "hidden" }}>
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
          <Text fz={13} fw={600} c="#334155">
            {title || chapter.title || `第${chapter.chapterNumber}章`}
            {subtitle || chapter.subtitle ? `  ${subtitle || chapter.subtitle}` : ""}
          </Text>
          {isDirty && (
            <Badge size="xs" color="orange" variant="light" styles={{ root: { fontSize: 10, padding: "0 6px" } }}>
              未保存
            </Badge>
          )}
        </Group>

        <Group gap="xs" align="center">
          <Group gap={6} align="center" mr="xs">
            <Box w={6} h={6} bdrs="50%" bg={isDirty ? "#f59e0b" : "#10b981"} />
            <Text fz={12} c="#64748b">
              {liveWordCount.toLocaleString()} 字 / 目标 {targetWords.toLocaleString()} 字
            </Text>
          </Group>

          {/* 卡文救星：一键顺着往下写 */}
          <Menu position="bottom-end" shadow="md" width={185}>
            <Menu.Target>
              <Button
                size="xs"
                variant="light"
                color="cyan"
                leftSection={<FiZap size={12} />}
                rightSection={<FiChevronDown size={11} />}
                styles={{ root: { height: 28, fontWeight: 600, fontSize: 12 } }}
                title="卡文时自动承接上章与本章大纲无缝续写"
              >
                顺着往下写
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>卡文救星 · 选择续写方向</Menu.Label>
              <Menu.Item fz={12} onClick={() => onTriggerAiAction?.("continue", "", "natural")}>
                ⚡ 自然顺着往下写
              </Menu.Item>
              <Menu.Item fz={12} onClick={() => onTriggerAiAction?.("continue", "", "twist")}>
                🌀 来个意外反转
              </Menu.Item>
              <Menu.Item fz={12} onClick={() => onTriggerAiAction?.("continue", "", "hook")}>
                🪝 收尾留个悬念钩子
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Tooltip label="一键复制本章内容" position="bottom">
            <ActionIcon variant="default" size="sm" onClick={handleCopyContent} styles={{ root: { height: 28, width: 28 } }}>
              <FiCopy size={13} color="#475569" />
            </ActionIcon>
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

          <Button
            size="xs"
            variant="default"
            color="gray"
            leftSection={<FiAlignLeft size={13} color="#0284c7" />}
            onClick={handleFormatAll}
            styles={{ root: { height: 28, fontWeight: 500, fontSize: 12 } }}
            title="一键整理分段与段首缩进"
          >
            一键格式化
          </Button>

          <Menu position="bottom-end" shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="default" size="sm" styles={{ root: { height: 28, width: 28 } }} title="更多操作">
                <FiMoreHorizontal size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<FiZap size={14} color="#0284c7" />} onClick={onToggleAiPanel} styles={{ item: { fontWeight: 600 } }}>
                {aiPanelCollapsed ? "打开 AI 协同助手" : "收起 AI 协同助手"}
              </Menu.Item>

              <Menu.Divider />

              <Menu.Label>智能与辅助</Menu.Label>
              <Menu.Item leftSection={<FiLayers size={13} color="#16a34a" />} onClick={handleExtractToOutline} disabled={extractingOutline}>
                {extractingOutline ? "提取大纲中..." : "提取剧情到大纲"}
              </Menu.Item>
              <Menu.Item leftSection={<FiBookmark size={13} color="#06b6d4" />} onClick={() => setFragmentDrawerOpened(true)}>
                记忆碎片灵感库
              </Menu.Item>
              <Menu.Item leftSection={<FiClock size={13} color="#64748b" />} onClick={() => setVersionDrawerOpened(true)}>
                版本生成历史
              </Menu.Item>

              <Menu.Divider />

              <Menu.Label>文本排版</Menu.Label>
              <Menu.Item leftSection={<FiMinimize2 size={13} color="#8b5cf6" />} onClick={handleFormatCompactNewline}>
                取消分段 (紧凑段落)
              </Menu.Item>

              {onDeleteChapter && (
                <>
                  <Menu.Divider />
                  <Menu.Item color="red" leftSection={<FiTrash2 size={13} />} onClick={() => onDeleteChapter(chapter.id)}>
                    删除本章
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Flex>

      {/* 8 秒浮层撤销条（AI 采纳写入后随时无悔回退） */}
      {undoSnapshot && (
        <Paper
          shadow="md"
          radius="xl"
          px={14}
          py={6}
          bg="#0f172a"
          pos="absolute"
          bottom={20}
          left="50%"
          style={{ transform: "translateX(-50%)", zIndex: 800 }}
        >
          <Group gap={10}>
            <Text fz={12} c="#f8fafc">
              {undoSnapshot.label}
            </Text>
            <Button size="compact-xs" variant="light" color="cyan" leftSection={<FiRotateCcw size={11} />} onClick={handleUndoAiApply}>
              撤销本次采纳
            </Button>
          </Group>
        </Paper>
      )}

      {/* 沉浸式正文全高滚动区域 */}
      <ScrollArea
        style={{ flex: 1, height: "100%" }}
        viewportRef={editorViewportRef}
        onScrollPositionChange={() => setSelectionBubble(null)}
        p={{ base: "md", md: 24 }}
        styles={{ viewport: { paddingBottom: 0 } }}
      >
        <Box maw={820} mx="auto" mih="calc(100vh - 120px)" pb="25vh" pos="relative">
          <TextInput
            variant="unstyled"
            placeholder="输入章节标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            styles={{ input: { fontSize: 24, fontWeight: 800, color: "#0f172a" } }}
          />
          <TextInput
            variant="unstyled"
            placeholder="添加小标题 / 章节副标题 (选填)..."
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            styles={{ input: { fontSize: 14, color: "#64748b", padding: "0 0 4px 0" } }}
          />

          <Group gap="xs" align="center" mt={4} mb={12}>
            <Group gap={4} align="center">
              <FiClock size={11.5} color="#94a3b8" />
              <Text fz={11.5} c="#94a3b8">
                上次修改时间：{formatDateTime(lastSavedAt || chapter.updatedAt || chapter.createdAt)}
              </Text>
            </Group>
            <Text fz={11} c="#cbd5e1">·</Text>
            <Text fz={11} c="#94a3b8">划选正文任意段落即可唤起 AI 润色 / 扩写 / 换味道悬浮条</Text>
          </Group>

          <Box pos="relative" mt={4}>
            {/* 高亮背景衬底层 */}
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
              {highlightedBackdrop}
            </div>

            {/* 前台文本编辑区（完整保留浏览器原生右键菜单） */}
            <Textarea
              ref={textareaRef}
              variant="unstyled"
              minRows={26}
              placeholder="在此开始撰写正文（回车自动段首缩进两格，支持 Ctrl+S / Cmd+S 快速保存）..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                handleTrackCursor();
                setSelectionBubble(null);
              }}
              onKeyDown={handleKeyDown}
              onSelect={handleTrackCursor}
              onMouseUp={handleMouseUp}
              onKeyUp={handleTrackCursor}
              onClick={() => {
                handleTrackCursor();
                setSelectionBubble(null);
              }}
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
                  overflow: "hidden",
                  resize: "none",
                },
              }}
            />
          </Box>
        </Box>
      </ScrollArea>

      {/* 划词悬浮 AI 快捷条 */}
      {selectionBubble && (
        <SelectionBubbleBar
          x={selectionBubble.x}
          y={selectionBubble.y}
          selectedText={selectionBubble.text}
          onTrigger={(actionType, text, subMode) => onTriggerAiAction?.(actionType, text, subMode)}
          onClose={() => setSelectionBubble(null)}
        />
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
    </Flex>
  );
}
