// 组件：世界规则与设定管理（瀑布流双列卡片、置顶/折叠展开、富文本表格与图片编译器）
"use client";

import React, { useState, useEffect, useRef } from "react";
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
  FiImage,
  FiGrid,
  FiBold,
  FiItalic,
  FiUnderline,
  FiList,
  FiUploadCloud,
  FiCheck,
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
  uploadImageFile,
} from "@/rest/world";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";

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

  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  // 同步富文本编辑器内容
  useEffect(() => {
    if (modalOpened && editorRef.current) {
      editorRef.current.innerHTML = descriptionHtml;
    }
  }, [modalOpened]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setCharacterName("");
    setFactionName("");
    setDescriptionHtml("");
    if (editorRef.current) editorRef.current.innerHTML = "";
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
    if (editorRef.current) editorRef.current.innerHTML = content;
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

  const execCmd = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setDescriptionHtml(editorRef.current.innerHTML);
    }
  };

  const insertHtmlAtCursor = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement("div");
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      let lastNode: ChildNode | null = null;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += html;
    }
    setDescriptionHtml(editorRef.current.innerHTML);
  };

  const handleInsertTable = (type: "currency" | "levels" | "generic") => {
    let tableHtml = "";
    if (type === "currency") {
      tableHtml = `
<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;">
  <thead>
    <tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">货币名称</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">换算比例</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">购买力参考</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">铜钱 (文)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1 铜钱</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1个大烧饼 / 粗茶一壶</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">白银 (两)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1两 = 1,000 铜钱</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">寻常三口之家一月用度</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">黄金 (两)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1两 = 10 两白银</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">京城上好绸缎一匹 / 凡品战刀</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">灵石 (初品)</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">1枚 = 100 两黄金</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">炼气期修士修炼基础资源</td>
    </tr>
  </tbody>
</table><p><br></p>`;
    } else if (type === "levels") {
      tableHtml = `
<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;">
  <thead>
    <tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">阶位等级</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">寿元上限</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">核心能力特征</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">突破瓶颈/代价</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">一阶 · 炼体期</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">百年</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">肉身坚如磐石，千斤巨力</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">需经脉筑基丹破关</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">二阶 · 筑基期</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">二百年</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">气海化液，可御空滑翔</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">遭遇心魔反噬风险</td>
    </tr>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">三阶 · 金丹期</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">五百年</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">丹碎成婴，引天地雷劫</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">需渡九重天雷劫</td>
    </tr>
  </tbody>
</table><p><br></p>`;
    } else {
      tableHtml = `
<table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; border:1px solid #cbd5e1;">
  <thead>
    <tr style="background-color:#f1f5f9; border-bottom:2px solid #cbd5e1;">
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">属性维度</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">数值/设定标准</th>
      <th style="padding:8px 12px; border:1px solid #cbd5e1; text-align:left;">备注说明</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">参数 1</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">标准数值</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">适用全大陆</td>
    </tr>
    <tr style="background-color:#f8fafc;">
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">参数 2</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">高阶标准</td>
      <td style="padding:8px 12px; border:1px solid #cbd5e1;">仅限专属宗门</td>
    </tr>
  </tbody>
</table><p><br></p>`;
    }
    insertHtmlAtCursor(tableHtml);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const res = await uploadImageFile(file);
      if (res && res.success && res.url) {
        insertHtmlAtCursor(`<p><img src="${res.url}" alt="规则插图" style="max-width:100%; border-radius:6px; margin:8px 0; border:1px solid #e2e8f0;" /></p><p><br></p>`);
        useAlert.success("图片插入成功");
      } else {
        useAlert.error("图片上传失败: " + (res?.message || "网络异常"));
      }
    } catch (err: any) {
      useAlert.error("上传图片异常: " + (err?.message || "网络错误"));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      useAlert.warning("请输入规则名称");
      return;
    }

    const currentContent = editorRef.current ? editorRef.current.innerHTML : descriptionHtml;

    try {
      setFormLoading(true);
      const payload = {
        name: name.trim(),
        characters: characterName.trim() || undefined,
        factions: factionName.trim() || undefined,
        description: currentContent || undefined,
        mechanisms: currentContent || undefined,
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

        {/* 内容区：展开时撑开卡片高度，渲染富文本（支持表格、图片、段落） */}
        <Collapse expanded={isExpanded}>
          <Divider my="sm" color="#f1f5f9" />
          {content ? (
            <Box
              className="rule-rich-content"
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: "#334155",
                wordBreak: "break-word",
              }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <Text fz={12} c="#94a3b8" style={{ fontStyle: "italic" }}>
              暂无详细规则内容
            </Text>
          )}
        </Collapse>
      </Paper>
    );
  };

  return (
    <Box pos="relative" >
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

      {/* 隐藏的图片上传 input */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleUploadImage}
      />

      {/* 新建/编辑规则弹窗 - 70vw 富文本大编译器 */}
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
        size="70vw"
        centered
        radius="md"
        styles={{
          content: {
            maxHeight: "90vh",
            maxWidth: "1200px",
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

          {/* 富文本编辑器工具栏 */}
          <Box>
            <Text fz={13} fw={600} c="#334155" mb={6}>
              核心规则内容、法则机制与数据表格 (所见即所得富文本排版)
            </Text>

            <Paper p="xs" bg="#f8fafc" withBorder radius="sm" mb={6} style={{ borderColor: "#e2e8f0" }}>
              <Flex gap={4} wrap="wrap" align="center">
                {/* 格式工具 */}
                <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("bold")} title="加粗 (Ctrl+B)">
                  <FiBold size={13} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("italic")} title="斜体 (Ctrl+I)">
                  <FiItalic size={13} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("underline")} title="下划线 (Ctrl+U)">
                  <FiUnderline size={13} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" onClick={() => execCmd("insertUnorderedList")} title="无序列表">
                  <FiList size={13} />
                </ActionIcon>

                <Divider orientation="vertical" mx={4} />

                {/* 快捷表格插入 */}
                <Button
                  size="compact-xs"
                  variant="light"
                  color="blue"
                  leftSection={<FiGrid size={11} />}
                  onClick={() => handleInsertTable("currency")}
                >
                  + 货币汇率表
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="indigo"
                  leftSection={<FiGrid size={11} />}
                  onClick={() => handleInsertTable("levels")}
                >
                  + 境界阶梯表
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  leftSection={<FiGrid size={11} />}
                  onClick={() => handleInsertTable("generic")}
                >
                  + 通用数据表
                </Button>

                <Divider orientation="vertical" mx={4} />

                {/* 上传图片 */}
                <Button
                  size="compact-xs"
                  variant="light"
                  color="teal"
                  leftSection={<FiImage size={11} />}
                  loading={uploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                >
                  插入图片
                </Button>
              </Flex>
            </Paper>

            {/* 可编辑富文本容器 */}
            <Box
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="rule-rich-content"
              onInput={(e) => setDescriptionHtml((e.target as HTMLElement).innerHTML)}
              style={{
                minHeight: 280,
                maxHeight: 460,
                overflowY: "auto",
                padding: "12px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                backgroundColor: "#ffffff",
                fontSize: 13,
                lineHeight: 1.7,
                color: "#1e293b",
                outline: "none",
              }}
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

      {/* 富文本表格与图片样式注入 */}
      <style jsx global>{`
        .rule-rich-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 13px;
        }
        .rule-rich-content th,
        .rule-rich-content td {
          border: 1px solid #e2e8f0;
          padding: 8px 12px;
          text-align: left;
        }
        .rule-rich-content th {
          background-color: #f8fafc;
          font-weight: 700;
          color: #334155;
        }
        .rule-rich-content tr:nth-child(even) td {
          background-color: #fafbfc;
        }
        .rule-rich-content img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 8px 0;
          border: 1px solid #e2e8f0;
        }
        .rule-rich-content p {
          margin: 4px 0;
        }
      `}</style>
    </Box>
  );
}
