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
  Stack,
  Badge,
  Paper,
  SimpleGrid,
  Menu,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  FiSave,
  FiZap,
  FiCheckCircle,
  FiScissors,
  FiMoreVertical,
  FiPlus,
  FiCornerDownRight,
  FiTrash2,
  FiEdit2,
  FiFileText,
  FiCompass,
} from "react-icons/fi";
import { OutlineNode, OutlineNodeType, PlotPointType, UpdateOutlinePayload } from "@/rest/outline";
import { WorkItem } from "@/rest/work";
import ChapterPicker from "../chapter-picker";
import styles from "../style.module.scss";

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

  const [title, setTitle] = useState("");
  const [type, setType] = useState<OutlineNodeType>("scene");
  const [pointType, setPointType] = useState<PlotPointType>("conflict");
  const [parentId, setParentId] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [conflict, setConflict] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [characters, setCharacters] = useState("");
  const [locations, setLocations] = useState("");
  const [foreshadowing, setForeshadowing] = useState("");
  const [linkedChapters, setLinkedChapters] = useState<number[]>([]);
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  /**
   * 当切换节点时，重置表单为该节点数据，并恢复为默认只读态
   */
  useEffect(() => {
    if (node) {
      setTitle(node.title || "");
      setType(node.type || "scene");
      setPointType((node.pointType as PlotPointType) || "conflict");
      setParentId(node.parentId || null);
      setGoal(node.goal || "");
      setConflict(node.conflict || "");
      setEventDescription(node.eventDescription || "");
      setExpectedOutcome(node.expectedOutcome || "");
      setCharacters(node.characters || "");
      setLocations(node.locations || "");
      setForeshadowing(node.foreshadowing || "");
      setLinkedChapters(Array.isArray(node.linkedChapters) ? node.linkedChapters : []);
      setRemarks(node.remarks || "");
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
    if (!title.trim()) {
      setError("节点标题不能为空");
      return;
    }
    if (!goal.trim()) {
      setError("故事目标为必填项");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await onSave({
        id: node.id,
        title: title.trim(),
        type,
        pointType: type === "scene" ? pointType : undefined,
        parentId: parentId || null,
        goal: goal.trim(),
        conflict: conflict.trim(),
        eventDescription: eventDescription.trim(),
        expectedOutcome: expectedOutcome.trim(),
        characters: characters.trim(),
        locations: locations.trim(),
        foreshadowing: foreshadowing.trim(),
        linkedChapters: linkedChapters,
        remarks: remarks.trim(),
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
    switch (node.type) {
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
        if (node.pointType === "climax") return { label: "高潮情节点", color: "red" };
        if (node.pointType === "twist") return { label: "转折情节点", color: "violet" };
        if (node.pointType === "foreshadow") return { label: "伏笔情节点", color: "teal" };
        if (node.pointType === "conflict") return { label: "冲突情节点", color: "orange" };
        return { label: "情节点", color: "cyan" };
    }
  };

  /**
   * 全文大纲视图渲染
   */
  if (isOverview) {
    return (
      <main >
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
            {work?.description || "暂未填写小说核心大纲简介。您可以点击左上角 AI 辅助快速推演生成完整主线与分卷体系。"}
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={16} mt={20}>
            <Box p="12px 14px" bg="#f8fafc" bd="1px solid #f1f5f9" style={{ borderRadius: 6 }}>
              <Text fz={11} c="#94a3b8">分类标签</Text>
              <Text fz={14} fw={600} c="#1e293b" mt={2}>{work?.tag || "玄幻修真"}</Text>
            </Box>
            <Box p="12px 14px" bg="#f8fafc" bd="1px solid #f1f5f9" style={{ borderRadius: 6 }}>
              <Text fz={11} c="#94a3b8">预计总字数</Text>
              <Text fz={14} fw={600} c="#00c9ff" mt={2}>
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
      </main>
    );
  }

  /**
   * 未选中任何节点时的空状态
   */
  if (!node) {
    return (
      <main >
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
      </main>
    );
  }

  const badgeInfo = getBadgeInfo();

  return (
    <Box p={15} bg={'#fff'}>
      {/* 头部 Flex 包裹 */}
      <Flex justify="space-between" align="center" mb={18} wrap="wrap" gap={12}>
        {/* 左侧：Title + 类型标签 */}
        <Flex align="center" gap={10}>
          <Text fz={18} fw={700} c="#0f172a">
            {title || "无标题节点"}
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

      {/* 节点 11 全字段表单 */}
      <Paper p="20px 24px" bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
        <Stack gap="16px" className="form-box">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="12px">
            <TextInput
              label="1. 节点标题"
              placeholder="请输入节点名称"
              value={title}
              disabled={!isEditing}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
            />

            <Select
              label="2. 层级类型"
              value={type}
              disabled={!isEditing}
              onChange={(val) => setType((val as OutlineNodeType) || "scene")}
              data={[
                { value: "story", label: "故事主线" },
                { value: "volume", label: "卷 / 篇章" },
                { value: "act", label: "幕 / 阶段" },
                { value: "scene", label: "情节点" },
                { value: "branch", label: "支线 / 副本" },
              ]}
            />

            {type === "scene" ? (
              <Select
                label="情节点细分类型"
                value={pointType}
                disabled={!isEditing}
                onChange={(val) => setPointType((val as PlotPointType) || "conflict")}
                data={[
                  { value: "conflict", label: "核心冲突" },
                  { value: "twist", label: "剧情转折" },
                  { value: "foreshadow", label: "伏笔铺垫" },
                  { value: "climax", label: "情绪高潮" },
                  { value: "transition", label: "日常过渡" },
                  { value: "reveal", label: "悬念揭示" },
                ]}
              />
            ) : (
              <Select
                label="挂载父级节点"
                placeholder="无父节点 (顶级)"
                value={parentId || ""}
                disabled={!isEditing}
                onChange={(val) => setParentId(val || null)}
                data={parentOptions}
                clearable
              />
            )}
          </SimpleGrid>

          {type === "scene" && (
            <Select
              label="挂载父级节点"
              placeholder="请选择所属卷/幕"
              value={parentId || ""}
              disabled={!isEditing}
              onChange={(val) => setParentId(val || null)}
              data={parentOptions}
              clearable
            />
          )}

          <Textarea
            label="3. 故事目标 (*必填)"
            placeholder="该节点解决什么故事问题/达成什么叙事目标？"
            value={goal}
            disabled={!isEditing}
            onChange={(e) => setGoal(e.currentTarget.value)}
            minRows={2}
            required
          />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="14px">
            <Textarea
              label="4. 主要冲突"
              placeholder="人物或力量之间的矛盾与对立..."
              value={conflict}
              disabled={!isEditing}
              onChange={(e) => setConflict(e.currentTarget.value)}
              minRows={3}
            />

            <Textarea
              label="5. 事件描述 (发生什么)"
              placeholder="简述该节点具体发生的核心事件脉络..."
              value={eventDescription}
              disabled={!isEditing}
              onChange={(e) => setEventDescription(e.currentTarget.value)}
              minRows={3}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="14px">
            <TextInput
              label="6. 结果 / 状态变化"
              placeholder="事件结束后局势与角色状态如何变化..."
              value={expectedOutcome}
              disabled={!isEditing}
              onChange={(e) => setExpectedOutcome(e.currentTarget.value)}
            />

            <TextInput
              label="7. 伏笔 (新增或回收)"
              placeholder="新增或回收的前文伏笔/线索..."
              value={foreshadowing}
              disabled={!isEditing}
              onChange={(e) => setForeshadowing(e.currentTarget.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="14px">
            <TextInput
              label="8. 关联人物"
              placeholder="如：主角, 长老, 反派圣女"
              value={characters}
              disabled={!isEditing}
              onChange={(e) => setCharacters(e.currentTarget.value)}
            />

            <TextInput
              label="9. 关联地点"
              placeholder="如：家族正厅, 后山寒潭"
              value={locations}
              disabled={!isEditing}
              onChange={(e) => setLocations(e.currentTarget.value)}
            />
          </SimpleGrid>

          <Box>
            <Text fz={13} fw={600} c="#475569" mb={6}>
              10. 对应章节
            </Text>
            <ChapterPicker
              value={linkedChapters}
              onChange={(val) => {
                if (isEditing) setLinkedChapters(val);
              }}
            />
          </Box>

          <TextInput
            label="11. 备注说明 (作者临时备忘)"
            placeholder="记录作者的临时灵感或备忘说明..."
            value={remarks}
            disabled={!isEditing}
            onChange={(e) => setRemarks(e.currentTarget.value)}
          />

          {error && (
            <Text c="red" fz="xs" fw={500}>
              {error}
            </Text>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
