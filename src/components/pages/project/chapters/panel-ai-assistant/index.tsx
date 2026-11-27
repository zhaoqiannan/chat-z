// 组件：右侧 AI 协同创作助手面板（SSE 流式打字机、停止生成、红绿 Diff 预览、选中引用清晰取消、智能安全采纳）
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Flex, Text, Button, ActionIcon, Badge, TextInput, Textarea, ScrollArea, Group, Stack, Paper, Loader, Popover, Menu } from "@mantine/core";
import { FiSend, FiPlus, FiX, FiCheck, FiChevronRight, FiZap, FiStar, FiBook, FiUser, FiMapPin, FiShield, FiBox, FiCpu, FiBookmark, FiTrash2, FiCopy, FiSquare, FiRefreshCw } from "react-icons/fi";
import {
  ChapterAiChatItem,
  ChapterAiApplyMode,
  ContextTagOption,
  getChapterAiChatList,
  sendChapterAiChatStream,
  applyChapterAiChat,
  getWorkContextTagOptions,
  createMemoryFragment,
  deleteChapterAiChat,
} from "@/rest/chapter";
import { useAlert } from "@/hooks/useAlert";
import { formatDateTime, copyToClipboard } from "@/utils/text";
import InlineDiffView from "./InlineDiffView";

export interface PanelAiAssistantProps {
  workId: number | string;
  chapterId: number | string;
  currentContent: string;
  selectedText?: string;
  collapsed?: boolean;
  width?: number;
  isResizing?: boolean;
  onToggleCollapse?: () => void;
  onClearSelection?: () => void;
  onAcceptText: (text: string, options?: { mode?: ChapterAiApplyMode; targetSnippet?: string }) => void;
  onLocateSnippet?: (snippet: string) => void;
  externalTask?: { actionType: string; selectedText: string; subMode?: string; customPrompt?: string; timestamp: number } | null;
}

export type ExtendedChatItem = ChapterAiChatItem & { isPending?: boolean; error?: string };

const REWRITE_ACTIONS = new Set(["polish", "expand", "shorten", "tone"]);

function inferApplyMode(item: ChapterAiChatItem): ChapterAiApplyMode {
  if (item.applyMode) return item.applyMode;
  if (item.actionType === "critique" || item.actionType === "chat") return "readonly";
  if (item.actionType === "continue") return "insert_after_selection";
  if (item.actionType === "expand" && !item.selectedText) return "insert_after_selection";
  return item.selectedText ? "replace_selection" : "replace_full_chapter";
}

function getApplyButtonLabel(mode: ChapterAiApplyMode, applied: number): string {
  if (mode === "replace_selection") return applied ? "重新替换片段" : "采纳替换原文";
  if (mode === "replace_full_chapter") return applied ? "重新替换整章" : "替换整章正文";
  return applied ? "再次插入正文" : "接续插入正文";
}

