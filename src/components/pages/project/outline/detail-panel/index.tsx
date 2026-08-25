"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  TextInput,
  Textarea,
  Select,
  Button,
  SimpleGrid,
  Paper,
} from "@mantine/core";
import {
  FiSave,
  FiZap,
  FiTarget,
  FiAlertTriangle,
  FiUsers,
  FiMapPin,
  FiCheckCircle,
} from "react-icons/fi";
import { OutlineNode, OutlineNodeType, UpdateOutlinePayload } from "@/rest/outline";
import ChapterPicker from "../chapter-picker";
import styles from "../style.module.scss";

interface DetailPanelProps {
  node: OutlineNode | null;
  onUpdate: (data: UpdateOutlinePayload) => Promise<void>;
  onOpenAiPlan: () => void;
}

export default function DetailPanel({
  node,
  onUpdate,
  onOpenAiPlan,
}: DetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<OutlineNodeType>("scene");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [conflict, setConflict] = useState("");
  const [characters, setCharacters] = useState("");
  const [locations, setLocations] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [linkedChapters, setLinkedChapters] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (node) {
      setType(node.type);
      setTitle(node.title || "");
      setGoal(node.goal || "");
      setConflict(node.conflict || "");
      setCharacters(node.characters || "");
      setLocations(node.locations || "");
      setExpectedOutcome(node.expectedOutcome || "");
      setLinkedChapters(node.linkedChapters || "");
      setSavedSuccess(false);
      setError("");
    }
  }, [node]);

  if (!node) {
    return (
      <Box className={styles.detailPanel}>
        <Flex
          direction="column"
          align="center"
          justify="center"
          h="100%"
          gap={12}
          c="#94a3b8"
        >
          <FiTarget size={48} strokeWidth={1.2} />
          <Text fz={15} fw={600}>
            请在左侧大纲树中选择或新建一个节点
          </Text>
          <Text fz={13}>
            支持层级化规划【篇章 / 幕 / 情景点 / 事件】，设定节点目标与核心冲突
          </Text>
        </Flex>
      </Box>
    );
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError("节点标题不能为空");
      return;
    }
    if (!goal.trim()) {
      setError("节点目标为必填项");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onUpdate({
        id: node.id,
        type,
        title: title.trim(),
        goal: goal.trim(),
        conflict: conflict.trim(),
        characters: characters.trim(),
        locations: locations.trim(),
        expectedOutcome: expectedOutcome.trim(),
        linkedChapters: linkedChapters.trim(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      setError(err?.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className={styles.detailPanel}>
      <Flex justify="space-between" align="center" mb={20}>
        <Box>
          <Flex align="center" gap={10}>
            <Text fz={20} fw={700} c="#1e293b">
              {title || "编辑节点"}
            </Text>
            <span className={`${styles.nodeBadge} ${styles[type]}`}>
              {type.toUpperCase()}
            </span>
          </Flex>
          <Text fz={12} c="#94a3b8" mt={4}>
            最后修改时间：{node.updatedAt ? new Date(node.updatedAt).toLocaleString() : "刚刚"}
          </Text>
        </Box>

        <Flex gap={10} align="center">
          {savedSuccess && (
            <Flex align="center" gap={4} fz={13} c="#10b981" fw={600}>
              <FiCheckCircle size={15} />
              已保存
            </Flex>
          )}

          <Button
            variant="light"
            color="violet"
            leftSection={<FiZap size={14} />}
            onClick={onOpenAiPlan}
          >
            AI 推演剧情
          </Button>

          <Button
            leftSection={<FiSave size={14} />}
            loading={loading}
            onClick={handleSave}
          >
            保存修改
          </Button>
        </Flex>
      </Flex>

      {error && (
        <Paper p="10px 16px" bg="#fee2e2" c="#b91c1c" fz={13} mb={16} radius="md">
          {error}
        </Paper>
      )}

      {/* 核心设定卡片 */}
      <Box className={styles.card}>
        <Text fz={15} fw={700} c="#1e293b" mb={16}>
          📌 基础信息与核心目标
        </Text>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="16px" mb="16px">
          <Select
            label="节点类型"
            value={type}
            onChange={(val) => setType((val as OutlineNodeType) || "scene")}
            data={[
              { value: "volume", label: "卷 / 篇章 (Volume - 大结构)" },
              { value: "act", label: "幕 / 阶段 (Act - 阶段推进)" },
              { value: "scene", label: "情景点 (Scene - 具体场景)" },
              { value: "event", label: "关键事件 (Event - 核心节拍)" },
            ]}
          />

          <TextInput
            label="节点标题"
            placeholder="请输入节点名称"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
        </SimpleGrid>

        <Textarea
          label={
            <div className={styles.formLabel}>
              <FiTarget color="#00c9ff" />
              <span>节点目标</span>
              <span className={styles.required}>* (必填)</span>
            </div>
          }
          placeholder="该节点要达成的核心叙事目标是什么？（例如：引出反派势力背景、获得新金手指、埋下伏笔...）"
          value={goal}
          onChange={(e) => setGoal(e.currentTarget.value)}
          minRows={3}
          required
          mb="16px"
        />

        <Textarea
          label={
            <div className={styles.formLabel}>
              <FiAlertTriangle color="#f59e0b" />
              <span>冲突点 / 阻碍与危机</span>
              <span style={{ color: "#94a3b8", fontWeight: 400 }}>(选填)</span>
            </div>
          }
          placeholder="该节点中主角遭遇了什么阻碍？敌对势力的压迫、内心的矛盾或意外变故..."
          value={conflict}
          onChange={(e) => setConflict(e.currentTarget.value)}
          minRows={3}
        />
      </Box>

      {/* 剧情要素卡片 */}
      <Box className={styles.card}>
        <Text fz={15} fw={700} c="#1e293b" mb={16}>
          🎭 剧情要素与章节映射
        </Text>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="16px" mb="16px">
          <TextInput
            label={
              <div className={styles.formLabel}>
                <FiUsers color="#6366f1" />
                <span>涉及角色</span>
              </div>
            }
            placeholder="参与此节点的人物（如：萧炎, 药老, 纳兰嫣然）"
            value={characters}
            onChange={(e) => setCharacters(e.currentTarget.value)}
          />

          <TextInput
            label={
              <div className={styles.formLabel}>
                <FiMapPin color="#10b981" />
                <span>涉及地点 / 场景</span>
              </div>
            }
            placeholder="情节发生的空间（如：乌坦城萧家议事厅）"
            value={locations}
            onChange={(e) => setLocations(e.currentTarget.value)}
          />
        </SimpleGrid>

        <TextInput
          label={
            <div className={styles.formLabel}>
              <FiCheckCircle color="#8b5cf6" />
              <span>预期结果 / 伏笔反转</span>
            </div>
          }
          placeholder="节点结束时的后果或留下的悬念（如：立下三年之约）"
          value={expectedOutcome}
          onChange={(e) => setExpectedOutcome(e.currentTarget.value)}
          mb="16px"
        />

        <ChapterPicker
          value={linkedChapters}
          onChange={(val) => setLinkedChapters(val)}
        />
      </Box>
    </Box>
  );
}
