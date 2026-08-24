"use client";

import React, { useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Button,
  Stack,
  Flex,
  Text,
  SimpleGrid,
} from "@mantine/core";
import { FiZap } from "react-icons/fi";
import { requestChapterAiDraft } from "@/rest/chapter";

interface ModalAiDraftProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  chapterId?: string;
  chapterTitle?: string;
  defaultSummary?: string;
  onGenerated: (draftText: string) => void;
}

export default function ModalAiDraft({
  opened,
  onClose,
  workId,
  chapterId,
  chapterTitle,
  defaultSummary,
  onGenerated,
}: ModalAiDraftProps) {
  const [overview, setOverview] = useState("");
  const [events, setEvents] = useState("");
  const [plotDirection, setPlotDirection] = useState("");
  const [characters, setCharacters] = useState("");
  const [writingStyle, setWritingStyle] = useState("网文快节奏·爽快打脸");
  const [targetWords, setTargetWords] = useState<number | string>(3000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (opened) {
      setOverview(defaultSummary || "");
      setEvents("");
      setPlotDirection("");
      setCharacters("");
      setWritingStyle("网文快节奏·爽快打脸");
      setTargetWords(3000);
      setError("");
    }
  }, [opened, defaultSummary]);

  const handleGenerate = async () => {
    if (!overview.trim()) {
      setError("章节大致内容不能为空");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await requestChapterAiDraft({
        workId,
        chapterId,
        mode: "draft",
        overview: overview.trim(),
        events: events.trim(),
        plotDirection: plotDirection.trim(),
        characters: characters.trim(),
        writingStyle,
        targetWords,
      });

      if (res && res.success && res.result?.draftText) {
        onGenerated(res.result.draftText);
        onClose();
      } else {
        setError(res?.message || "生成初稿失败");
      }
    } catch (err: any) {
      setError(err?.message || "生成初稿请求异常");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex align="center" gap={8}>
          <FiZap color="#8b5cf6" size={18} />
          <Text fw={700} fz={16} c="#1e293b">
            AI 智能生成正文初稿 {chapterTitle ? `(${chapterTitle})` : ""}
          </Text>
        </Flex>
      }
      centered
      size="lg"
      radius="md"
    >
      <Stack gap="14px">
        <Textarea
          label="📖 章节大致内容 (*必填)"
          placeholder="简述本章的核心剧情框架，例如：主角来到家族大殿，遭遇反派退婚与羞辱..."
          value={overview}
          onChange={(e) => setOverview(e.currentTarget.value)}
          minRows={3}
          required
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="12px">
          <Textarea
            label="⚡ 事件安排 / 关键节拍 (选填)"
            placeholder="如：1.嘲讽主角 2.主角隐忍 3.揭穿底牌 4.震惊全场"
            value={events}
            onChange={(e) => setEvents(e.currentTarget.value)}
            minRows={2}
          />

          <Textarea
            label="🎯 剧情走向 / 核心反转 (选填)"
            placeholder="如：主角没有发怒，反而当众立下三年誓约，反将一军..."
            value={plotDirection}
            onChange={(e) => setPlotDirection(e.currentTarget.value)}
            minRows={2}
          />
        </SimpleGrid>

        <TextInput
          label="👥 登场人物与性格设定 (选填)"
          placeholder="如：主角(沉着隐忍)、反派圣女(傲慢跋扈)、长老(见风使舵)"
          value={characters}
          onChange={(e) => setCharacters(e.currentTarget.value)}
        />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="12px">
          <Select
            label="🎨 文风选择"
            value={writingStyle}
            onChange={(val) => setWritingStyle(val || "网文快节奏·爽快打脸")}
            data={[
              { value: "网文快节奏·爽快打脸", label: "网文快节奏·爽快打脸" },
              { value: "古典仙侠·意境飘逸", label: "古典仙侠·意境飘逸" },
              { value: "硬核科幻·冷峻精密", label: "硬核科幻·冷峻精密" },
              { value: "悬疑诡谲·压抑反转", label: "悬疑诡谲·压抑反转" },
              { value: "幽默轻小说·生动逗趣", label: "幽默轻小说·生动逗趣" },
              { value: "都市情感·细腻写实", label: "都市情感·细腻写实" },
            ]}
          />

          <NumberInput
            label="🎯 目标字数"
            placeholder="如：3000"
            value={targetWords}
            onChange={(val) => setTargetWords(val)}
            min={500}
            step={500}
            suffix=" 字"
          />
        </SimpleGrid>

        {error && <Text c="red" fz="xs">{error}</Text>}

        <Flex justify="flex-end" gap="10px" mt="10px">
          <Button variant="default" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            color="violet"
            leftSection={<FiZap size={14} />}
            loading={loading}
            onClick={handleGenerate}
          >
            开始生成初稿
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}
