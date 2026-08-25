"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, Paper, SimpleGrid, Menu, ActionIcon, } from "@mantine/core";
import { FiSave, FiZap, FiCheckCircle, FiScissors, FiMoreVertical, FiPlus, FiCornerDownRight, FiTrash2, FiEdit2, FiFileText, FiCompass, } from "react-icons/fi";
import { OutlineNode, UpdateOutlinePayload } from "@/rest/outline";
import { WorkItem } from "@/rest/work";
import NodeForm, { NodeFormValues } from "../node-form";

interface DetailPanelProps {
  node: OutlineNode | null;
  work: WorkItem | null;
  isOverview: boolean;
  parentOptions: { value: string; label: string }[];
  onSave: (data: UpdateOutlinePayload) => Promise<void>;
  onTriggerNodeAi: (action: "expand_node" | "split_node") => void;
  onOpenAiAssistant: () => void;
  onOpenCreateSibling: (parentId: string | null) => void;
  onOpenCreateChild: (parentId: string) => void;
  onDeleteNode: (id: string) => void;
}

export default function DetailPanel({
  node,
  work,
  isOverview,
  parentOptions,
  onSave,
  onTriggerNodeAi,
  onOpenAiAssistant,
  onOpenCreateSibling,
  onOpenCreateChild,
  onDeleteNode,
}: DetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<NodeFormValues>({
    title: "",
    type: "scene",
    pointType: "conflict",
    parentId: null,
    goal: "",
    conflict: "",
    eventDescription: "",
    expectedOutcome: "",
    characters: "",
    locations: "",
    foreshadowing: "",
    linkedChapters: [],
    remarks: "",
  });

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  /**
   * 当切换节点时，重置表单为该节点数据，并恢复为默认只读态
   */
  useEffect(() => {
    if (node) {
      setFormValues({
        title: node.title || "",
        type: node.type || "scene",
        pointType: (node.pointType as any) || "conflict",
        parentId: node.parentId || null,
        goal: node.goal || "",
        conflict: node.conflict || "",
        eventDescription: node.eventDescription || "",
        expectedOutcome: node.expectedOutcome || "",
        characters: node.characters || "",
        locations: node.locations || "",
        foreshadowing: node.foreshadowing || "",
        linkedChapters: Array.isArray(node.linkedChapters) ? node.linkedChapters : [],
        remarks: node.remarks || "",
      });
      setIsEditing(false);
      setSavedSuccess(false);
      setError("");
    }
  }, [node]);

  /**
   * 保存当前修改并切回只读态
   */
  const handleSave = async () => {
    if (!node) return;
    if (!formValues.title.trim()) {
      setError("节点标题不能为空");
      return;
    }
    if (!formValues.goal.trim()) {
      setError("故事目标为必填项");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSave({
        id: node.id,
        title: formValues.title.trim(),
        type: formValues.type,
        pointType: formValues.type === "scene" ? formValues.pointType : undefined,
        parentId: formValues.parentId || null,
        goal: formValues.goal.trim(),
        conflict: formValues.conflict?.trim() || "",
        eventDescription: formValues.eventDescription?.trim() || "",
        expectedOutcome: formValues.expectedOutcome?.trim() || "",
        characters: formValues.characters?.trim() || "",
        locations: formValues.locations?.trim() || "",
        foreshadowing: formValues.foreshadowing?.trim() || "",
        linkedChapters: formValues.linkedChapters || [],
        remarks: formValues.remarks?.trim() || "",
      });

      setIsEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取节点层级徽章信息
   */
  const getBadgeInfo = () => {
    if (!node) return { label: "情节点", color: "gray" };
    switch (formValues.type) {
      case "story":
        return { label: "故事主线", color: "violet" };
      case "volume":
        return { label: "分卷", color: "indigo" };
      case "act":
        return { label: "幕 / 阶段", color: "blue" };
      case "branch":
        return { label: "支线 / 副本", color: "orange" };
      case "scene":
      default:
        if (formValues.pointType === "climax") return { label: "高潮情节点", color: "red" };
        if (formValues.pointType === "twist") return { label: "转折情节点", color: "violet" };
        if (formValues.pointType === "foreshadow") return { label: "伏笔情节点", color: "teal" };
        if (formValues.pointType === "conflict") return { label: "冲突情节点", color: "orange" };
        return { label: "情节点", color: "cyan" };
    }
  };

  /**
   * 全文大纲视图渲染
   */
  if (isOverview) {
    return (
      <Box p={15} bg="#ffffff" style={{ flex: 1, height: "100%", overflowY: "auto" }}>
        <Flex justify="space-between" align="center" mb={18} wrap="wrap" gap={12}>
          <Flex align="center" gap={10}>
            <Badge size="lg" color="teal" variant="filled" radius="sm">
              全文总览
            </Badge>
            <Text fz={18} fw={700} c="#0f172a">
              《{work?.title || "作品全文大纲"}》核心主旨与脉络
            </Text>
          </Flex>

          <Flex align="center" gap={8}>
            <Button
              variant="light"
              color="violet"
              size="sm"
              leftSection={<FiCompass size={14} />}
              onClick={onOpenAiAssistant}
            >
              大纲 AI 辅助工作台
            </Button>
          </Flex>
        </Flex>

        <Paper p="22px 26px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md" mb={16}>
          <Text fz={14} fw={700} c="#1e293b" mb={8}>
            📖 核心梗概与故事设定
          </Text>
          <Text fz={13} c="#475569" lh={1.7}>
            {work?.description || "暂未填写小说核心大纲简介。您可以点击右上方 AI 辅助快速推演生成完整主线与分卷体系。"}
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={16} mt={20}>
            <Box p="12px 14px" bg="#f8fafc" bd="1px solid #f1f5f9" style={{ borderRadius: 6 }}>
              <Text fz={11} c="#94a3b8">分类标签</Text>
              <Text fz={14} fw={600} c="#1e293b" mt={2}>{work?.tag || "玄幻修真"}</Text>
            </Box>
            <Box p="12px 14px" bg="#f8fafc" bd="1px solid #f1f5f9" style={{ borderRadius: 6 }}>
              <Text fz={11} c="#94a3b8">预计总字数</Text>
              <Text fz={14} fw={600} mt={2}>
                {((Number(work?.expectedWords) || 500000) / 10000).toLocaleString()} 万字
              </Text>
            </Box>
            <Box p="12px 14px" bg="#f8fafc" bd="1px solid #f1f5f9" style={{ borderRadius: 6 }}>
              <Text fz={11} c="#94a3b8">预计总章节</Text>
              <Text fz={14} fw={600} c="#10b981" mt={2}>
                {work?.expectedChapters || 100} 章
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>
      </Box>
    );
  }

  /**
   * 未选中任何节点时的空状态
   */
  if (!node) {
    return (
      <Box p={15} bg="#ffffff" style={{ flex: 1, height: "100%", overflowY: "auto" }}>
        <Flex
          direction="column"
          align="center"
          justify="center"
          style={{ height: "100%", color: "#94a3b8" }}
          gap={12}
        >
          <FiFileText size={42} strokeWidth={1.5} color="#cbd5e1" />
          <Text fz={14}>请在左侧大纲树中选择节点，或点击全文大纲查看总览</Text>
        </Flex>
      </Box>
    );
  }

  const badgeInfo = getBadgeInfo();

  return (
    <Box p={15} bg="#ffffff" style={{ flex: 1, height: "100%", overflowY: "auto" }}>
      {/* 头部 Flex 包裹 */}
      <Flex justify="space-between" align="center" mb={18} wrap="wrap" gap={12}>
        {/* 左侧：Title + 类型标签 */}
        <Flex align="center" gap={10}>
          <Text fz={18} fw={700} c="#0f172a">
            {formValues.title || "无标题节点"}
          </Text>
          <Badge size="md" color={badgeInfo.color} variant="light" radius="sm">
            {badgeInfo.label}
          </Badge>
        </Flex>

        {/* 右侧：AI 辅助 + 编辑/保存 + 更多操作 Menu */}
        <Flex align="center" gap={8}>
          {savedSuccess && (
            <Flex align="center" gap={4} fz={13} c="#10b981" fw={600}>
              <FiCheckCircle size={15} />
              已保存
            </Flex>
          )}

          <Button
            variant="light"
            color="blue"
            size="xs"
            leftSection={<FiZap size={13} />}
            onClick={() => onTriggerNodeAi("expand_node")}
          >
            AI 扩写
          </Button>

          <Button
            variant="light"
            color="teal"
            size="xs"
            leftSection={<FiScissors size={13} />}
            onClick={() => onTriggerNodeAi("split_node")}
          >
            拆解情节点
          </Button>

          {isEditing ? (
            <Button
              size="xs"
              leftSection={<FiSave size={13} />}
              loading={loading}
              onClick={handleSave}
            >
              保存
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              color="gray"
              leftSection={<FiEdit2 size={13} />}
              onClick={() => setIsEditing(true)}
            >
              编辑
            </Button>
          )}

          <Menu shadow="md" width={160} position="bottom-end">
            <Menu.Target>
              <ActionIcon size="sm" variant="subtle" color="gray">
                <FiMoreVertical size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                leftSection={<FiPlus size={14} />}
                onClick={() => onOpenCreateSibling(node.parentId)}
              >
                添加同级节点
              </Menu.Item>
              <Menu.Item
                leftSection={<FiCornerDownRight size={14} />}
                onClick={() => onOpenCreateChild(node.id)}
              >
                添加子节点
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<FiTrash2 size={14} />}
                onClick={() => onDeleteNode(node.id)}
              >
                删除节点
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Flex>
      </Flex>

      {/* 节点 11 全字段通用表单 */}
      <Paper p="20px 24px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
        <NodeForm
          initialValues={formValues}
          isEditing={isEditing}
          parentOptions={parentOptions}
          errorMessage={error}
          onChange={(val) => setFormValues(val)}
        />
      </Paper>
    </Box>
  );
}
