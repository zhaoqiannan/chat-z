// 组件：世界规则与设定管理（瀑布流双列卡片、置顶/折叠展开、公共富文本表格与图片编译器）
"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  Paper,
  Group,
  Tooltip,
  Collapse,
  Divider,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiSliders,
  FiChevronDown,
  FiChevronUp,
  FiBookmark,
} from "react-icons/fi";
import {
  WorldRuleItem,
  getWorldRuleList,
  createWorldRule,
  updateWorldRule,
  deleteWorldRule,
  getCharacterList,
  CharacterItem,
  getFactionList,
  FactionItem,
} from "@/rest/world";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import { RichTextEditor, RichTextViewer } from "@/components/common/rich-text";

interface RulesTabProps {
  workId: string;
}

export default function RulesTab({ workId }: RulesTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<WorldRuleItem[]>([]);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [factions, setFactions] = useState<FactionItem[]>([]);
  const [searchKey, setSearchKey] = useState("");

  // 卡片展开状态：Set 存放展开的规则 ID，默认全部收起
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // 新建/编辑弹窗
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<WorldRuleItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [name, setName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [factionName, setFactionName] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");

  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const [ruleRes, charRes, facRes] = await Promise.all([
        getWorldRuleList(workId),
        getCharacterList(workId),
        getFactionList(workId),
      ]);

      if (ruleRes && ruleRes.success && Array.isArray(ruleRes.result)) {
        setList(ruleRes.result);
      }
      if (charRes && charRes.success && Array.isArray(charRes.result)) {
        setCharacters(charRes.result);
      }
      if (facRes && facRes.success && Array.isArray(facRes.result)) {
        setFactions(facRes.result);
      }
    } catch (e) {
      console.error("获取世界规则失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setCharacterName("");
    setFactionName("");
    setDescriptionHtml("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: WorldRuleItem) => {
    setEditingItem(item);
    setName(item.name || "");
    const charVal = item.characters || (item.extra?.characters as string) || "";
    const facVal = item.factions || (item.extra?.factions as string) || "";
    setCharacterName(charVal);
    setFactionName(facVal);
    const content = item.description || item.mechanisms || "";
    setDescriptionHtml(content);
    setModalOpened(true);
  };

  const handleTogglePin = async (item: WorldRuleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextPinned = item.isPinned ? 0 : 1;
      await updateWorldRule({
        id: item.id,
        isPinned: nextPinned,
      });
      setList((prev) => {
        const updated = prev.map((r) => (r.id === item.id ? { ...r, isPinned: nextPinned } : r));
        return updated.sort((a, b) => (Number(b.isPinned) || 0) - (Number(a.isPinned) || 0));
      });
    } catch (err: any) {
      useAlert.error("置顶状态切换失败: " + (err?.message || "网络异常"));
    }
  };

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    if (expandedIds.size === filteredList.length && filteredList.length > 0) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(filteredList.map((item) => item.id)));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      useAlert.warning("请输入规则名称");
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: name.trim(),
        characters: characterName.trim() || undefined,
        factions: factionName.trim() || undefined,
        description: descriptionHtml || undefined,
        mechanisms: descriptionHtml || undefined,
      };

      if (editingItem) {
        await updateWorldRule({ id: editingItem.id, ...payload });
      } else {
        await createWorldRule({ workId: Number(workId), ...payload });
      }

      useAlert.success("规则设定已成功保存！");
      setModalOpened(false);
      await fetchData();
    } catch (e: any) {
      useAlert.error("保存规则失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await showConfirm({
      title: "删除规则",
      message: "确定要删除该规则设定吗？此操作不可撤销。",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deleteWorldRule(id);
        setList((prev) => prev.filter((item) => item.id !== id));
        useAlert.success("规则已成功删除");
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const filteredList = list.filter((item) => {
    if (!searchKey) return true;
    const q = searchKey.toLowerCase();
    const charVal = item.characters || (item.extra?.characters as string) || "";
    const facVal = item.factions || (item.extra?.factions as string) || "";
    return (
      item.name.toLowerCase().includes(q) ||
      (charVal && charVal.toLowerCase().includes(q)) ||
      (facVal && facVal.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.mechanisms && item.mechanisms.toLowerCase().includes(q))
    );
  });

  const charSelectData = [
    { value: "", label: "暂无关联角色 (全局生效)" },
    ...characters.map((c) => ({ value: c.name, label: c.name })),
  ];

  const factionSelectData = [
    { value: "", label: "暂无关联阵营 (全阵营通用)" },
    ...factions.map((f) => ({ value: f.name, label: f.name })),
  ];

  // 瀑布流双列拆分
  const leftColumnItems = filteredList.filter((_, idx) => idx % 2 === 0);
  const rightColumnItems = filteredList.filter((_, idx) => idx % 2 === 1);

  const isAllExpanded = expandedIds.size === filteredList.length && filteredList.length > 0;

  const renderRuleCard = (item: WorldRuleItem) => {
    const isExpanded = expandedIds.has(item.id);
    const charVal = item.characters || (item.extra?.characters as string) || "";
    const facVal = item.factions || (item.extra?.factions as string) || "";
    const content = item.description || item.mechanisms || "";
    const isPinned = item.isPinned === 1;

    return (
      <Paper
        key={item.id}
        p="md"
        withBorder
        radius="md"
        style={{
          backgroundColor: "#ffffff",
          borderColor: isPinned ? "#fde047" : "#e2e8f0",
          boxShadow: isPinned ? "0 4px 12px rgba(234, 179, 8, 0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
          transition: "all 0.2s ease",
          position: "relative",
          marginBottom: 16,
        }}
      >
        {/* 第一行：标题 + 右侧操作按钮组 (置顶 | 编辑 | 删除 | 收起/展开) */}
        <Flex justify="space-between" align="center" mb={6}>
          <Group gap={8} style={{ flex: 1, minWidth: 0 }}>
            {isPinned && (
              <Badge size="xs" color="yellow" variant="filled">
                置顶
              </Badge>
            )}
            <Text fz={15} fw={700} c="#0f172a" truncate="end" title={item.name}>
              {item.name}
            </Text>
          </Group>

          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label={isPinned ? "取消置顶" : "置顶该规则"} position="top">
              <ActionIcon
                size="sm"
                variant={isPinned ? "filled" : "subtle"}
                color={isPinned ? "yellow" : "gray"}
                onClick={(e) => handleTogglePin(item, e)}
              >
                <FiBookmark size={13} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="编辑规则" position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                onClick={() => handleOpenEdit(item)}
              >
                <FiEdit2 size={13} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="删除规则" position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={(e) => handleDelete(item.id, e)}
              >
                <FiTrash2 size={13} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={isExpanded ? "收起内容" : "展开内容"} position="top">
              <ActionIcon
                size="sm"
                variant="light"
                color="gray"
                onClick={() => handleToggleExpand(item.id)}
              >
                {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Flex>

        {/* 第二行：角色 | 阵营 标签 */}
        <Group gap={6} mb={isExpanded ? "sm" : 0}>
          {charVal ? (
            <Badge size="xs" variant="light" color="indigo">
              👑 {charVal}
            </Badge>
          ) : (
            <Badge size="xs" variant="outline" color="gray">
              全角色通用
            </Badge>
          )}

          {facVal ? (
            <Badge size="xs" variant="light" color="teal">
              🛡️ {facVal}
            </Badge>
          ) : (
            <Badge size="xs" variant="outline" color="gray">
              全阵营通用
            </Badge>
          )}
        </Group>

        {/* 内容区：展开时撑开卡片高度，渲染公共富文本回显 */}
        <Collapse expanded={isExpanded}>
          <Divider my="sm" color="#f1f5f9" />
          <RichTextViewer content={content} emptyText="暂无详细规则内容" />
        </Collapse>
      </Paper>
    );
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />

      {/* 顶部工具栏：搜索框、一键全部展开/收起、新建规则按钮 */}
      <Flex justify="space-between" align="center" mb="lg" gap="sm" wrap="wrap">
        <TextInput
          placeholder="搜索世界规则名称、机制设定、关联角色或阵营..."
          leftSection={<FiSearch size={14} />}
          size="xs"
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 340 }}
        />

        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={isAllExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
            onClick={handleToggleExpandAll}
          >
            {isAllExpanded ? "全部收起" : "全部展开"}
          </Button>

          <Button size="xs" leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
            新建世界规则
          </Button>
        </Group>
      </Flex>

      {/* 瀑布流双列卡片布局 */}
      {filteredList.length === 0 ? (
        <Paper p="xl" bg="#f8fafc" withBorder radius="md" style={{ textAlign: "center", padding: "80px 0" }}>
          <Text fz={14} c="#94a3b8" mb="sm">
            暂无匹配的世界规则设定
          </Text>
          <Button size="xs" variant="light" onClick={handleOpenCreate}>
            新建世界规则
          </Button>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" style={{ alignItems: "flex-start" }}>
          <Box>{leftColumnItems.map(renderRuleCard)}</Box>
          <Box>{rightColumnItems.map(renderRuleCard)}</Box>
        </SimpleGrid>
      )}

      {/* 新建/编辑规则弹窗 - 75vw 富文本公共大编译器 */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap={8}>
            <FiSliders size={18} color="#0284c7" />
            <Text fw={700} fz={16} c="#0f172a">
              {editingItem ? "编辑世界规则" : "新建世界规则"}
            </Text>
          </Group>
        }
        size="75vw"
        centered
        radius="md"
        styles={{
          content: {
            maxHeight: "90vh",
            maxWidth: "1250px",
            minWidth: "360px",
            display: "flex",
            flexDirection: "column",
          },
          header: {
            borderBottom: "1px solid #f1f5f9",
            padding: "16px 24px",
            flexShrink: 0,
          },
          body: {
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            padding: "20px 24px",
          },
        }}
      >
        <Stack gap="md">
          <TextInput
            label="规则名称"
            placeholder="例如：大陆通用货币与汇率体系"
            size="sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            styles={{ input: { fontWeight: 600 } }}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="关联专属角色 (选填)"
              placeholder="选择适用的专属角色"
              size="xs"
              value={characterName}
              onChange={(val) => setCharacterName(val || "")}
              data={charSelectData}
              clearable
              searchable
            />
            <Select
              label="关联专属阵营 (选填)"
              placeholder="选择适用的所属势力"
              size="xs"
              value={factionName}
              onChange={(val) => setFactionName(val || "")}
              data={factionSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          {/* 公共富文本编辑器 */}
          <Box>
            <Text fz={13} fw={600} c="#334155" mb={6}>
              核心规则内容、法则机制与数据表格 (所见即所得富文本排版)
            </Text>

            <RichTextEditor
              value={descriptionHtml}
              onChange={(html) => setDescriptionHtml(html)}
              placeholder="输入核心法则、机制说明、阶梯设定或插入数据表格/图片..."
              minHeight={280}
              maxHeight={460}
            />
          </Box>

          <Flex justify="flex-end" gap="xs" mt="md" pt={12} style={{ borderTop: "1px solid #f1f5f9" }}>
            <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button size="xs" loading={formLoading} onClick={handleSave}>
              {editingItem ? "保存修改" : "确认创建"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
