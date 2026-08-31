"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Paper,
  SimpleGrid,
  Menu,
  ActionIcon,
} from "@mantine/core";
import {
  FiSave,
  FiZap,
  FiScissors,
  FiMoreVertical,
  FiPlus,
  FiCornerDownRight,
  FiTrash2,
  FiEdit2,
  FiFileText,
  FiCompass,
  FiClock,
} from "react-icons/fi";
import { OutlineNode, UpdateOutlinePayload } from "@/rest/outline";
import { WorkItem } from "@/rest/work";
import NodeForm, { NodeFormValues, NodeFormRef } from "../node-form";

interface DetailPanelProps {
  node: OutlineNode | null;
  work: WorkItem | null;
  isOverview: boolean;
  parentOptions: { value: string; label: string }[];
  onSave: (data: UpdateOutlinePayload) => Promise<void>;
  onTriggerNodeAi: (action: "expand_node" | "split_node") => void;
  onOpenAiAssistant: () => void;
  onOpenHistory?: () => void;
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
  onOpenHistory,
  onOpenCreateSibling,
  onOpenCreateChild,
  onDeleteNode,
}: DetailPanelProps) {
  const formRef = useRef<NodeFormRef>(null);
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
    }
  }, [node]);

  /**
   * 保存当前修改并切回只读态（基于 Mantine form 表单校验）
   */
  const handleSave = async () => {
    if (!node || !formRef.current) return;
    const isValid = formRef.current.validate();
    if (!isValid) {
      return;
    }

    const currentData = formRef.current.getValues();

    try {
      setLoading(true);
      await onSave({
        id: node.id,
        title: currentData.title.trim(),
        type: currentData.type,
        pointType: currentData.type === "scene" ? currentData.pointType : undefined,
        parentId: currentData.parentId || null,
        goal: currentData.goal.trim(),
        conflict: currentData.conflict?.trim() || "",
        eventDescription: currentData.eventDescription?.trim() || "",
        expectedOutcome: currentData.expectedOutcome?.trim() || "",
        characters: currentData.characters?.trim() || "",
        locations: currentData.locations?.trim() || "",
        foreshadowing: currentData.foreshadowing?.trim() || "",
        linkedChapters: currentData.linkedChapters || [],
        remarks: currentData.remarks?.trim() || "",
      });

      setIsEditing(false);
    } catch (err: any) {
      console.error("保存大纲节点失败:", err);
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
            {onOpenHistory && (
              <Button
                variant="outline"
                color="blue"
                size="sm"
                leftSection={<FiClock size={14} />}
                onClick={onOpenHistory}
              >
                推演历史
              </Button>
            )}
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
      <Flex justify="space-between" align="center" mb={18} wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <Text fz={18} fw={700} c="#0f172a">
            {formValues.title || "无标题节点"}
          </Text>
          <Badge size="md" color={badgeInfo.color} variant="light" radius="sm">
            {badgeInfo.label}
          </Badge>
        </Flex>

        <Flex align="center" gap={8}>
          {!isEditing && (
            <Button
              variant="outline"
              color="gray"
              size="xs"
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
                leftSection={<FiZap size={14} />}
                onClick={() => onTriggerNodeAi("expand_node")}
              >
                AI 扩写
              </Menu.Item>
              <Menu.Item
                leftSection={<FiScissors size={14} />}
                onClick={() => onTriggerNodeAi("split_node")}
              >
                拆解情节点
              </Menu.Item>
              {onOpenHistory && (
                <Menu.Item
                  leftSection={<FiClock size={14} />}
                  onClick={onOpenHistory}
                >
                  推演历史版本
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item
                leftSection={<FiPlus size={14} />}
                onClick={() => onOpenCreateSibling(node.parentId || null)}
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

      <Paper p="20px 24px" bd="1px solid #e2e8f0" radius="md">
        <NodeForm
          ref={formRef}
          initialValues={formValues}
          isEditing={isEditing}
          parentOptions={parentOptions}
          onChange={(val) => setFormValues(val)}
        />

        {isEditing && (
          <Flex justify="flex-end" gap={10} mt={20}>
            <Button
              leftSection={<FiSave size={13} />}
              loading={loading}
              onClick={handleSave}
            >
              保存
            </Button>
          </Flex>
        )}
      </Paper>
    </Box>
  );
}
