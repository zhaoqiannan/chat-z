"use client";

import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Paper,
  SimpleGrid,
  Badge,
} from "@mantine/core";
import { FiCheck, FiX, FiRefreshCw, FiCopy } from "react-icons/fi";

interface DiffViewerProps {
  originalText: string;
  optimizedText: string;
  onAccept: (newText: string) => void;
  onReject: () => void;
}

export default function DiffViewer({
  originalText,
  optimizedText,
  onAccept,
  onReject,
}: DiffViewerProps) {
  const [currentOptimized, setCurrentOptimized] = useState(optimizedText);

  const origWordCount = originalText.replace(/\s+/g, "").length;
  const optWordCount = currentOptimized.replace(/\s+/g, "").length;
  const diffCount = optWordCount - origWordCount;

  return (
    <Box p="16px" bg="#ffffff" style={{ borderRadius: 12, border: "1px solid #e2e8f0", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 顶部操作控制条 */}
      <Flex justify="space-between" align="center" mb={14} pb={12} style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Flex align="center" gap={10}>
          <Text fw={700} fz={16} c="#1e293b">
            AI 润色与修改对比视图
          </Text>
          <Badge
            color={diffCount >= 0 ? "teal" : "orange"}
            variant="light"
          >
            {diffCount >= 0 ? `+${diffCount} 字` : `${diffCount} 字`}
          </Badge>
        </Flex>

        <Flex gap={10}>
          <Button
            variant="default"
            size="sm"
            color="gray"
            leftSection={<FiX size={14} />}
            onClick={onReject}
          >
            放弃修改 (保留原文)
          </Button>

          <Button
            bg="#10b981"
            size="sm"
            leftSection={<FiCheck size={14} />}
            onClick={() => onAccept(currentOptimized)}
          >
            一键采纳 (替换原文)
          </Button>
        </Flex>
      </Flex>

      {/* 双栏对比区 */}
      <SimpleGrid cols={2} spacing="16px" style={{ flex: 1, minHeight: 0 }}>
        {/* 左栏：现有文章 (原文) */}
        <Flex direction="column" style={{ height: "100%", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", overflow: "hidden" }}>
          <Flex justify="space-between" align="center" p="10px 14px" bg="#f1f5f9" style={{ borderBottom: "1px solid #e2e8f0" }}>
            <Text fw={700} fz={13} c="#475569">
              📄 现有文章 (原文)
            </Text>
            <Text fz={12} c="#94a3b8">
              {origWordCount.toLocaleString()} 字
            </Text>
          </Flex>
          <Box p="14px" style={{ flex: 1, overflowY: "auto", fontSize: 14, lineHeight: 1.8, color: "#334155", whiteSpace: "pre-wrap" }}>
            {originalText || "（暂无正文）"}
          </Box>
        </Flex>

        {/* 右栏：AI 优化后文章 (支持二次微调) */}
        <Flex direction="column" style={{ height: "100%", border: "1px solid #bbf7d0", borderRadius: 8, background: "#f0fdf4", overflow: "hidden" }}>
          <Flex justify="space-between" align="center" p="10px 14px" bg="#dcfce7" style={{ borderBottom: "1px solid #bbf7d0" }}>
            <Text fw={700} fz={13} c="#15803d">
              ✨ AI 优化后文章 (可直接编辑微调)
            </Text>
            <Text fz={12} c="#16a34a" fw={600}>
              {optWordCount.toLocaleString()} 字
            </Text>
          </Flex>
          <textarea
            style={{
              flex: 1,
              width: "100%",
              border: "none",
              background: "transparent",
              padding: 14,
              fontSize: 14,
              lineHeight: 1.8,
              color: "#14532d",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
            }}
            value={currentOptimized}
            onChange={(e) => setCurrentOptimized(e.target.value)}
          />
        </Flex>
      </SimpleGrid>
    </Box>
  );
}
