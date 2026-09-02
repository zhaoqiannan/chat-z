// 组件：多类型智能名称生成器公共弹窗（支持角色/地点/阵营/物品、数字选择器长度控制、前缀固定与AI/离线双模生成）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Modal, TextInput, NumberInput, SimpleGrid, LoadingOverlay, Stack, Group } from "@mantine/core";
import { FiRefreshCw, FiCheck, FiZap } from "react-icons/fi";
import { post } from "@/utils/rest";

export type NameGenType = "character" | "location" | "faction" | "item";

interface NameGeneratorProps {
  opened: boolean;
  onClose: () => void;
  onSelectName: (name: string) => void;
  type?: NameGenType;
  title?: string;
}

const CHARACTER_SURNAMES = ["林", "萧", "叶", "陆", "沈", "顾", "苏", "楚", "谢", "秦", "姜", "白", "云", "陈", "李", "张", "赵", "王", "周", "柳", "韩", "南宫", "慕容", "诸葛", "欧阳", "司徒", "独孤", "东方", "上官", "百里"];
const CHARACTER_CHARS = ["尘", "凡", "渊", "炎", "玄", "夜", "风", "傲", "天", "逸", "宸", "霄", "凌", "墨", "羽", "川", "澜", "寒", "舟", "衡", "曜", "寻", "策", "锋", "绝", "恒", "昭", "湛", "烁", "越", "修", "澈", "歌", "影", "扬", "洛", "言", "青", "辞", "暮", "凛", "霆", "若", "曦", "雪", "凝", "清", "语", "月", "瑶", "芷", "璃", "岚", "晴", "微", "嫣", "宛", "音", "棠", "弦", "沁", "浅", "灵", "涵", "烟", "秋", "梦", "素", "锦", "璇", "曼", "悠", "初", "芙", "汐", "宜", "姝"];

const LOCATION_PREFIXES = ["天", "青", "洛", "云", "寒", "黑", "紫", "九", "神", "苍", "沧", "赤", "幽", "星", "荒", "玄", "万", "太", "灵", "玉", "碧", "重", "无", "昆", "蓬", "蜀", "瀚", "冥", "修", "幻"];
const LOCATION_MIDDLES = ["阳", "龙", "凰", "渊", "海", "剑", "霄", "霞", "极", "灵", "风", "虚", "木", "华", "霜", "炎", "冥", "雷", "圣", "武", "星", "尘", "幻", "天", "云", "石", "幽", "月", "皇", "帝"];
const LOCATION_SUFFIXES = ["城", "要塞", "界", "谷", "峰", "山", "岛", "殿", "域", "关", "渡", "港", "渊", "原", "海", "阁", "林", "潭", "堡", "废墟", "平原", "荒漠", "峡谷", "遗迹", "仙府", "圣境"];

const FACTION_PREFIXES = ["万", "天", "紫", "黑", "玄", "太", "九", "神", "青", "赤", "苍", "圣", "星", "幽", "金", "风", "雷", "乾", "坤", "真", "凌", "幻", "无", "极", "龙", "凤", "归", "合", "七", "百"];
const FACTION_MIDDLES = ["剑", "武", "道", "阳", "虚", "仙", "皇", "霄", "金", "灵", "华", "云", "魔", "冥", "霸", "玄", "炎", "木", "水", "火", "土", "风", "雷", "策", "影", "羽", "麟", "鼎", "极", "乾"];
const FACTION_SUFFIXES = ["宗", "门", "阁", "宫", "府", "盟", "帮", "教", "殿", "庄", "楼", "集团", "商会", "神殿", "圣地", "世家", "帝国", "工会", "皇朝", "派", "堂", "社", "军", "重工", "科技"];

const ITEM_PREFIXES = ["九", "太", "玄", "赤", "紫", "龙", "青", "天", "神", "幽", "星", "混", "无", "乾", "昆", "八", "万", "诛", "绝", "斩", "碎", "灭", "定", "破", "噬", "炼", "御", "灵", "金", "碧"];
const ITEM_MIDDLES = ["极", "元", "火", "霜", "霄", "光", "木", "虚", "冥", "阳", "荒", "皇", "圣", "影", "灵", "晶", "血", "雷", "风", "星", "神", "魂", "魔", "仙", "魄", "辰", "罡", "幻", "金", "玉"];
const ITEM_SUFFIXES = ["剑", "刀", "枪", "戟", "甲", "环", "镜", "塔", "鼎", "炉", "符", "丹", "琴", "印", "珠", "杖", "旗", "令", "核心", "晶体", "手套", "战靴", "战袍", "法杖", "重盾", "弓", "飞刃", "玉佩", "秘典"];

