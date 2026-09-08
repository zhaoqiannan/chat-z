"use client";

import React from "react";
import { Box, Flex, Text, Paper, Button, Badge } from "@mantine/core";
import { FiZap, FiAlertTriangle, FiInfo, FiCheckCircle, FiRefreshCw } from "react-icons/fi";
import styles from "../style.module.scss";

export interface SuggestionItem {
  id: string | number;
  type?: string; // 'warning' | 'tip' | 'success' | 'info' | 'inspiration'
  title: string;
  content: string;
}

interface AiSuggestionsProps {
  suggestions?: SuggestionItem[];
  loading?: boolean;
  onDiagnose?: () => void;
}

export default function AiSuggestions({
  suggestions,
  loading = false,
  onDiagnose,
}: AiSuggestionsProps) {
  const hasData = suggestions && suggestions.length > 0;

  return (
    <Paper p={20} bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
      <Flex justify="space-between" align="center" mb={14} gap={8}>
        <Flex align="center" gap={8}>
          <FiZap size={18} color="#00c9ff" />
          <Text fz={15} fw={700} c="#1e293b">
            AI 创意智囊建议
          </Text>
        </Flex>

        {onDiagnose && (
          <Button
            size="xs"
            variant="light"
            color="cyan"
            loading={loading}
            onClick={onDiagnose}
            leftSection={<FiRefreshCw size={12} />}
          >
            {hasData ? "重新诊断" : "智能体检"}
          </Button>
        )}
      </Flex>

      {hasData ? (
        <Flex direction="column" gap={12}>
          {suggestions.map((suggestion) => {
            const isSuccess = suggestion.type === "success";
            const isInfo = suggestion.type === "info" || suggestion.type === "tip";
            
            let bg = "#fffbeb";
            let bd = "1px solid #fef3c7";
            let titleColor = "#b45309";
            let contentColor = "#92400e";
            let Icon = FiAlertTriangle;

            if (isSuccess) {
              bg = "#f0fdf4";
              bd = "1px solid #dcfce7";
              titleColor = "#15803d";
              contentColor = "#166534";
              Icon = FiCheckCircle;
            } else if (isInfo) {
              bg = "#f0f9ff";
              bd = "1px solid #e0f2fe";
              titleColor = "#0369a1";
              contentColor = "#075985";
              Icon = FiInfo;
            }

            return (
              <Box
                key={suggestion.id}
                bg={bg}
                bd={bd}
                p="14px 16px"
                style={{ borderRadius: 8 }}
              >
                <Flex align="center" gap={6} c={titleColor} fz={13} fw={700} mb={8}>
                  <Icon size={15} />
                  <span>{suggestion.title}</span>
                </Flex>
                <Text fz={12} c={contentColor} lh={1.6}>
                  {suggestion.content}
                </Text>
              </Box>
            );
          })}
        </Flex>
      ) : (
        <Box
          p="20px 16px"
          bg="#f8fafc"
          bd="1px dashed #cbd5e1"
          style={{ borderRadius: 8, textAlign: "center" }}
        >
          <Text fz={13} fw={600} c="#475569" mb={4}>
            按需诊断，避免消耗 Token
          </Text>
          <Text fz={12} c="#94a3b8" mb={12} lh={1.5}>
            点击按钮即可对人物、阵营与大纲设定进行轻量级冲突诊断与灵感启发。
          </Text>
          {onDiagnose && (
            <Button
              size="xs"
              color="cyan"
              loading={loading}
              onClick={onDiagnose}
              leftSection={<FiZap size={14} />}
            >
              开始智能体检
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
