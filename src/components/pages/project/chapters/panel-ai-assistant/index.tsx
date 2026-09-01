// 组件：右侧 AI 协同创作助手面板（多级上下文标签管理、快捷写作动作、智能推演流、一键采纳写入与存为记忆碎片）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Button, ActionIcon, Badge, TextInput, Textarea, ScrollArea, Group, Stack, Paper, Loader, Popover, Tooltip } from "@mantine/core";
import { FiSend, FiPlus, FiX, FiRefreshCw, FiCheck, FiChevronRight, FiZap, FiStar, FiBook, FiUser, FiMapPin, FiShield, FiBox, FiCpu, FiBookmark } from "react-icons/fi";
import { ChapterAiChatItem, ContextTagOption, getChapterAiChatList, sendChapterAiChat, applyChapterAiChat, getWorkContextTagOptions, createMemoryFragment } from "@/rest/chapter";

interface PanelAiAssistantProps {
  workId: number | string;
  chapterId: number | string;
  currentContent: string;
  selectedText?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClearSelection?: () => void;
  onAcceptText: (text: string, targetSnippet?: string) => void;
}

export default function PanelAiAssistant({
  workId,
  chapterId,
  currentContent,
  selectedText = "",
  collapsed = false,
  onToggleCollapse,
  onClearSelection,
  onAcceptText,
}: PanelAiAssistantProps) {
  const [chats, setChats] = useState<ChapterAiChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedTags, setSelectedTags] = useState<ContextTagOption[]>([]);
  const [allTagOptions, setAllTagOptions] = useState<ContextTagOption[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagPopoverOpened, setTagPopoverOpened] = useState(false);
  const [fragmentSavedIds, setFragmentSavedIds] = useState<Record<number, boolean>>({});

  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const fetchChats = async () => {
    if (!chapterId) return;
    try {
      setLoading(true);
      const res = await getChapterAiChatList(chapterId);
      if (res && res.success && Array.isArray(res.result)) {
        setChats(res.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    if (!workId) return;
    try {
      const res = await getWorkContextTagOptions(workId, chapterId);
      if (res && res.success && Array.isArray(res.result)) {
        setAllTagOptions(res.result);
        if (selectedTags.length === 0 && currentContent) {
          const autoMatched = res.result.filter((t) => currentContent.includes(t.name)).slice(0, 4);
          if (autoMatched.length > 0) {
            setSelectedTags(autoMatched);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchTags();
  }, [chapterId, workId]);

  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chats, sending]);

  const handleAddTag = (tag: ContextTagOption) => {
    if (!selectedTags.some((t) => t.id === tag.id && t.type === tag.type)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setTagPopoverOpened(false);
  };

  const handleRemoveTag = (tag: ContextTagOption) => {
    setSelectedTags((prev) => prev.filter((t) => !(t.id === tag.id && t.type === tag.type)));
  };

  const handleSend = async (actionType: string = "chat", customPrompt?: string) => {
    const promptToSend = customPrompt !== undefined ? customPrompt : inputText.trim();
    if (!promptToSend && !selectedText && actionType === "chat") return;

    try {
      setSending(true);
      setInputText("");

      const res = await sendChapterAiChat({
        workId: Number(workId),
        chapterId: Number(chapterId),
        prompt: promptToSend,
        actionType,
        selectedText: selectedText || undefined,
        currentContent: currentContent || undefined,
        contextTags: selectedTags,
      });

      if (res && res.success && res.result) {
        await fetchChats();
      }
    } catch (e: any) {
      alert("AI 协同请求失败: " + (e?.message || "网络异常"));
    } finally {
      setSending(false);
    }
  };

  const handleAccept = (chat: ChapterAiChatItem) => {
    onAcceptText(chat.content, chat.selectedText);
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, applied: 1 } : c)));
  };

  const handleRetry = (chat: ChapterAiChatItem) => {
    handleSend(chat.actionType || "chat", chat.selectedText ? "" : chat.content);
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
      }
    } catch (e: any) {
      alert("保存碎片失败: " + (e?.message || "网络异常"));
    }
  };

  const filteredTagOptions = allTagOptions.filter((t) => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()));

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

  const getActionLabel = (actionType?: string) => {
    switch (actionType) {
      case "polish":
        return "智能润色";
      case "expand":
        return "场景扩写";
      case "shorten":
        return "精简缩写";
      case "continue":
        return "情节续写";
      case "tone":
        return "语气改写";
      case "critique":
        return "逻辑纠错";
      default:
        return "推演结果";
    }
  };

  return (
    <Box
      style={{
        width: collapsed ? 0 : 340,
        minWidth: collapsed ? 0 : 320,
        maxWidth: collapsed ? 0 : 380,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderLeft: collapsed ? "none" : "1px solid #f1f5f9",
        transition: "all 0.2s ease",
        overflow: "hidden",
        flexShrink: 0,
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? "none" : "auto",
        zIndex: 20,
      }}
    >
      <Flex justify="space-between" align="center" px="md" py={12} style={{ borderBottom: "1px solid #f8fafc" }}>
        <Group gap={6} align="center">
          <FiZap color="#0284c7" size={15} />
          <Text fz={13.5} fw={700} c="#1e293b">AI 协同创作助手</Text>
        </Group>
        {onToggleCollapse && (
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleCollapse}>
            <FiChevronRight size={14} />
          </ActionIcon>
        )}
      </Flex>

      <Box px="md" py={8} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fafbfc" }}>
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
              <Button
                size="compact-xs"
                variant="subtle"
                color="cyan"
                leftSection={<FiPlus size={10} />}
                onClick={() => setTagPopoverOpened((o) => !o)}
                style={{ fontSize: 11 }}
              >
                关联设定
              </Button>
            </Popover.Target>
            <Popover.Dropdown p={8}>
              <TextInput
                placeholder="搜索人物/地点/设定..."
                size="xs"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                mb={6}
              />
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

      <Box px="md" py={10} style={{ borderBottom: "1px solid #f8fafc" }}>
        <Flex gap={6} wrap="wrap">
          <Button size="xs" variant="default" onClick={() => handleSend("polish")} disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            智能润色
          </Button>
          <Button size="xs" variant="default" onClick={() => handleSend("expand")} disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            场景扩写
          </Button>
          <Button size="xs" variant="default" onClick={() => handleSend("shorten")} disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            精简缩写
          </Button>
          <Button size="xs" variant="default" onClick={() => handleSend("continue")} disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            情节续写
          </Button>
          <Button size="xs" variant="default" onClick={() => handleSend("tone")} disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            语气改写
          </Button>
          <Button size="xs" variant="default" onClick={() => handleSend("critique")} disabled={sending} style={{ flex: "1 1 30%", fontSize: 11.5, height: 28 }}>
            逻辑纠错
          </Button>
        </Flex>
      </Box>

      {selectedText && (
        <Box px="md" py={6} bg="#f0fdf4" style={{ borderBottom: "1px solid #dcfce7" }}>
          <Flex justify="space-between" align="center">
            <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
              <Badge size="xs" color="teal" variant="light">已选文本</Badge>
              <Text fz={11.5} c="#166534" truncate="end" style={{ flex: 1 }}>
                "{selectedText}"
              </Text>
              <Text fz={10.5} c="#15803d">({selectedText.length} 字)</Text>
            </Group>
            {onClearSelection && (
              <ActionIcon size="xs" variant="subtle" color="teal" onClick={onClearSelection} style={{ marginLeft: 6 }}>
                <FiX size={12} />
              </ActionIcon>
            )}
          </Flex>
        </Box>
      )}

      <ScrollArea style={{ flex: 1 }} px="md" py="xs" viewportRef={scrollViewportRef}>
        <Stack gap="md">
          {chats.map((item) => {
            if (item.role === "user") {
              return (
                <Box key={item.id} style={{ alignSelf: "flex-end", maxWidth: "90%" }}>
                  <Paper p="8px 12px" radius="md" bg="#f1f5f9" style={{ borderBottomRightRadius: 2 }}>
                    <Text fz={12} c="#1e293b" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {item.content}
                    </Text>
                  </Paper>
                  <Text fz={10} c="#94a3b8" ta="right" mt={2}>刚刚 · 作家</Text>
                </Box>
              );
            }

            return (
              <Box key={item.id} style={{ alignSelf: "flex-start", width: "100%" }}>
                <Paper p="10px 12px" radius="md" bg="#f0fdf4" style={{ border: "1px solid #bbf7d0" }}>
                  <Group justify="space-between" align="center" mb={6}>
                    <Group gap={4}>
                      <FiStar size={12} color="#16a34a" />
                      <Text fz={11.5} fw={700} c="#166534">
                        ✨ 【{getActionLabel(item.actionType)}】推荐结果：
                      </Text>
                    </Group>
                    {item.applied ? <Badge size="xs" color="teal" variant="light">已采纳</Badge> : null}
                  </Group>

                  <Text fz={12.5} c="#14532d" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {item.content}
                  </Text>

                  <Flex justify="flex-end" gap={6} mt={10} wrap="wrap">
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color={fragmentSavedIds[item.id] ? "teal" : "cyan"}
                      leftSection={<FiBookmark size={11} />}
                      onClick={() => handleSaveFragment(item)}
                      disabled={Boolean(fragmentSavedIds[item.id])}
                    >
                      {fragmentSavedIds[item.id] ? "已存为碎片" : "存为碎片"}
                    </Button>
                    <Button size="compact-xs" color="teal" leftSection={<FiCheck size={11} />} onClick={() => handleAccept(item)}>
                      采纳写入
                    </Button>
                    <Button size="compact-xs" variant="default" onClick={() => handleRetry(item)}>
                      重试
                    </Button>
                  </Flex>
                </Paper>
                <Text fz={10} c="#94a3b8" mt={2}>刚刚 · Novel AI</Text>
              </Box>
            );
          })}

          {sending && (
            <Box style={{ alignSelf: "flex-start", width: "100%" }}>
              <Paper p="10px 12px" radius="md" bg="#f8fafc" style={{ border: "1px dashed #cbd5e1" }}>
                <Group gap={8}>
                  <Loader size="xs" color="cyan" />
                  <Text fz={12} c="#64748b">AI 正在结合世界观与章节上下文严密推演中...</Text>
                </Group>
              </Paper>
            </Box>
          )}
        </Stack>
      </ScrollArea>

      <Box p="xs" px="md" style={{ borderTop: "1px solid #f1f5f9", backgroundColor: "#ffffff" }}>
        <Textarea
          placeholder={selectedText ? "输入针对选中文本的补充指令 (如: 增加更多技术细节)..." : "输入协同指令或自由提问..."}
          variant="unstyled"
          autosize
          minRows={2}
          maxRows={4}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend("chat");
            }
          }}
          styles={{
            input: {
              fontSize: 12.5,
              padding: "4px 0",
              color: "#1e293b",
            },
          }}
        />

        <Flex justify="space-between" align="center" mt={4}>
          <Text fz={10.5} c="#94a3b8">
            已关联 {selectedTags.length} 个设定 · 换行 Shift+Enter
          </Text>
          <ActionIcon
            size="sm"
            color="cyan"
            variant="filled"
            disabled={!inputText.trim() && !selectedText}
            loading={sending}
            onClick={() => handleSend("chat")}
          >
            <FiSend size={12} />
          </ActionIcon>
        </Flex>
      </Box>
    </Box>
  );
}

function UnstyledTagRow({ tag, onSelect }: { tag: ContextTagOption; onSelect: () => void }) {
  return (
    <Box
      onClick={onSelect}
      p="4px 6px"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 11.5,
        color: "#334155",
      }}
    >
      <Text fz={11.5} fw={500} truncate="end" style={{ flex: 1 }}>{tag.name}</Text>
      <Text fz={10} c="#94a3b8">{tag.desc || tag.type}</Text>
    </Box>
  );
}