function generateLocalNames(type: NameGenType, prefix: string, targetLength: number, count = 10): string[] {
  const result: Set<string> = new Set();
  const len = Math.max(1, Math.min(12, targetLength || 3));
  let tries = 0;

  let prefixes = CHARACTER_SURNAMES;
  let middles = CHARACTER_CHARS;
  let suffixes = CHARACTER_CHARS;

  if (type === "location") {
    prefixes = LOCATION_PREFIXES;
    middles = LOCATION_MIDDLES;
    suffixes = LOCATION_SUFFIXES;
  } else if (type === "faction") {
    prefixes = FACTION_PREFIXES;
    middles = FACTION_MIDDLES;
    suffixes = FACTION_SUFFIXES;
  } else if (type === "item") {
    prefixes = ITEM_PREFIXES;
    middles = ITEM_MIDDLES;
    suffixes = ITEM_SUFFIXES;
  }

  while (result.size < count && tries < 300) {
    tries++;
    let current = prefix.trim();

    if (!current) {
      current = prefixes[Math.floor(Math.random() * prefixes.length)];
    }

    while (current.length < len) {
      const remaining = len - current.length;
      if (remaining >= 2 && Math.random() > 0.4) {
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
        if (suf.length <= remaining) {
          current += suf;
          continue;
        }
      }
      const mid = middles[Math.floor(Math.random() * middles.length)];
      current += mid;
    }

    if (current.length > len) {
      current = current.slice(0, len);
    }

    if (current.length === len) {
      result.add(current);
    }
  }

  return Array.from(result).slice(0, count);
}

export default function NameGeneratorModal({
  opened,
  onClose,
  onSelectName,
  type = "character",
  title,
}: NameGeneratorProps) {
  const [prefix, setPrefix] = useState("");
  const [nameLength, setNameLength] = useState<number>(3);
  const [meaning, setMeaning] = useState("");
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const getTypeName = () => {
    switch (type) {
      case "location":
        return "地点";
      case "faction":
        return "势力阵营";
      case "item":
        return "物品道具";
      default:
        return "角色姓名";
    }
  };

  const getModalTitle = () => {
    if (title) return title;
    return `智能${getTypeName()}起名`;
  };

  const getPrefixLabel = () => {
    switch (type) {
      case "location":
        return "指定前缀字 (选填)";
      case "faction":
        return "指定前缀字 (选填)";
      case "item":
        return "指定前缀字 (选填)";
      default:
        return "指定首字/姓氏 (选填)";
    }
  };

  const getMeaningPlaceholder = () => {
    switch (type) {
      case "location":
        return "例如：仙宗主城 / 极寒要塞 / 荒古深渊 / 繁华渡口";
      case "faction":
        return "例如：正道魁首 / 暗杀门派 / 科技财阀 / 传承万载剑宗";
      case "item":
        return "例如：上古神兵 / 疗伤圣丹 / 机甲核心 / 帝王信物";
      default:
        return "例如：孤傲剑客 / 医毒双绝 / 仙风道骨 / 温婉隐忍";
    }
  };

  const handleGenerate = async () => {
    const len = Number(nameLength) || 3;
    if (!meaning.trim()) {
      const names = generateLocalNames(type, prefix, len, 10);
      setGeneratedList(names);
      return;
    }

    try {
      setLoading(true);
      const res = await post("/api/ai/chapter/chat", {
        prompt: `请为小说中的【${getTypeName()}】生成 10 个契合以下要求的名字：
- 指定前缀字：${prefix || "无限制"}
- 严格限制字数：${len} 个汉字
- 风格/寓意/设定定位：${meaning.trim()}
请直接返回以逗号分隔的 10 个中文名字，每个名字字数必须严格为 ${len} 个字，严禁附带序号、解释或任何多余文字。例如：名字1, 名字2, 名字3`,
        systemPrompt: "你是一个专业的网文小说起名助手，严格按指定字数生成以逗号分隔的名字清单。",
      });

      if (res && res.success && res.result) {
        const text = typeof res.result === "string" ? res.result : (res.result.content || res.result.text || "");
        const rawNames = text
          .split(/[,，\n、\s]+/)
          .map((s: string) => s.replace(/[\d.、()（）"']/g, "").trim())
          .filter((s: string) => s.length === len);

        if (rawNames.length > 0) {
          setGeneratedList(Array.from(new Set<string>(rawNames)).slice(0, 10));
          return;
        }
      }
      setGeneratedList(generateLocalNames(type, prefix, len, 10));
    } catch (_) {
      setGeneratedList(generateLocalNames(type, prefix, len, 10));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      handleGenerate();
    }
  }, [opened, type]);

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
          <Text fw={700} fz={15} c="#0f172a">{getModalTitle()}</Text>
        </Group>
      }
      centered
      size="md"
      radius="sm"
      styles={{
        content: { maxHeight: "88vh", display: "flex", flexDirection: "column" },
        header: { borderBottom: "1px solid #f1f5f9", padding: "12px 20px", flexShrink: 0 },
        body: { flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 20px 12px 20px" },
      }}
    >
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <TextInput
            label={getPrefixLabel()}
            placeholder="例如：林 / 万 / 青"
            size="xs"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />

          <NumberInput
            label="名字长度"
            placeholder="默认3字"
            size="xs"
            value={nameLength}
            onChange={(val) => setNameLength(typeof val === "number" ? val : 3)}
            min={1}
            max={12}
            step={1}
            allowDecimal={false}
          />
        </SimpleGrid>

        <TextInput
          label="关联寓意 / 气质风格 (选填)"
          placeholder={getMeaningPlaceholder()}
          size="xs"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
        />

        <Flex justify="space-between" align="center" pt={4}>
          <Text fz={11.5} c="#64748b">
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
                rightSection={copiedName === name ? <FiCheck size={12} /> : null}
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
