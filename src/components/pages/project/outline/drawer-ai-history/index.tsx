"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Stack,
  Box,
  Flex,
  Text,
  Badge,
  Button,
  Paper,
  ScrollArea,
  ActionIcon,
  Loader,
  Tooltip,
} from "@mantine/core";
import { FiClock, FiTrash2, FiEye, FiCheckCircle } from "react-icons/fi";
import {
  OutlineAiHistoryRecord,
  getOutlineAiHistoryList,
  deleteOutlineAiHistoryRecord,
} from "@/rest/outline";
import dayjs from "dayjs";

interface DrawerAiHistoryProps {
  opened: boolean;
  onClose: () => void;
  workId: number | string;
  onSelectVersion: (record: OutlineAiHistoryRecord) => void;
}

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  generate_from_premise: { label: "一句话生大纲", color: "violet" },
  plan_chapters: { label: "章节规划", color: "blue" },
  expand_node: { label: "节点细化扩写", color: "teal" },
  split_node: { label: "情节点拆解", color: "cyan" },
  find_plot_holes: { label: "伏笔漏洞排查", color: "orange" },
  polish_rhythm: { label: "节奏润色", color: "indigo" },
  generate_alternatives: { label: "支线脑洞", color: "pink" },
  diagnose: { label: "大纲全面体检", color: "grape" },
};

export default function DrawerAiHistory({
  opened,
  onClose,
  workId,
  onSelectVersion,
}: DrawerAiHistoryProps) {
  const [historyList, setHistoryList] = useState<OutlineAiHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchHistory = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getOutlineAiHistoryList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setHistoryList(res.result);
      }
    } catch (e) {
      console.error("加载 AI 推演历史失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      fetchHistory();
    }
  }, [opened, workId]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      setDeletingId(id);
      const res = await deleteOutlineAiHistoryRecord(id);
      if (res && res.success) {
        setHistoryList((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (e) {
      console.error("删除历史记录失败:", e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApply = (record: OutlineAiHistoryRecord) => {
    onSelectVersion(record);
    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Flex align="center" gap={8}>
          <FiClock size={18} color="#00c9ff" />
          <Text fw={700} fz={16}>
            AI 推演历史版本库
          </Text>
          <Badge size="sm" color="blue" variant="light">
            {historyList.length} 条版本
          </Badge>
        </Flex>
      }
    >
      <Stack gap="12px" h="calc(100vh - 80px)">
        <Text fz={12} c="#64748b">
          系统已自动为您保存每次由 AI 推演生成的故事方案，您可以随时回顾对比或选中使用历史方案覆盖至大纲：
        </Text>

        <ScrollArea style={{ flex: 1 }} offsetScrollbars>
          {loading ? (
            <Flex justify="center" align="center" h={200}>
              <Loader size="md" color="blue" />
            </Flex>
          ) : historyList.length === 0 ? (
            <Box p="40px 20px" ta="center">
              <Text fz={14} c="#94a3b8">
                暂无 AI 推演历史记录
              </Text>
              <Text fz={12} c="#cbd5e1" mt={4}>
                点击顶部「AI 智能推演」生成的方案将自动沉淀于此
              </Text>
            </Box>
          ) : (
            <Stack gap="12px">
              {historyList.map((item) => {
                const actionMeta = ACTION_MAP[item.action] || {
                  label: item.action,
                  color: "gray",
                };
                const timeStr = item.createdAt
                  ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss")
                  : "未知时间";

                return (
                  <Paper
                    key={item.id}
                    p="14px"
                    bg="#f8fafc"
                    bd="1px solid #e2e8f0"
                    radius="md"
                    style={{ transition: "all 0.2s ease" }}
                  >
                    <Flex justify="space-between" align="flex-start" mb={6}>
                      <Flex align="center" gap={6}>
                        <Badge size="sm" color={actionMeta.color} variant="filled">
                          {actionMeta.label}
                        </Badge>
                        <Text fz={12} c="#94a3b8">
                          {timeStr}
                        </Text>
                      </Flex>
                      <Tooltip label="删除此条记录">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          loading={deletingId === item.id}
                          onClick={(e) => handleDelete(e, item.id)}
                        >
                          <FiTrash2 size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Flex>

                    <Text fz={14} fw={700} c="#1e293b" mb={4}>
                      {item.title}
                    </Text>

                    {item.prompt && (
                      <Box p="6px 10px" bg="#ffffff" bd="1px solid #e2e8f0" style={{ borderRadius: 6 }} mb={10}>
                        <Text fz={11} c="#64748b" lineClamp={2}>
                          <b>诉求/梗概：</b>{item.prompt}
                        </Text>
                      </Box>
                    )}

                    <Flex justify="flex-end" gap={8} mt={8}>
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        leftSection={<FiEye size={13} />}
                        onClick={() => handleApply(item)}
                      >
                        查看并使用此版本
                      </Button>
                    </Flex>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </ScrollArea>
      </Stack>
    </Drawer>
  );
}
