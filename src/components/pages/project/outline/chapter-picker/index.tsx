"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  SegmentedControl,
  NumberInput,
  ActionIcon,
  Button,
  Text,
  Badge,
} from "@mantine/core";
import { FiPlus, FiTrash2, FiBookOpen } from "react-icons/fi";

interface ChapterPickerProps {
  value?: number[];
  onChange: (val: number[]) => void;
}

export default function ChapterPicker({ value = [], onChange }: ChapterPickerProps) {
  // mode: 'range' (范围选择) | 'single' (单章/离散多章选择)
  const [mode, setMode] = useState<"range" | "single">("range");
  const [rangeStart, setRangeStart] = useState<number | string>(1);
  const [rangeEnd, setRangeEnd] = useState<number | string>(3);
  const [singleList, setSingleList] = useState<(number | string)[]>([1]);

  // 从传入的 value (number[]) 初始化模式与数据
  useEffect(() => {
    if (!Array.isArray(value) || value.length === 0) return;

    const sorted = [...value].sort((a, b) => Number(a) - Number(b));
    const isConsecutive =
      sorted.length > 1 &&
      sorted.every((val, i) => i === 0 || Number(val) === Number(sorted[i - 1]) + 1);

    if (isConsecutive) {
      setMode("range");
      setRangeStart(sorted[0]);
      setRangeEnd(sorted[sorted.length - 1]);
    } else {
      setMode("single");
      setSingleList(sorted);
    }
  }, [value]);

  // 触发 onChange 输出 number[]
  const emitChange = (newMode: "range" | "single", start: any, end: any, singles: any[]) => {
    if (newMode === "range") {
      const s = Math.max(1, parseInt(String(start || 1), 10));
      const e = Math.max(s, parseInt(String(end || s), 10));
      const result: number[] = [];
      for (let i = s; i <= e; i++) {
        result.push(i);
      }
      onChange(result);
    } else {
      const parsed = singles
        .map((n) => parseInt(String(n), 10))
        .filter((n) => !isNaN(n) && n > 0);
      const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
      onChange(uniqueSorted);
    }
  };

  const handleModeChange = (newMode: string) => {
    const m = newMode as "range" | "single";
    setMode(m);
    emitChange(m, rangeStart, rangeEnd, singleList);
  };

  const handleRangeStartChange = (val: string | number) => {
    setRangeStart(val);
    emitChange(mode, val, rangeEnd, singleList);
  };

  const handleRangeEndChange = (val: string | number) => {
    setRangeEnd(val);
    emitChange(mode, rangeStart, val, singleList);
  };

  const handleSingleItemChange = (index: number, val: string | number) => {
    const updated = [...singleList];
    updated[index] = val;
    setSingleList(updated);
    emitChange(mode, rangeStart, rangeEnd, updated);
  };

  const handleAddSingle = () => {
    const last = singleList.length > 0 ? Number(singleList[singleList.length - 1]) || 1 : 1;
    const nextVal = last + 1;
    const updated = [...singleList, nextVal];
    setSingleList(updated);
    emitChange(mode, rangeStart, rangeEnd, updated);
  };

  const handleRemoveSingle = (index: number) => {
    if (singleList.length <= 1) return;
    const updated = singleList.filter((_, i) => i !== index);
    setSingleList(updated);
    emitChange(mode, rangeStart, rangeEnd, updated);
  };

  const formatSummary = () => {
    if (!Array.isArray(value) || value.length === 0) return "未关联任何章节";
    if (value.length === 1) return `第 ${value[0]} 章`;
    const sorted = [...value].sort((a, b) => a - b);
    const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
    if (isConsecutive) {
      return `第 ${sorted[0]} ~ ${sorted[sorted.length - 1]} 章 (共 ${sorted.length} 章)`;
    }
    return `第 ${sorted.join(", ")} 章 (共 ${sorted.length} 章)`;
  };

  return (
    <Box p="12px" bg="#f8fafc" bd="1px solid #e2e8f0" style={{ borderRadius: 8 }}>
      <Flex justify="space-between" align="center" mb={10} wrap="wrap" gap={8}>
        <Flex align="center" gap={6}>
          <FiBookOpen size={14} color="#00c9ff" />
          <Text fz={13} fw={600} c="#1e293b">
            关联正文章节
          </Text>
          <Badge size="sm" color="cyan" variant="light">
            {formatSummary()}
          </Badge>
        </Flex>

        <SegmentedControl
          size="xs"
          value={mode}
          onChange={handleModeChange}
          data={[
            { label: "连续章节范围", value: "range" },
            { label: "单章/离散多章", value: "single" },
          ]}
        />
      </Flex>

      {/* 模式一：范围选择 */}
      {mode === "range" && (
        <Flex align="center" gap={8}>
          <Text fz={12} c="#64748b">从</Text>
          <NumberInput
            size="xs"
            min={1}
            value={rangeStart}
            onChange={handleRangeStartChange}
            style={{ width: 90 }}
            prefix="第 "
            suffix=" 章"
          />
          <Text fz={12} c="#64748b">到</Text>
          <NumberInput
            size="xs"
            min={Number(rangeStart) || 1}
            value={rangeEnd}
            onChange={handleRangeEndChange}
            style={{ width: 90 }}
            prefix="第 "
            suffix=" 章"
          />
          <Text fz={12} c="#94a3b8">
            （包含区间内所有正文章节）
          </Text>
        </Flex>
      )}

      {/* 模式二：单章/离散多章选择 */}
      {mode === "single" && (
        <Box>
          <Flex wrap="wrap" gap={8} align="center">
            {singleList.map((item, index) => (
              <Flex key={index} align="center" gap={4}>
                <NumberInput
                  size="xs"
                  min={1}
                  value={item}
                  onChange={(val) => handleSingleItemChange(index, val)}
                  style={{ width: 85 }}
                  prefix="第 "
                  suffix=" 章"
                />
                {singleList.length > 1 && (
                  <ActionIcon
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveSingle(index)}
                  >
                    <FiTrash2 size={13} />
                  </ActionIcon>
                )}
              </Flex>
            ))}

            <Button
              size="xs"
              variant="light"
              color="pink"
              leftSection={<FiPlus size={12} />}
              onClick={handleAddSingle}
            >
              加一章
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
}
