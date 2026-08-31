"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Paper,
  ActionIcon,
  Tooltip,
  TextInput,
  Loader,
  Group,
  Divider,
} from "@mantine/core";
import {
  FiSave,
  FiZap,
  FiCheckCircle,
  FiFileText,
  FiColumns,
  FiInfo,
  FiStar,
  FiMaximize2,
  FiMinimize2,
  FiEye,
  FiMessageSquare,
  FiSend,
  FiCheck,
  FiX,
  FiSidebar,
  FiClock,
} from "react-icons/fi";
import {
  ChapterItem,
  UpdateChapterPayload,
  requestChapterAiOptimize,
  requestChapterSelectionAi,
} from "@/rest/chapter";
import DrawerAiHistory from "../drawer-ai-history";
import styles from "../style.module.scss";

interface EditorAreaProps {
  workId: string;
  chapter: ChapterItem | null;
  treeCollapsed: boolean;
  onToggleTree: () => void;
  onUpdateContent: (data: UpdateChapterPayload) => Promise<void>;
  onOpenAiDraft: () => void;
  onOpenDetailModal: () => void;
  onEnterDiffView: (optimizedText: string) => void;
}

export default function EditorArea({
  workId,
  chapter,
  treeCollapsed,
  onToggleTree,
  onUpdateContent,
  onOpenAiDraft,
  onOpenDetailModal,
  onEnterDiffView,
}: EditorAreaProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [historyDrawerOpened, setHistoryDrawerOpened] = useState(false);

  // 划选选区状态
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [bubblePosition, setBubblePosition] = useState<{ x: number; y: number } | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectionAiLoading, setSelectionAiLoading] = useState(false);

  // 局部 AI 替换预览
  const [diffCandidate, setDiffCandidate] = useState<{
    start: number;
    end: number;
    original: string;
    replacement: string;
  } | null>(null);

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title || "");
      setContent(chapter.content || "");
      setSavedSuccess(false);
      setDiffCandidate(null);
      setSelectionRange(null);
      setBubblePosition(null);
    } else {
      setTitle("");
      setContent("");
    }
  }, [chapter]);

  // 监听划选文字事件
  const handleSelectText = () => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (start !== end && end - start > 0) {
      const selected = el.value.substring(start, end).trim();
      if (selected) {
        setSelectionRange({ start, end, text: selected });

        // 获取鼠标或选区大致屏幕位置
        const rect = el.getBoundingClientRect();
        setBubblePosition({
          x: Math.min(Math.max(rect.left + 40, 140), window.innerWidth - 500),
          y: Math.max(rect.top - 50, 70),
        });
        return;
      }
    }

    setBubblePosition(null);
    setSelectionRange(null);
  };

  // 右键菜单直接触发
  const handleContextMenu = (e: React.MouseEvent) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (start !== end && end - start > 0) {
      const selected = el.value.substring(start, end).trim();
      if (selected) {
        e.preventDefault();
        setSelectionRange({ start, end, text: selected });
        setBubblePosition({
          x: Math.min(e.clientX, window.innerWidth - 480),
          y: Math.max(e.clientY - 60, 70),
        });
      }
    }
  };

  // 执行划选 AI 动作
  const handleExecuteSelectionAi = async (
    actionType: "polish" | "expand" | "shorten" | "enrich_desc" | "dialogue" | "custom"
  ) => {
    if (!selectionRange || !chapter) return;

    try {
      setSelectionAiLoading(true);
      const res = await requestChapterSelectionAi({
        workId,
        chapterId: chapter.id,
        mode: "selection_ai",
        selectedText: selectionRange.text,
        actionType,
        customInstruction: actionType === "custom" ? customPrompt : undefined,
        fullContext: content,
      });

      if (res && res.success && res.result?.processedText) {
        setDiffCandidate({
          start: selectionRange.start,
          end: selectionRange.end,
          original: selectionRange.text,
          replacement: res.result.processedText,
        });
        setBubblePosition(null);
        setCustomPrompt("");
      }
    } catch (e: any) {
      alert("AI 局部处理失败: " + (e?.message || "网络异常"));
    } finally {
      setSelectionAiLoading(false);
    }
  };

  // 采纳局部替换
  const handleAcceptSelectionDiff = () => {
    if (!diffCandidate) return;
    const before = content.substring(0, diffCandidate.start);
    const after = content.substring(diffCandidate.end);
    const newContent = before + diffCandidate.replacement + after;

    setContent(newContent);
    setDiffCandidate(null);
    setSelectionRange(null);
  };

  // 放弃局部替换
  const handleRejectSelectionDiff = () => {
    setDiffCandidate(null);
    setSelectionRange(null);
  };

  if (!chapter || chapter.isVolume) {
    return (
      <Box className={styles.editorContainer}>
        <Flex
          direction="column"
          align="center"
          justify="center"
          h="100%"
          gap={12}
          c="#94a3b8"
        >
          {treeCollapsed && (
            <Button
              variant="light"
              color="cyan"
              leftSection={<FiSidebar size={14} />}
              onClick={onToggleTree}
              mb={10}
            >
              展开目录选择章节
            </Button>
          )}
          <FiFileText size={48} strokeWidth={1.2} />
          <Text fz={15} fw={600} c="#475569">
            {chapter?.isVolume ? "当前选中为分卷目录" : "请在左侧目录选择一个正文章节开始创作"}
          </Text>
          <Text fz={13} c="#94a3b8">
            {chapter?.isVolume
              ? "可点击卷节点旁边的 ℹ️ 查看设定，或展开具体章节进入正文写作"
              : "纯白沉浸式写作工作台 · 支持划选 AI 润色、智能扩写与双栏对比"}
          </Text>
        </Flex>
      </Box>
    );
  }

  // 实时字数与预估阅读时间
  const liveWordCount = content.replace(/\s+/g, "").length;
  const estimatedReadMinutes = Math.max(1, Math.round(liveWordCount / 400));

  const handleSave = async () => {
    try {
      setLoading(true);
      await onUpdateContent({
        id: chapter.id,
        title: title.trim() || chapter.title,
        content,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error("保存正文失败", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiOptimize = async () => {
    if (!content.trim()) {
      alert("请先输入部分正文内容后再进行 AI 润色优化！");
      return;
    }

    try {
      setOptimizing(true);
      const res = await requestChapterAiOptimize({
        workId,
        chapterId: chapter.id,
        mode: "optimize",
        currentContent: content,
        optimizeGoal: "增强环境氛围与情绪张力，优化动作神态描写",
      });

      if (res && res.success && res.result?.optimizedText) {
        onEnterDiffView(res.result.optimizedText);
      }
    } catch (e) {
      console.error("AI 优化失败", e);
    } finally {
      setOptimizing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge color="green" variant="light" size="sm">已完稿</Badge>;
      case "revising":
        return <Badge color="yellow" variant="light" size="sm">写作中</Badge>;
      default:
        return <Badge color="gray" variant="light" size="sm">草稿</Badge>;
    }
  };

  return (
    <Box className={styles.editorContainer}>
      {/* 1. 顶部极简状态与操作工具栏 */}
      <header className={styles.editorHeader}>
        <Flex align="center" gap={12}>
          {treeCollapsed && (
            <Tooltip label="展开目录大纲" withArrow position="bottom">
              <ActionIcon variant="subtle" color="gray" size="md" onClick={onToggleTree}>
                <FiSidebar size={16} />
              </ActionIcon>
            </Tooltip>
          )}

          <Flex align="center" gap={8}>
            <span className={`${styles.statusDot} ${styles[chapter.status] || styles.not_started}`} />
            <Text fz={14} fw={700} c="#1e293b">
              第 {chapter.chapterNumber} 章
            </Text>
            {getStatusBadge(chapter.status)}
            <Tooltip label="章节设定与大纲备忘" withArrow position="bottom">
              <ActionIcon variant="subtle" color="gray" size="xs" onClick={onOpenDetailModal}>
                <FiInfo size={13} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        </Flex>

        <Flex gap={10} align="center">
          {savedSuccess && (
            <Flex align="center" gap={4} fz={12} c="#10b981" fw={600} mr={6}>
              <FiCheckCircle size={14} />
              已自动保存
            </Flex>
          )}

          <Button
            size="xs"
            variant="light"
            color="violet"
            leftSection={<FiZap size={13} />}
            onClick={onOpenAiDraft}
          >
            AI 生成初稿
          </Button>

          <Button
            size="xs"
            variant="light"
            color="teal"
            leftSection={<FiColumns size={13} />}
            loading={optimizing}
            onClick={handleAiOptimize}
          >
            全文润色对比
          </Button>

          <Button
            size="xs"
            variant="default"
            leftSection={<FiClock size={13} />}
            onClick={() => setHistoryDrawerOpened(true)}
          >
            历史版本
          </Button>

          <Button
            size="xs"
            color="cyan"
            leftSection={<FiSave size={13} />}
            loading={loading}
            onClick={handleSave}
          >
            保存
          </Button>
        </Flex>
      </header>

      {/* 2. 居中沉浸式纸张画布 */}
      <div className={styles.editorScrollArea}>
        <div className={styles.zenPaperCanvas}>
          {/* 章节大标题 (支持就地实时编辑) */}
          <input
            className={styles.chapterTitleInput}
            placeholder="输入章节标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* 稿纸副信息栏 */}
          <div className={styles.metaInfoBar}>
            <span>字数：<b>{liveWordCount.toLocaleString()}</b> 字</span>
            <span>·</span>
            <Flex align="center" gap={4}>
              <FiClock size={12} />
              <span>预计阅读 {estimatedReadMinutes} 分钟</span>
            </Flex>
            {chapter.summary && (
              <>
                <span>·</span>
                <span style={{ maxWidth: 450, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  大纲要点：{chapter.summary}
                </span>
              </>
            )}
          </div>

          {/* 正文写作文本域 */}
          <div className={styles.editorWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.zenTextarea}
              placeholder="在此开始撰写正文...&#10;&#10;✨ 提示：选中任意一段文字即可唤起 AI 悬浮润色、扩写、精炼与强化工具条。"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={handleSelectText}
              onMouseUp={handleSelectText}
              onKeyUp={handleSelectText}
              onContextMenu={handleContextMenu}
            />

            {/* 划选文字 AI 创作浮动气泡胶囊 */}
            {bubblePosition && selectionRange && (
              <div
                className={styles.selectionAiBubble}
                style={{ top: bubblePosition.y, left: bubblePosition.x }}
              >
                {selectionAiLoading ? (
                  <Flex align="center" gap={8} p="4px 8px">
                    <Loader size="xs" color="cyan" />
                    <Text fz={12} c="#0369a1" fw={600}>
                      AI 正在精心推演处理中...
                    </Text>
                  </Flex>
                ) : (
                  <Flex align="center" gap={4} wrap="wrap">
                    <Button
                      size="xs"
                      variant="subtle"
                      color="cyan"
                      leftSection={<FiStar size={12} />}
                      onClick={() => handleExecuteSelectionAi("polish")}
                    >
                      润色
                    </Button>

                    <Button
                      size="xs"
                      variant="subtle"
                      color="indigo"
                      leftSection={<FiMaximize2 size={12} />}
                      onClick={() => handleExecuteSelectionAi("expand")}
                    >
                      扩写
                    </Button>

                    <Button
                      size="xs"
                      variant="subtle"
                      color="orange"
                      leftSection={<FiMinimize2 size={12} />}
                      onClick={() => handleExecuteSelectionAi("shorten")}
                    >
                      精炼
                    </Button>

                    <Button
                      size="xs"
                      variant="subtle"
                      color="teal"
                      leftSection={<FiEye size={12} />}
                      onClick={() => handleExecuteSelectionAi("enrich_desc")}
                    >
                      强化描写
                    </Button>

                    <Button
                      size="xs"
                      variant="subtle"
                      color="pink"
                      leftSection={<FiMessageSquare size={12} />}
                      onClick={() => handleExecuteSelectionAi("dialogue")}
                    >
                      台词生动
                    </Button>

                    <Divider orientation="vertical" />

                    <TextInput
                      size="xs"
                      placeholder="输入自定义改写要求..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customPrompt.trim()) {
                          handleExecuteSelectionAi("custom");
                        }
                      }}
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="filled"
                          color="cyan"
                          onClick={() => handleExecuteSelectionAi("custom")}
                        >
                          <FiSend size={11} />
                        </ActionIcon>
                      }
                      style={{ width: 170 }}
                    />

                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => {
                        setBubblePosition(null);
                        setSelectionRange(null);
                      }}
                    >
                      <FiX size={13} />
                    </ActionIcon>
                  </Flex>
                )}
              </div>
            )}
          </div>

          {/* 局部 AI 替换 Diff 预览区域 */}
          {diffCandidate && (
            <Paper className={styles.diffPreviewBox} shadow="sm">
              <Flex justify="space-between" align="center" mb={10}>
                <Flex align="center" gap={8}>
                  <Badge color="cyan" variant="filled" size="sm">
                    AI 片段改写建议
                  </Badge>
                  <Text fz={13} c="#64748b">
                    请确认是否将原片段替换为 AI 优化版本：
                  </Text>
                </Flex>

                <Group gap={8}>
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<FiCheck size={13} />}
                    onClick={handleAcceptSelectionDiff}
                  >
                    采纳并替换
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    leftSection={<FiX size={13} />}
                    onClick={handleRejectSelectionDiff}
                  >
                    放弃
                  </Button>
                </Group>
              </Flex>

              <Flex gap={16} mt={8}>
                <Box style={{ flex: 1, background: "#fee2e2", padding: "10px 14px", borderRadius: 8, border: "1px solid #fca5a5" }}>
                  <Text fz={11} fw={700} c="#991b1b" mb={4}>
                    【原始划选片段】：
                  </Text>
                  <Text fz={13.5} c="#7f1d1d" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {diffCandidate.original}
                  </Text>
                </Box>

                <Box style={{ flex: 1, background: "#dcfce7", padding: "10px 14px", borderRadius: 8, border: "1px solid #86efac" }}>
                  <Text fz={11} fw={700} c="#166534" mb={4}>
                    【AI 优化后片段】：
                  </Text>
                  <Text fz={13.5} c="#14532d" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {diffCandidate.replacement}
                  </Text>
                </Box>
              </Flex>
            </Paper>
          )}
        </div>
      </div>

      {/* 3. 底部极简状态栏 */}
      <footer className={styles.bottomStatusBar}>
        <span>章节创作工作台 · 专注模式</span>
        <Flex gap={14}>
          <span>字数统计：{liveWordCount} 字</span>
          <span>·</span>
          <span>段落数：{content.split("\n").filter((p) => p.trim()).length} 段</span>
        </Flex>
      </footer>

      {/* 4. AI 创作历史版本抽屉与 70vw 弹窗 */}
      <DrawerAiHistory
        opened={historyDrawerOpened}
        onClose={() => setHistoryDrawerOpened(false)}
        chapterId={chapter.id}
        workId={workId}
        chapterTitle={`第 ${chapter.chapterNumber} 章 ${chapter.title || ""}`}
        onApplyHistory={(historyContent) => {
          setContent(historyContent);
        }}
      />
    </Box>
  );
}
