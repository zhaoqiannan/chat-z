// 组件：角色姓名智能生成器公共弹窗（指定前缀字、限定长度、关联寓意与秒级10连生成）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Modal, TextInput, SimpleGrid, Badge, ActionIcon, Stack, Group, SegmentedControl, LoadingOverlay } from "@mantine/core";
import { FiRefreshCw, FiCheck, FiUserCheck, FiZap } from "react-icons/fi";
import { post } from "@/utils/rest";

interface NameGeneratorProps {
  opened: boolean;
  onClose: () => void;
  onSelectName: (name: string) => void;
}

const COMMON_SURNAMES = ["林", "萧", "叶", "陆", "沈", "顾", "苏", "楚", "谢", "秦", "姜", "白", "云", "陈", "李", "张", "赵", "王", "周", "柳", "韩", "南宫", "慕容", "诸葛", "欧阳", "司徒", "独孤", "东方", "上官", "百里"];
const NOVEL_CHARS_HERO = ["尘", "凡", "渊", "炎", "玄", "夜", "风", "傲", "天", "逸", "宸", "霄", "凌", "墨", "羽", "川", "澜", "寒", "舟", "衡", "曜", "寻", "策", "锋", "绝", "绝", "恒", "昭", "湛", "烁", "越", "修", "澈", "歌", "影", "绝", "扬", "洛", "言", "青", "辞", "暮", "凛", "霆"];
const NOVEL_CHARS_ELEGANT = ["若", "曦", "雪", "凝", "清", "语", "月", "瑶", "芷", "璃", "岚", "晴", "微", "嫣", "宛", "音", "棠", "弦", "沁", "浅", "灵", "涵", "烟", "秋", "梦", "素", "锦", "璇", "曼", "悠", "影", "初", "芙", "汐", "宜", "姝"];

function generateLocalNames(prefix: string, length: number, count = 10): string[] {
  const result: Set<string> = new Set();
  const pool = [...NOVEL_CHARS_HERO, ...NOVEL_CHARS_ELEGANT];
  let tries = 0;

  while (result.size < count && tries < 200) {
    tries++;
    let surname = "";
    if (prefix.trim()) {
      surname = prefix.trim();
    } else {
      surname = COMMON_SURNAMES[Math.floor(Math.random() * COMMON_SURNAMES.length)];
    }

    const remainingLen = Math.max(1, length - surname.length);
    let givenName = "";
    for (let i = 0; i < remainingLen; i++) {
      const char = pool[Math.floor(Math.random() * pool.length)];
      givenName += char;
    }
    const fullName = surname + givenName;
    if (fullName.length <= length + 1) {
      result.add(fullName);
    }
  }

  return Array.from(result).slice(0, count);
}

export default function NameGeneratorModal({
  opened,
  onClose,
  onSelectName,
}: NameGeneratorProps) {
  const [prefix, setPrefix] = useState("");
  const [nameLength, setNameLength] = useState("3");
  const [meaning, setMeaning] = useState("");
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const handleGenerate = async () => {
    const len = Number(nameLength) || 3;
    if (!meaning.trim()) {
      const names = generateLocalNames(prefix, len, 10);
      setGeneratedList(names);
      return;
    }

    try {
      setLoading(true);
      const res = await post("/api/ai/chapter/chat", {
        prompt: `请为小说角色生成 10 个契合以下要求的名字：
- 指定前缀/姓氏：${prefix || "无限制"}
- 总字数：${len} 字
- 关联寓意/角色气质：${meaning.trim()}
请直接返回逗号分隔的 10 个中文名字，不要带任何序号或解释说明。例如：林云起, 萧千绝, 叶临渊`,
        systemPrompt: "你是一个网文小说起名助手，仅输出以逗号分隔的名字列表。",
      });

      if (res && res.success && res.result) {
        const text = typeof res.result === "string" ? res.result : (res.result.content || res.result.text || "");
        const rawNames = text.split(/[,，\n、\s]+/).map((s: string) => s.trim()).filter((s: string) => s.length >= 2 && s.length <= 5);
        if (rawNames.length > 0) {
          setGeneratedList(rawNames.slice(0, 10));
          return;
        }
      }
      setGeneratedList(generateLocalNames(prefix, len, 10));
    } catch (_) {
      setGeneratedList(generateLocalNames(prefix, len, 10));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      handleGenerate();
    }
  }, [opened]);

  const handlePick = (name: string) => {
    setCopiedName(name);
    onSelectName(name);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={6} align="center">
          <FiZap size={15} color="#0284c7" />
          <Text fw={700} fz={15} c="#0f172a">小说角色姓名生成器</Text>
        </Group>
      }
      centered
      size="md"
      radius="sm"
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", paddingBottom: 10 },
        body: { paddingTop: 14 },
      }}
    >
      <Stack gap="sm">
        <Group grow gap="xs">
          <TextInput
            label="指定首字 / 前两字"
            placeholder="例如：林 / 慕容"
            size="xs"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />

          <Box>
            <Text fz={12} fw={500} c="#475569" mb={4}>总名字长度</Text>
            <SegmentedControl
              size="xs"
              value={nameLength}
              onChange={setNameLength}
              data={[
                { label: "2字", value: "2" },
                { label: "3字", value: "3" },
                { label: "4字", value: "4" },
              ]}
              fullWidth
            />
          </Box>
        </Group>

        <TextInput
          label="关联寓意 / 气质偏好 (选填，不填秒级生成)"
          placeholder="例如：孤傲剑客 / 医毒双绝 / 仙风道骨 / 温婉隐忍"
          size="xs"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
        />

        <Flex justify="space-between" align="center" pt={4}>
          <Text fz={12} c="#64748b">
            点击名字即可一键采纳填入
          </Text>
          <Button
            size="xs"
            color="cyan"
            variant="light"
            leftSection={<FiRefreshCw size={12} />}
            loading={loading}
            onClick={handleGenerate}
          >
            换一批 (10个)
          </Button>
        </Flex>

        <Box pos="relative" p="10px" bg="#fafbfc" style={{ border: "1px solid #f1f5f9", borderRadius: 6, minHeight: 120 }}>
          <LoadingOverlay visible={loading} />
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {generatedList.map((name, idx) => (
              <Button
                key={idx}
                variant={copiedName === name ? "filled" : "outline"}
                color={copiedName === name ? "teal" : "gray"}
                size="sm"
                justify="space-between"
                rightSection={copiedName === name ? <FiCheck size={12} /> : <FiUserCheck size={12} />}
                onClick={() => handlePick(name)}
                styles={{
                  root: {
                    borderColor: copiedName === name ? "#0d9488" : "#e2e8f0",
                    backgroundColor: copiedName === name ? "#0d9488" : "#ffffff",
                    color: copiedName === name ? "#ffffff" : "#1e293b",
                    fontWeight: 600,
                  },
                }}
              >
                {name}
              </Button>
            ))}
          </SimpleGrid>
        </Box>
      </Stack>
    </Modal>
  );
}
