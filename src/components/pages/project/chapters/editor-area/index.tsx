"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Paper,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  FiSave,
  FiZap,
  FiCheckCircle,
  FiEdit,
  FiFileText,
  FiColumns,
  FiInfo,
} from "react-icons/fi";
import { ChapterItem, UpdateChapterPayload, requestChapterAiOptimize } from "@/rest/chapter";
import styles from "../style.module.scss";

interface EditorAreaProps {
  workId: string;
  chapter: ChapterItem | null;
  onUpdateContent: (data: UpdateChapterPayload) => Promise<void>;
  onOpenAiDraft: () => void;
  onOpenDetailModal: () => void;
  onEnterDiffView: (optimizedText: string) => void;
}

export default function EditorArea({
  workId,
  chapter,
  onUpdateContent,
  onOpenAiDraft,
  onOpenDetailModal,
  onEnterDiffView,
}: EditorAreaProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (chapter) {
      setContent(chapter.content || "");
      setSavedSuccess(false);
    } else {
      setContent("");
    }
  }, [chapter]);

  if (!chapter || chapter.isVolume) {
    return (
      <Box className={styles.detailPanel}>
        <Flex
          direction="column"
          align="center"
          justify="center"
          h="100%"
          gap={12}
          c="#94a3b8"
        >
          <FiFileText size={48} strokeWidth={1.2} />
          <Text fz={15} fw={600}>
            {chapter?.isVolume ? "当前选中为分卷目录" : "请在左侧选择一个正文章节开始创作"}
          </Text>
          <Text fz={13}>
            {chapter?.isVolume
              ? "可点击卷节点旁边的 ℹ️ 查看/修改分卷设定，或在左侧点击具体章节进入正文写作"
              : "支持沉浸式正文输入、AI 生成初稿、AI 润色与双栏对比优化"}
          </Text>
        </Flex>
      </Box>
    );
  }

  // 实时字数
  const liveWordCount = content.replace(/\s+/g, "").length;

  const handleSave = async () => {
    try {
      setLoading(true);
      await onUpdateContent({
        id: chapter.id,
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
        return <Badge color="green" variant="light">已完成</Badge>;
      case "revising":
        return <Badge color="yellow" variant="light">修改/写作中</Badge>;
      default:
        return <Badge color="gray" variant="light">未开始</Badge>;
    }
  };

  return (
    <Box className={styles.detailPanel}>
      {/* 顶部标题与操作工具栏 */}
      <Flex justify="space-between" align="center" mb={16}>
        <Box>
          <Flex align="center" gap={8}>
            <Text fz={20} fw={700} c="#1e293b">
              {chapter.title}
            </Text>
            {getStatusBadge(chapter.status)}

            <Tooltip label="查看/编辑章节设定" withArrow position="top">
              <ActionIcon
                variant="subtle"
                color="blue"
                size="sm"
                onClick={onOpenDetailModal}
              >
                <FiInfo size={15} />
              </ActionIcon>
            </Tooltip>
          </Flex>

          <Flex align="center" gap={10} mt={4} fz={12} c="#64748b">
            <span>
              正文字数：<b>{liveWordCount.toLocaleString()}</b> 字
            </span>
            {chapter.summary && (
              <>
                <span>·</span>
                <span style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  大纲备忘：{chapter.summary}
                </span>
              </>
            )}
          </Flex>
        </Box>

        <Flex gap={10} align="center">
          {savedSuccess && (
            <Flex align="center" gap={4} fz={13} c="#10b981" fw={600}>
              <FiCheckCircle size={15} />
              已保存
            </Flex>
          )}

          <Button
            variant="light"
            color="violet"
            leftSection={<FiZap size={14} />}
            onClick={onOpenAiDraft}
          >
            AI 生成初稿
          </Button>

          <Button
            variant="outline"
            color="teal"
            leftSection={<FiColumns size={14} />}
            loading={optimizing}
            onClick={handleAiOptimize}
          >
            AI 润色与对比
          </Button>

          <Button
            bg="#00c9ff"
            leftSection={<FiSave size={14} />}
            loading={loading}
            onClick={handleSave}
          >
            保存正文
          </Button>
        </Flex>
      </Flex>

      {/* 核心写作文本域 */}
      <Box className={styles.card} style={{ minHeight: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
        <textarea
          className={styles.editorTextarea}
          style={{ flex: 1, minHeight: 480 }}
          placeholder="在此开始撰写章节正文（可直接点击上方「AI 生成初稿」或输入草稿后点击「AI 润色与对比」）..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </Box>
    </Box>
  );
}
