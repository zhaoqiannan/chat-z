// 组件：AI 改写结果轻量级红绿 Diff 预览（展示字数变化与逐句差异，支持一键切换纯净预览）
"use client";

import React, { useMemo, useState } from "react";
import { Box, Flex, Text, SegmentedControl, Badge } from "@mantine/core";
import { countWords } from "@/utils/text";

interface InlineDiffViewProps {
  original: string;
  revised: string;
}

interface DiffToken {
  type: "same" | "add" | "del";
  text: string;
}

// 按中文短句/标点/换行切分，避免长文本 LCS 复杂度过高
function tokenize(text: string): string[] {
  return text.match(/[^\n，。！？；：、,.!?;:\s]+|[\n，。！？；：、,.!?;:\s]+/g) || [];
}

function computeSimpleDiff(original: string, revised: string): DiffToken[] {
  const a = tokenize(original);
  const b = tokenize(revised);

  // 超长片段回退到按行/段比对，防止 O(N*M) 卡顿
  if (a.length * b.length > 60000) {
    return [
      { type: "del", text: original },
      { type: "add", text: revised },
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      tokens.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ type: "del", text: a[i] });
      i++;
    } else {
      tokens.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) tokens.push({ type: "del", text: a[i++] });
  while (j < n) tokens.push({ type: "add", text: b[j++] });

  // 合并相邻同类 token
  const merged: DiffToken[] = [];
  for (const tok of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.type === tok.type) {
      last.text += tok.text;
    } else {
      merged.push({ ...tok });
    }
  }
  return merged;
}

export default function InlineDiffView({ original, revised }: InlineDiffViewProps) {
  const [viewMode, setViewMode] = useState<"diff" | "clean">("diff");

  const origWords = useMemo(() => countWords(original), [original]);
  const revWords = useMemo(() => countWords(revised), [revised]);
  const delta = revWords - origWords;

  const diffTokens = useMemo(
    () => (viewMode === "diff" ? computeSimpleDiff(original, revised) : []),
    [original, revised, viewMode]
  );

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6} gap={6} wrap="wrap">
        <Badge size="xs" variant="light" color={delta >= 0 ? "teal" : "orange"}>
          原文 {origWords} 字 → {revWords} 字（{delta >= 0 ? `+${delta}` : delta}）
        </Badge>
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as "diff" | "clean")}
          data={[
            { label: "红绿对比", value: "diff" },
            { label: "纯净预览", value: "clean" },
          ]}
          styles={{ root: { backgroundColor: "#e2f7ec" }, label: { fontSize: 10.5, padding: "2px 6px" } }}
        />
      </Flex>

      {viewMode === "clean" ? (
        <Text fz={12.5} c="#14532d" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
          {revised}
        </Text>
      ) : (
        <Box fz={12.5} lh={1.7} c="#1e293b" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {diffTokens.map((tok, idx) => {
            if (tok.type === "del") {
              return (
                <span
                  key={idx}
                  style={{
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    textDecoration: "line-through",
                    padding: "0 1px",
                    borderRadius: 2,
                  }}
                >
                  {tok.text}
                </span>
              );
            }
            if (tok.type === "add") {
              return (
                <span
                  key={idx}
                  style={{
                    backgroundColor: "#dcfce7",
                    color: "#15803d",
                    fontWeight: 500,
                    padding: "0 1px",
                    borderRadius: 2,
                  }}
                >
                  {tok.text}
                </span>
              );
            }
            return <span key={idx}>{tok.text}</span>;
          })}
        </Box>
      )}
    </Box>
  );
}
