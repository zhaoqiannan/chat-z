"use client";

import React, { useState } from "react";
import {
  Modal,
  Button,
  Stack,
  Flex,
  Text,
  Paper,
  Badge,
  Timeline,
  Box,
} from "@mantine/core";
import { FiZap, FiCheck, FiFolder, FiFileText } from "react-icons/fi";
import { requestAiPlan } from "@/rest/outline";

interface ModalAiPlanProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  onSuccess: () => void;
}

export default function ModalAiPlan({
  opened,
  onClose,
  workId,
  onSuccess,
}: ModalAiPlanProps) {
  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState<any[] | null>(null);

  const handleGeneratePreview = async () => {
    try {
      setLoading(true);
      const res = await requestAiPlan(workId, false);
      if (res && res.success && res.result) {
        setPlanResult(res.result);
      }
    } catch (e) {
      console.error("生成预览失败", e);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToWork = async () => {
    try {
      setLoading(true);
      const res = await requestAiPlan(workId, true);
      if (res && res.success) {
        onSuccess();
        onClose();
      }
    } catch (e) {
      console.error("应用大纲失败", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (opened) {
      setPlanResult(null);
      handleGeneratePreview();
    }
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <FiZap color="#8b5cf6" size={18} />
          <Text fw={700} fz={16} c="#1e293b">
            AI 智能大纲推演与章节规划
          </Text>
        </Flex>
      }
      centered
      size="xl"
      radius="md"
    >
      <Stack gap="16px">
        <Text fz={13} c="#64748b">
          AI 已结合当前小说作品的题材设定、目标字数与核心主线，推演规划出以下层级化大纲体系：
        </Text>

        <Paper
          p="16px"
          bg="#f8fafc"
          style={{ maxHeight: "380px", overflowY: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}
        >
          {loading && !planResult ? (
            <Flex justify="center" align="center" py={40} gap={8} c="#8b5cf6">
              <Text fz={13} fw={500}>
                AI 正在推演起承转合与章节结构...
              </Text>
            </Flex>
          ) : (
            <Stack gap="14px">
              {planResult?.map((vol: any, idx: number) => (
                <Paper key={idx} p="14px" bg="#ffffff" radius="md" withBorder>
                  <Flex align="center" gap={8} mb={6}>
                    <Badge color="indigo" variant="light">
                      卷 / 篇章
                    </Badge>
                    <Text fw={700} fz={14} c="#1e293b">
                      {vol.title}
                    </Text>
                  </Flex>
                  <Text fz={12} c="#475569" mb={4}>
                    🎯 <b>目标：</b>{vol.goal}
                  </Text>
                  <Text fz={12} c="#64748b" mb={8}>
                    ⚡ <b>冲突：</b>{vol.conflict} | 📖 <b>范围：</b>{vol.linkedChapters}
                  </Text>

                  {vol.children && (
                    <Box pl={12} style={{ borderLeft: "2px solid #e2e8f0" }}>
                      {vol.children.map((act: any, aIdx: number) => (
                        <Box key={aIdx} mt={6}>
                          <Flex align="center" gap={6}>
                            <Badge color="yellow" variant="light" size="xs">
                              幕
                            </Badge>
                            <Text fz={13} fw={600} c="#334155">
                              {act.title}
                            </Text>
                          </Flex>
                          <Text fz={12} c="#64748b" pl={2}>
                            {act.goal}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Flex justify="flex-end" gap="10px" mt="6px">
          <Button variant="outline" color="gray" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            color="violet"
            leftSection={<FiCheck size={14} />}
            loading={loading}
            onClick={handleApplyToWork}
          >
            一键应用并写入作品大纲树
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
