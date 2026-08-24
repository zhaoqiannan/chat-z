"use client";

import React from "react";
import { Box, Flex, Text, Paper } from "@mantine/core";
import { FiZap, FiAlertTriangle } from "react-icons/fi";
import NoData from "@/components/common/no-data";

export interface SuggestionItem {
  id: string | number;
  type?: string;
  title: string;
  content: string;
}

interface AiSuggestionsProps {
  suggestions?: SuggestionItem[];
}

export default function AiSuggestions({ suggestions }: AiSuggestionsProps) {
  return (
    <Paper p={20} bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
      <Flex align="center" gap={8} mb={14}>
        <FiZap size={18} color="#00c9ff" />
        <Text fz={15} fw={700} c="#1e293b">
          AI 创意智囊建议
        </Text>
      </Flex>

      {suggestions && suggestions.length > 0 ? (
        suggestions.map((suggestion) => (
          <Box
            key={suggestion.id}
            bg="#fffbeb"
            bd="1px solid #fef3c7"
            p="14px 16px"
            style={{ borderRadius: 8 }}
          >
            <Flex align="center" gap={6} c="#b45309" fz={13} fw={700} mb={8}>
              <FiAlertTriangle size={15} />
              <span>{suggestion.title}</span>
            </Flex>
            <Text fz={12} c="#92400e" lh={1.6}>
              {suggestion.content}
            </Text>
          </Box>
        ))
      ) : (
        <NoData
          title="暂无AI建议"
          description="写作过程中AI将自动检测冲突与提供灵感"
          height={120}
        />
      )}
    </Paper>
  );
}