export default function PanelAiAssistant({
  workId,
  chapterId,
  currentContent,
  selectedText = "",
  collapsed = false,
  width = 360,
  isResizing = false,
  onToggleCollapse,
  onClearSelection,
  onAcceptText,
  onLocateSnippet,
  externalTask,
}: PanelAiAssistantProps) {
  const [chats, setChats] = useState<ExtendedChatItem[]>([]);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [currentAction, setCurrentAction] = useState<string>("chat");
  const [selectedTags, setSelectedTags] = useState<ContextTagOption[]>([]);
  const [allTagOptions, setAllTagOptions] = useState<ContextTagOption[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagPopoverOpened, setTagPopoverOpened] = useState(false);
  const [fragmentSavedIds, setFragmentSavedIds] = useState<Record<number, boolean>>({});

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastExecutedTaskTimestampRef = useRef<number>(0);
  const currentContentRef = useRef(currentContent);
  currentContentRef.current = currentContent;

  const scrollToBottom = useCallback(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, []);

  const fetchChats = useCallback(async () => {
    if (!chapterId) return;
    try {
      const res = await getChapterAiChatList(chapterId);
      if (res && res.success && Array.isArray(res.result)) {
        setChats(res.result);
      }
    } catch (e) {
      console.error(e);
    }
  }, [chapterId]);

  const fetchTags = useCallback(async () => {
    if (!workId) return;
    try {
      const res = await getWorkContextTagOptions(workId, chapterId);
      if (res && res.success && Array.isArray(res.result)) {
        setAllTagOptions(res.result);
        const contentSnapshot = currentContentRef.current || "";
        const autoMatched = contentSnapshot
          ? res.result.filter((t: ContextTagOption) => t.name && contentSnapshot.includes(t.name)).slice(0, 4)
          : [];
        setSelectedTags(autoMatched);
      }
    } catch (e) {
      console.error(e);
    }
  }, [workId, chapterId]);

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSending(false);
    setSelectedTags([]);
    setCurrentAction("chat");
    fetchChats();
    fetchTags();
  }, [chapterId, workId, fetchChats, fetchTags]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleAddTag = (tag: ContextTagOption) => {
    if (!selectedTags.some((t) => t.id === tag.id && t.type === tag.type)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setTagPopoverOpened(false);
  };

  const handleRemoveTag = (tag: ContextTagOption) => {
    setSelectedTags((prev) => prev.filter((t) => !(t.id === tag.id && t.type === tag.type)));
  };

  const getActionLabel = (actionType?: string) => {
    switch (actionType) {
      case "polish":
        return "一键变好";
      case "expand":
        return "写丰富点";
      case "shorten":
        return "精简提速";
      case "continue":
        return "顺着往下写";
      case "tone":
        return "换个味道";
      case "critique":
        return "挑挑毛病";
      case "custom":
        return "定制修改";
      default:
        return "创作问答";
    }
  };

  const runStreamTask = useCallback(
    async (opts: {
      actionType: string;
      textSnippet?: string;
      subMode?: string;
      prompt?: string;
    }) => {
      if (!chapterId || !workId) return;

      // 如有正在生成的任务，先取消旧流避免串台
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const tempUserId = -Date.now();
      const tempAssistantId = tempUserId - 1;
      const snippet = (opts.textSnippet || "").trim();
      const actionType = opts.actionType || "chat";
      const label = getActionLabel(actionType);
      const userPreviewText =
        opts.prompt?.trim() ||
        (snippet ? `对选中片段执行【${label}】` : `结合上下文执行【${label}】`);

      const optimisticUser: ExtendedChatItem = {
        id: tempUserId,
        workId: Number(workId),
        chapterId: Number(chapterId),
        userId: "",
        role: "user",
        content: userPreviewText,
        actionType,
        selectedText: snippet || undefined,
        applied: 0,
        createdAt: new Date().toISOString(),
      };

      const pendingAssistant: ExtendedChatItem = {
        id: tempAssistantId,
        workId: Number(workId),
        chapterId: Number(chapterId),
        userId: "",
        role: "assistant",
        content: "",
        actionType,
        selectedText: snippet || undefined,
        applied: 0,
        createdAt: new Date().toISOString(),
        isPending: true,
      };

      setChats((prev) => [...prev, optimisticUser, pendingAssistant]);
      setSending(true);
      setTimeout(scrollToBottom, 30);

      try {
        await sendChapterAiChatStream(
          {
            workId: Number(workId),
            chapterId: Number(chapterId),
            prompt: opts.prompt || "",
            actionType,
            subMode: opts.subMode,
            selectedText: snippet || undefined,
            currentContent: currentContentRef.current || undefined,
            contextTags: selectedTags,
          },
          {
            onChunk: (chunk) => {
              setChats((prev) =>
                prev.map((c) => (c.id === tempAssistantId ? { ...c, content: c.content + chunk } : c))
              );
              scrollToBottom();
            },
            onDone: (savedResult, applyMode) => {
              setChats((prev) =>
                prev.map((c) =>
                  c.id === tempAssistantId ? { ...savedResult, applyMode, isPending: false } : c
                )
              );
            },
            onError: (errMsg) => {
              setChats((prev) =>
                prev.map((c) =>
                  c.id === tempAssistantId
                    ? { ...c, content: c.content || `生成失败：${errMsg}`, isPending: false, error: errMsg }
                    : c
                )
              );
            },
          },
          controller.signal
        );
      } catch (e: any) {
        if (e?.name === "AbortError") {
          setChats((prev) =>
            prev.map((c) =>
              c.id === tempAssistantId
                ? { ...c, content: c.content ? `${c.content}\n\n（已手动停止生成）` : "已停止生成", isPending: false }
                : c
            )
          );
        } else {
          setChats((prev) =>
            prev.map((c) =>
              c.id === tempAssistantId
                ? { ...c, content: `生成异常：${e?.message || "网络错误"}`, isPending: false, error: e?.message }
                : c
            )
          );
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setSending(false);
        }
      }
    },
    [chapterId, workId, selectedTags, scrollToBottom]
  );

  useEffect(() => {
    if (externalTask && externalTask.timestamp && externalTask.timestamp !== lastExecutedTaskTimestampRef.current) {
      lastExecutedTaskTimestampRef.current = externalTask.timestamp;
      if (externalTask.actionType === "custom_focus") {
        setCurrentAction("custom");
        setInputText("");
        setTimeout(() => inputRef.current?.focus(), 80);
      } else {
        runStreamTask({
          actionType: externalTask.actionType,
          textSnippet: externalTask.selectedText,
          subMode: externalTask.subMode,
          prompt: externalTask.customPrompt,
        });
      }
    }
  }, [externalTask, runStreamTask]);

  // 快捷按钮直接一键执行，无需先填冗长提示词再按发送
  const handleQuickAction = (actionType: string, subMode?: string) => {
    if (sending) return;
    runStreamTask({
      actionType,
      textSnippet: selectedText,
      subMode,
    });
  };

  const handleSend = () => {
    if (sending) return;
    const promptToSend = inputText.trim();
    if (!promptToSend && !selectedText) return;

    const actionToUse = selectedText && currentAction === "chat" ? "custom" : currentAction;
    setInputText("");
    setCurrentAction("chat");

    runStreamTask({
      actionType: actionToUse,
      textSnippet: selectedText,
      prompt: promptToSend,
    });
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleDeleteChat = async (id: number) => {
    const prevChats = chats;
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id <= 0) return;
    try {
      await deleteChapterAiChat(id);
    } catch {
      setChats(prevChats);
      useAlert.error("删除对话记录失败，请重试");
    }
  };

  const handleAccept = (chat: ChapterAiChatItem) => {
    const mode = inferApplyMode(chat);
    onAcceptText(chat.content, { mode, targetSnippet: chat.selectedText });
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, applied: 1 } : c)));
    if (chat.id > 0) {
      applyChapterAiChat(chat.id, true).catch(() => {});
    }
  };

  const handleRetry = (chat: ChapterAiChatItem) => {
    if (sending) return;
    runStreamTask({
      actionType: chat.actionType || "chat",
      textSnippet: chat.selectedText,
      prompt: chat.actionType === "chat" ? "请换个思路重新回答上一个问题" : "",
    });
  };

  const handleSaveFragment = async (chat: ChapterAiChatItem) => {
    try {
      const res = await createMemoryFragment({
        workId: Number(workId),
        chapterId: Number(chapterId),
        title: `${getActionLabel(chat.actionType)}碎片`,
        content: chat.content,
        sourceType: "ai_chat",
        tags: chat.actionType || "AI推演",
      });
      if (res && res.success) {
        setFragmentSavedIds((prev) => ({ ...prev, [chat.id]: true }));
        useAlert.success("已成功存为记忆碎片！");
      }
    } catch (e: any) {
      useAlert.error("保存碎片失败: " + (e?.message || "网络异常"));
    }
  };

  const filteredTagOptions = allTagOptions.filter(
    (t) => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const getTagTypeIcon = (type: string) => {
    switch (type) {
      case "character":
        return <FiUser size={10} color="#0284c7" />;
      case "location":
        return <FiMapPin size={10} color="#10b981" />;
      case "faction":
        return <FiShield size={10} color="#8b5cf6" />;
      case "item":
        return <FiBox size={10} color="#f59e0b" />;
      case "rule":
        return <FiCpu size={10} color="#ec4899" />;
      default:
        return <FiBook size={10} color="#64748b" />;
    }
  };

  return (
    <Box
      style={{
        width: collapsed ? 0 : width,
        minWidth: collapsed ? 0 : 280,
        maxWidth: collapsed ? 0 : 720,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderLeft: collapsed ? "none" : "1px solid #f1f5f9",
        transition: isResizing ? "none" : "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden",
        flexShrink: 0,
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? "none" : "auto",
        zIndex: 20,
      }}
    >
      {/* 头部 */}
      <Flex justify="space-between" align="center" px="md" py={12} style={{ borderBottom: "1px solid #f8fafc" }}>
        <Group gap={6} align="center">
          <FiZap color="#00c9ff" size={15} />
          <Text fz={13.5} fw={700} c="#1e293b">
            AI 协同创作助手
          </Text>
        </Group>
        {onToggleCollapse && (
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCollapse}>
            <FiChevronRight size={14} />
          </ActionIcon>
        )}
      </Flex>

      {/* 上下文标签条（后端已自动注入上章结尾/本章大纲/命中实体，此处支持额外手动固定） */}
      <Box px="md" py={8} bg="#fafbfc" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Flex gap={4} wrap="wrap" align="center">
          {selectedTags.map((tag) => (
            <Badge
              key={`${tag.type}-${tag.id}`}
              size="sm"
              variant="outline"
              color="gray"
              leftSection={getTagTypeIcon(tag.type)}
              rightSection={
                <ActionIcon size={10} variant="transparent" color="gray" onClick={() => handleRemoveTag(tag)}>
                  <FiX size={9} />
                </ActionIcon>
              }
              styles={{
                root: {
                  backgroundColor: "#ffffff",
                  borderColor: "#e2e8f0",
                  color: "#334155",
                  fontWeight: 500,
                  fontSize: 11,
                  paddingRight: 4,
                },
              }}
            >
              {tag.name}
            </Badge>
          ))}

          <Popover opened={tagPopoverOpened} onChange={setTagPopoverOpened} position="bottom-start" width={240} shadow="md">
            <Popover.Target>
              <Button size="compact-xs" variant="subtle" leftSection={<FiPlus size={10} />} onClick={() => setTagPopoverOpened((o) => !o)} fz={11}>
                关联设定
              </Button>
            </Popover.Target>
            <Popover.Dropdown p={8}>
              <TextInput placeholder="搜索人物/地点/设定..." size="xs" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} mb={6} />
              <ScrollArea style={{ maxHeight: 180 }}>
                <Stack gap={2}>
                  {filteredTagOptions.map((t) => (
                    <UnstyledTagRow key={`${t.type}-${t.id}`} tag={t} onSelect={() => handleAddTag(t)} />
                  ))}
                </Stack>
              </ScrollArea>
            </Popover.Dropdown>
          </Popover>
        </Flex>
      </Box>

      {/* 一键无脑快捷操作栏（点即直接流式执行，不再需要二次复制粘贴） */}
      <Box px="md" py={10} style={{ borderBottom: "1px solid #f8fafc" }}>
        <Flex gap={6} wrap="wrap">
          <Menu shadow="md" width={160} position="bottom-start">
            <Menu.Target>
              <Button size="xs" variant={currentAction === "polish" ? "light" : "default"} color="cyan" disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
                ✨ 一键变好
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item fz={12} onClick={() => handleQuickAction("polish", "refined")}>✨ 流畅精炼（推荐）</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("polish", "light")}>🪶 轻度顺句（保原味）</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("polish", "vivid")}>🎬 增强画面感</Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Menu shadow="md" width={160} position="bottom-start">
            <Menu.Target>
              <Button size="xs" variant={currentAction === "expand" ? "light" : "default"} color="teal" disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
                🌱 写丰富点
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item fz={12} onClick={() => handleQuickAction("expand", "general")}>✨ 综合丰富细节</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("expand", "action")}>🎬 加动作镜头</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("expand", "atmosphere")}>🌫️ 加环境氛围</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("expand", "psychology")}>💭 加心理暗流</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("expand", "dialogue")}>💬 加对话张力</Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Button size="xs" variant="default" disabled={sending} onClick={() => handleQuickAction("shorten", "tight")} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            ✂️ 精简提速
          </Button>

          <Menu shadow="md" width={155} position="bottom-start">
            <Menu.Target>
              <Button size="xs" variant="default" disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
                ⚡ 顺着写
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item fz={12} onClick={() => handleQuickAction("continue", "natural")}>⚡ 自然推进</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("continue", "twist")}>🌀 制造意外反转</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("continue", "hook")}>🪝 留个悬念钩子</Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Menu shadow="md" width={145} position="bottom-start">
            <Menu.Target>
              <Button size="xs" variant="default" disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
                🎭 换味道
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item fz={12} onClick={() => handleQuickAction("tone", "cold")}>🧊 冷峻克制</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("tone", "suspense")}>🕵️ 悬疑紧绷</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("tone", "humor")}>😄 轻快诙谐</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("tone", "lyrical")}>🌙 细腻抒情</Menu.Item>
              <Menu.Item fz={12} onClick={() => handleQuickAction("tone", "ancient")}>🏮 古风雅致</Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Button size="xs" variant="default" disabled={sending} onClick={() => handleQuickAction("critique")} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            🔍 挑毛病
          </Button>
        </Flex>
      </Box>

      {/* 对话与结果列表 */}
      <ScrollArea style={{ flex: 1 }} px="md" py="xs" viewportRef={scrollViewportRef}>
        <Stack gap="md">
          {chats.length === 0 && (
            <Paper p="md" radius="md" bg="#f8fafc" bd="1px dashed #e2e8f0">
              <Text fz={12} c="#64748b" lh={1.65}>
                已自动装载：上一章结尾、本章大纲、人物关系网与登场设定。直接划选正文片段或点击上方按钮，即可一键润色、扩写或续写。
              </Text>
            </Paper>
          )}

          {chats.map((item) => {
            if (item.role === "user") {
              return (
                <Box key={item.id} style={{ alignSelf: "flex-end", maxWidth: "92%" }}>
                  <Paper p="8px 12px" radius="md" bg="#f1f5f9" style={{ borderBottomRightRadius: 2 }}>
                    {item.selectedText && (
                      <Box p="4px 8px" mb={6} bg="#e2e8f0" bdrs={4} style={{ borderLeft: "3px solid #0284c7" }}>
                        <Text fz={10.5} c="#475569" lineClamp={2}>
                          引用：“{item.selectedText}”
                        </Text>
                      </Box>
                    )}
                    <Text fz={12} c="#1e293b" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {item.content}
                    </Text>
                  </Paper>
                  <Flex justify="space-between" align="center" mt={2} px={2}>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => handleDeleteChat(item.id)} title="删除提问">
                      <FiTrash2 size={11} />
                    </ActionIcon>
                    <Text fz={10} c="#94a3b8">
                      {formatDateTime(item.createdAt)} · 作家
                    </Text>
                  </Flex>
                </Box>
              );
            }

            const applyMode = inferApplyMode(item);
            const canApply = applyMode !== "readonly" && !item.error && !item.isPending && Boolean(item.content.trim());
            const showDiff = !item.isPending && !item.error && Boolean(item.selectedText) && REWRITE_ACTIONS.has(item.actionType);

            return (
              <Box key={item.id} style={{ alignSelf: "flex-start", width: "100%" }}>
                <Paper
                  p="10px 12px"
                  radius="md"
                  bg={item.isPending ? "#f8fafc" : item.error ? "#fef2f2" : "#f0fdf4"}
                  bd={item.isPending ? "1px dashed #94a3b8" : item.error ? "1px solid #fecaca" : "1px solid #bbf7d0"}
                >
                  <Group justify="space-between" align="center" mb={6}>
                    <Group gap={4}>
                      {item.isPending ? <Loader size={12} color="cyan" /> : <FiStar size={12} color={item.error ? "#dc2626" : "#16a34a"} />}
                      <Text fz={11.5} fw={700} c={item.error ? "#b91c1c" : "#166534"}>
                        【{getActionLabel(item.actionType)}】{item.isPending ? "流式生成中..." : "推荐结果"}
                      </Text>
                    </Group>
                    {item.applied ? <Badge size="xs" color="cyan" variant="light">已采纳</Badge> : null}
                  </Group>

                  {item.selectedText && (
                    <Flex p="4px 8px" mb={6} bg="#ecfdf5" bdrs={4} justify="space-between" align="center" gap={4} style={{ borderLeft: "3px solid #10b981" }}>
                      <Text fz={11} c="#047857" lineClamp={2} flex={1}>
                        📌 对应片段：“{item.selectedText}”
                      </Text>
                      {onLocateSnippet && (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="cyan"
                          onClick={() => onLocateSnippet(item.selectedText || "")}
                          styles={{ root: { fontSize: 10, height: 18, padding: "0 3px" } }}
                        >
                          🎯 定位
                        </Button>
                      )}
                    </Flex>
                  )}

                  {showDiff ? (
                    <InlineDiffView original={item.selectedText || ""} revised={item.content} />
                  ) : (
                    <Text fz={12.5} c={item.error ? "#991b1b" : "#14532d"} style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                      {item.content || (item.isPending ? "AI 正在结合上章结尾与作品设定推演中..." : "")}
                    </Text>
                  )}

                  {!item.isPending && (
                    <Flex justify="space-between" align="center" mt={10}>
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleDeleteChat(item.id)} title="删除此条回答">
                        <FiTrash2 size={12} />
                      </ActionIcon>

                      <Flex gap={6} wrap="wrap">
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="blue"
                          leftSection={<FiCopy size={11} />}
                          onClick={async () => {
                            const ok = await copyToClipboard(item.content);
                            if (ok) useAlert.success("已复制到剪贴板！");
                          }}
                        >
                          复制
                        </Button>

                        {!item.error && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="cyan"
                            leftSection={<FiBookmark size={11} />}
                            onClick={() => handleSaveFragment(item)}
                            disabled={Boolean(fragmentSavedIds[item.id])}
                          >
                            {fragmentSavedIds[item.id] ? "已存碎片" : "存碎片"}
                          </Button>
                        )}

                        {canApply && (
                          <Button
                            size="compact-xs"
                            color={item.applied ? "gray" : "teal"}
                            variant={item.applied ? "outline" : "filled"}
                            leftSection={<FiCheck size={11} />}
                            onClick={() => handleAccept(item)}
                          >
                            {getApplyButtonLabel(applyMode, item.applied)}
                          </Button>
                        )}

                        <Button size="compact-xs" variant="default" leftSection={<FiRefreshCw size={10} />} disabled={sending} onClick={() => handleRetry(item)}>
                          换一版
                        </Button>
                      </Flex>
                    </Flex>
                  )}
                </Paper>
                <Text fz={10} c="#94a3b8" mt={2} px={2}>
                  {formatDateTime(item.createdAt)} · Novel AI
                </Text>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>

      {/* 底部输入区（带清晰可取消的选中片段引用胶囊 + 流式停止按钮） */}
      <Box p="xs" px="md" bg="#ffffff" style={{ borderTop: "1px solid #f1f5f9" }}>
        {selectedText && (
          <Flex align="center" justify="space-between" gap={6} px={8} py={4} mb={6} bg="#f0f9ff" bdrs={6} bd="1px solid #bae6fd">
            <Text fz={11} c="#0369a1" lineClamp={1} flex={1}>
              已锁定选中片段：“{selectedText}”
            </Text>
            <ActionIcon size="xs" variant="subtle" color="cyan" onClick={() => onClearSelection?.()} title="取消引用选中文本">
              <FiX size={12} />
            </ActionIcon>
          </Flex>
        )}

        <Textarea
          ref={inputRef}
          placeholder={selectedText ? "输入对选中片段的具体修改要求（如：把对话改得更针锋相对），回车发送..." : "自由提问、讨论卡文思路或输入写作指令..."}
          variant="unstyled"
          autosize
          minRows={2}
          maxRows={5}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          styles={{ input: { fontSize: 12.5, padding: "4px 0", color: "#1e293b" } }}
        />

        <Flex justify="space-between" align="center" mt={4}>
          <Text fz={10.5} c="#94a3b8">
            已固定 {selectedTags.length} 个设定 · 自动承接上章与大纲
          </Text>
          {sending ? (
            <Button size="compact-xs" color="red" variant="light" leftSection={<FiSquare size={10} />} onClick={handleStop}>
              停止生成
            </Button>
          ) : (
            <ActionIcon size="sm" variant="filled" color="cyan" disabled={!inputText.trim() && !selectedText} onClick={handleSend} title="发送指令 (Enter)">
              <FiSend size={12} />
            </ActionIcon>
          )}
        </Flex>
      </Box>
    </Box>
  );
}

function UnstyledTagRow({ tag, onSelect }: { tag: ContextTagOption; onSelect: () => void }) {
  return (
    <Flex onClick={onSelect} p="4px 6px" justify="space-between" align="center" bdrs={4} fz={11.5} c="#334155" style={{ cursor: "pointer" }}>
      <Text fz={11.5} fw={500} truncate="end" flex={1}>
        {tag.name}
      </Text>
      <Text fz={10} c="#94a3b8">
        {tag.desc || tag.type}
      </Text>
    </Flex>
  );
}
