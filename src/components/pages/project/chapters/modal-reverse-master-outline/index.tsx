// 组件：从已有章节一键反推项目总纲节点树预览与确认落库弹窗
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Stack, Flex, Group, Text, Button, Badge, Paper, ScrollArea, SegmentedControl, Box } from "@mantine/core";
import { FiGitBranch, FiCheck, FiExternalLink, FiRefreshCw } from "react-icons/fi";
import { reverseMasterOutlineFromChapters } from "@/rest/outline";
import { MasterOutlineNode, saveMasterOutline } from "@/rest/master-outline";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";

interface ModalReverseMasterOutlineProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  writtenChapterCount: number;
}

function renderTreePreview(node: MasterOutlineNode, depth = 0): React.ReactNode {
  const isRoot = depth === 0;
  const tagColor = depth === 1 ? "blue" : depth === 2 ? "cyan" : "gray";

  return (
    <Box key={node.id} ml={depth > 0 ? 18 : 0} mt={depth === 0 ? 0 : 6}>
      <Paper
        p="8px 10px"
        radius="sm"
        bg={isRoot ? "#f0fcff" : depth === 1 ? "#f8fafc" : "#ffffff"}
        bd={isRoot ? "1px solid rgba(0, 201, 255, 0.35)" : "1px solid #e2e8f0"}
      >
        <Flex align="center" justify="space-between" gap={8} wrap="wrap">
          <Group gap={6}>
            {node.tag && (
              <Badge size="xs" variant={depth <= 1 ? "filled" : "light"} color={tagColor}>
                {node.tag}
              </Badge>
            )}
            <Text fz={isRoot ? 13.5 : depth === 1 ? 13 : 12.5} fw={isRoot || depth === 1 ? 700 : 600} c="#0f172a">
              {node.title}
            </Text>
          </Group>
          {node.chapterRange && (
            <Badge size="xs" variant="outline" color="cyan">
              第 {node.chapterRange} 章
            </Badge>
          )}
        </Flex>
        {node.note && (
          <Text fz={11.5} c="#64748b" mt={4} lh={1.55} lineClamp={3}>
            {node.note}
          </Text>
        )}
      </Paper>
      {Array.isArray(node.children) && node.children.length > 0 && (
        <Box pl={6} style={{ borderLeft: "1px dashed #cbd5e1" }}>
          {node.children.map((child) => renderTreePreview(child, depth + 1))}
        </Box>
      )}
    </Box>
  );
}

