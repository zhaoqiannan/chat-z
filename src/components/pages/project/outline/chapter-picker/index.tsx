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
} from "@mantine/core";
import { FiPlus, FiTrash2, FiBookOpen } from "react-icons/fi";

interface ChapterPickerProps {
  value: string;
  onChange: (formattedValue: string) => void;
}

export default function ChapterPicker({ value, onChange }: ChapterPickerProps) {
  // mode: 'range' (范围选择) | 'single' (单章/离散多章选择)
  const [mode, setMode] = useState<"range" | "single">("range");
  const [rangeStart, setRangeStart] = useState<number | string>(1);
  const [rangeEnd, setRangeEnd] = useState<number | string>(3);
  const [singleList, setSingleList] = useState<(number | string)[]>([1]);

  // 从已有字符串反向解析初始值
  useEffect(() => {
    if (!value) return;

    // 匹配类似 "第 1 ~ 5 章" 或 "1-5"
    const rangeMatch = value.match(/(\d+)\s*[-~至到]\s*(\d+)/);
    if (rangeMatch) {
      setMode("range");
      setRangeStart(parseInt(rangeMatch[1], 10));
      setRangeEnd(parseInt(rangeMatch[2], 10));
      return;
    }

    // 匹配离散章节 "第 1, 3, 5 章"
    const numbers = value.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      const parsed = numbers.map((n) => parseInt(n, 10));
      if (parsed.length === 1) {
        setMode("single");
        setSingleList([parsed[0]]);
      } else {
        setMode("single");
        setSingleList(parsed);
      }
    }
  }, []);

  // 更新格式化结果
  const triggerChange = (newMode: "range" | "single", start: any, end: any, singles: any[]) => {
    if (newMode === "range") {
      const s = start || 1;
      const e = end || s;
      onChange(`第 ${s} ~ ${e} 章`);
    } else {
      const valid = singles.filter((n) => n !== "" && n !== undefined && !isNaN(Number(n)));
      if (valid.length === 0) {
        onChange("");
      } else if (valid.length === 1) {
        onChange(`第 ${valid[0]} 章`);
      } else {
        onChange(`第 ${valid.join(", ")} 章`);
      }
    }
  };

  const handleModeChange = (newMode: "range" | "single") => {
    setMode(newMode);
    triggerChange(newMode, rangeStart, rangeEnd, singleList);
  };

  const handleRangeStartChange = (val: string | number) => {
    setRangeStart(val);
    triggerChange(mode, val, rangeEnd, singleList);
  };

  const handleRangeEndChange = (val: string | number) => {
    setRangeEnd(val);
    triggerChange(mode, rangeStart, val, singleList);
  };

  const handleSingleChange = (index: number, val: string | number) => {
    const updated = [...singleList];
    updated[index] = val;
    setSingleList(updated);
    triggerChange(mode, rangeStart, rangeEnd, updated);
  };

  const handleAddSingle = () => {
    const last = singleList.length > 0 ? Number(singleList[singleList.length - 1]) || 0 : 0;
    const updated = [...singleList, last + 1];
    setSingleList(updated);
    triggerChange(mode, rangeStart, rangeEnd, updated);
  };

  const handleRemoveSingle = (index: number) => {
    const updated = singleList.filter((_, i) => i !== index);
    setSingleList(updated);
    triggerChange(mode, rangeStart, rangeEnd, updated);
  };

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Flex align="center" gap={4} fz={13} fw={600} c="#475569">
          <FiBookOpen color="#ec4899" size={14} />
          <span>关联章节</span>
        </Flex>
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(val) => handleModeChange(val as "range" | "single")}
          data={[
            { label: "连续范围 (Range)", value: "range" },
            { label: "单章 / 多单章 (Single)", value: "single" },
          ]}
        />
      </Flex>

      {mode === "range" ? (
        <Flex align="center" gap={8}>
          <NumberInput
            placeholder="起始章"
            min={1}
            value={rangeStart}
            onChange={handleRangeStartChange}
            prefix="第 "
            suffix=" 章"
            style={{ flex: 1 }}
          />
          <Text fz={13} c="#94a3b8" fw={700}>
            至
          </Text>
          <NumberInput
            placeholder="结束章"
            min={1}
            value={rangeEnd}
            onChange={handleRangeEndChange}
            prefix="第 "
            suffix=" 章"
            style={{ flex: 1 }}
          />
        </Flex>
      ) : (
        <Box>
          <Flex wrap="wrap" gap={8} align="center">
            {singleList.map((item, idx) => (
              <Flex key={idx} align="center" gap={4}>
                <NumberInput
                  placeholder="章号"
                  min={1}
                  value={item}
                  onChange={(val) => handleSingleChange(idx, val)}
                  prefix="第 "
                  suffix=" 章"
                  style={{ width: 110 }}
                />
                {singleList.length > 1 && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemoveSingle(idx)}
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