export default function ModalReverseMasterOutline({
  opened,
  onClose,
  workId,
  writtenChapterCount,
}: ModalReverseMasterOutlineProps) {
  const router = useRouter();
  const [mergeMode, setMergeMode] = useState<"merge" | "replace">("merge");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewTree, setPreviewTree] = useState<MasterOutlineNode | null>(null);
  const [stats, setStats] = useState<{ mappedChaptersCount: number; nodeCount: number } | null>(null);
  const [savedDone, setSavedDone] = useState(false);

  const handleGeneratePreview = async () => {
    if (!workId || generating) return;
    try {
      setGenerating(true);
      setSavedDone(false);
      const res = await reverseMasterOutlineFromChapters({
        workId,
        mode: "all",
        mergeMode,
        autoSave: false,
      });
      if (res && res.success && res.result?.tree) {
        setPreviewTree(res.result.tree);
        setStats({
          mappedChaptersCount: res.result.mappedChaptersCount,
          nodeCount: res.result.nodeCount,
        });
        useAlert.success(`反推预览已生成（覆盖 ${res.result.mappedChaptersCount} 章，共 ${res.result.nodeCount} 个节点）`);
      } else {
        useAlert.error(res?.message || "反推总纲树失败");
      }
    } catch (e: any) {
      useAlert.error("反推异常: " + (e?.message || "网络错误"));
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!workId || !previewTree || saving) return;
    try {
      setSaving(true);
      const res = await saveMasterOutline({ workId, tree: previewTree });
      if (res && res.success) {
        setSavedDone(true);
        useAlert.success("已成功写入「1. 项目总纲」节点树！");
      } else {
        useAlert.error(res?.message || "保存总纲树失败");
      }
    } catch (e: any) {
      useAlert.error("保存异常: " + (e?.message || "网络错误"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={8}>
          <FiGitBranch size={16} color="#00c9ff" />
          <Text fw={700} fz={15} c="#0f172a">
            从已有章节一键反推项目总纲节点树
          </Text>
        </Group>
      }
      size="lg"
      centered
      radius="md"
    >
      <Stack gap="sm" pos="relative">
        <LoadingMask visible={generating} label="AI 正在梳理已有分卷与章节内容，反推生成三层总纲节点树..." />

        <Paper p="sm" radius="sm" bg="#f8fafc" bd="1px solid #e2e8f0">
          <Flex align="center" justify="space-between" gap={12} wrap="wrap">
            <Box flex={1} miw={220}>
              <Text fz={12.5} fw={600} c="#1e293b">
                当前检测到 {writtenChapterCount} 个含有效正文的章节
              </Text>
              <Text fz={11.5} c="#64748b" mt={2}>
                优先复用已提取章节大纲（仅 1 次 AI 调用），生成「分卷/阶段 ➔ 剧情弧 ➔ 章节细纲」三级树，供后续推演无缝衔接。
              </Text>
            </Box>
            <SegmentedControl
              size="xs"
              value={mergeMode}
              onChange={(v) => setMergeMode(v as "merge" | "replace")}
              data={[
                { label: "增量合并（保留未来规划）", value: "merge" },
                { label: "完全重建总纲树", value: "replace" },
              ]}
            />
          </Flex>
        </Paper>

        {!previewTree ? (
          <Paper p="xl" radius="sm" bg="#ffffff" bd="1px dashed #cbd5e1" ta="center">
            <Text fz={13} c="#64748b" mb="sm">
              点击下方按钮开始反推，生成后可先预览层级结构，确认无误再覆盖写入项目总纲。
            </Text>
            <Button size="sm" leftSection={<FiGitBranch size={14} />} loading={generating} disabled={writtenChapterCount === 0} onClick={handleGeneratePreview}>
              开始反推总纲节点树
            </Button>
          </Paper>
        ) : (
          <Box>
            <Flex align="center" justify="space-between" mb={6}>
              <Group gap={6}>
                <Badge size="sm" variant="light" color="cyan">
                  覆盖 {stats?.mappedChaptersCount || 0} 章
                </Badge>
                <Badge size="sm" variant="light" color="blue">
                  共 {stats?.nodeCount || 0} 个层级节点
                </Badge>
              </Group>
              <Button size="compact-xs" variant="subtle" leftSection={<FiRefreshCw size={11} />} onClick={handleGeneratePreview} loading={generating}>
                重新反推
              </Button>
            </Flex>
            <ScrollArea h={380} p={4} bd="1px solid #f1f5f9" bdrs={6}>
              {renderTreePreview(previewTree, 0)}
            </ScrollArea>
          </Box>
        )}

        <Flex justify="space-between" align="center" pt={8} style={{ borderTop: "1px solid #f1f5f9" }}>
          <Button variant="default" size="xs" onClick={onClose}>
            关闭
          </Button>
          <Group gap={8}>
            {savedDone && (
              <Button
                size="xs"
                variant="light"
                color="cyan"
                leftSection={<FiExternalLink size={12} />}
                onClick={() => {
                  onClose();
                  router.push(`/project/${workId}?tab=outline`);
                }}
              >
                前往项目总纲查看导图
              </Button>
            )}
            {previewTree && (
              <Button size="xs" leftSection={<FiCheck size={13} />} loading={saving} onClick={handleConfirmSave}>
                {savedDone ? "再次保存覆盖总纲树" : "确认写入项目总纲"}
              </Button>
            )}
          </Group>
        </Flex>
      </Stack>
    </Modal>
  );
}
