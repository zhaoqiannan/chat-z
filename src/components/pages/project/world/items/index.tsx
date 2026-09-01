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
  Textarea,
  Select,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  Paper,
  Group,
  Card,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiBox,
  FiSearch,
  FiUser,
  FiAlertTriangle,
  FiZap,
} from "react-icons/fi";
import {
  ItemData,
  getItemList,
  createItem,
  updateItem,
  deleteItem,
} from "@/rest/world";

interface ItemsTabProps {
  workId: string;
}

export default function ItemsTab({ workId }: ItemsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ItemData[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [category, setCategory] = useState("weapon");
  const [tier, setTier] = useState("天阶极品");
  const [appearance, setAppearance] = useState("");
  const [effects, setEffects] = useState("");
  const [drawbacks, setDrawbacks] = useState("");
  const [currentHolder, setCurrentHolder] = useState("");
  const [history, setHistory] = useState("");
  const [description, setDescription] = useState("");

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getItemList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取物品列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setCategory("weapon");
    setTier("天阶极品");
    setAppearance("");
    setEffects("");
    setDrawbacks("");
    setCurrentHolder("");
    setHistory("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: ItemData) => {
    setEditingItem(item);
    setName(item.name || "");
    setCategory(item.category || "weapon");
    setTier(item.tier || "极品");
    setAppearance(item.appearance || "");
    setEffects(item.effects || "");
    setDrawbacks(item.drawbacks || "");
    setCurrentHolder(item.currentHolder || "");
    setHistory(item.history || "");
    setDescription(item.description || "");
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入物品道具名称！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateItem({
          id: editingItem.id,
          name: name.trim(),
          category,
          tier: tier.trim() || undefined,
          appearance: appearance.trim() || undefined,
          effects: effects.trim() || undefined,
          drawbacks: drawbacks.trim() || undefined,
          currentHolder: currentHolder.trim() || undefined,
          history: history.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await createItem({
          workId: Number(workId),
          name: name.trim(),
          category,
          tier: tier.trim() || undefined,
          appearance: appearance.trim() || undefined,
          effects: effects.trim(),
          drawbacks: drawbacks.trim() || undefined,
          currentHolder: currentHolder.trim() || undefined,
          history: history.trim() || undefined,
          description: description.trim() || undefined,
        });
      }
      setModalOpened(false);
      await fetchList();
    } catch (e: any) {
      alert("保存物品失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("确定要删除该物品道具吗？此操作不可撤销。")) {
      const res = await deleteItem(id);
      if (res && res.success) {
        await fetchList();
      }
    }
  };

  const filteredList = list.filter((item) => {
    const matchSearch =
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.effects && item.effects.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.currentHolder && item.currentHolder.toLowerCase().includes(searchKey.toLowerCase()));

    const matchCategory = categoryFilter === "all" || item.category === categoryFilter;

    return matchSearch && matchCategory;
  });

  return (
    <Box>
      <Group justify="space-between" align="center" mb="lg" wrap="wrap">
        <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 500 }}>
          <TextInput
            placeholder="搜索物品名称、异能或持有者..."
            leftSection={<FiSearch size={14} />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            style={{ flex: 1 }}
          />

          <Select
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val || "all")}
            data={[
              { value: "all", label: "全部类别" },
              { value: "weapon", label: "⚔️ 神兵武器" },
              { value: "treasure", label: "🔮 法宝圣物" },
              { value: "consumable", label: "💊 灵丹耗材" },
              { value: "tech", label: "⚙️ 科技装置" },
              { value: "forbidden", label: "💀 禁忌邪物" },
              { value: "token", label: "🗝️ 信物道具" },
            ]}
            style={{ width: 140 }}
          />
        </Group>

        <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreate}>
          新建物品道具
        </Button>
      </Group>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
            <FiBox size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无物品道具数据</Text>
            <Text fz={13}>点击右上角「新建物品道具」设定神兵、法宝与奇物</Text>
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {filteredList.map((item) => (
              <Card
                key={item.id}
                shadow="sm"
                radius="md"
                withBorder
                p="md"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s ease",
                }}
              >
                <Group justify="space-between" align="flex-start" mb="xs">
                  <Group gap="xs" align="center">
                    <FiBox size={18} color="#06b6d4" />
                    <Text fz={17} fw={700} c="dark.7">
                      {item.name}
                    </Text>
                  </Group>
                  <Badge color="cyan" variant="light" size="sm">
                    {item.tier || "极品"}
                  </Badge>
                </Group>

                {item.currentHolder && (
                  <Group gap={6} fz={12} c="dimmed" mb="xs">
                    <FiUser size={13} />
                    <Text fz={12}>当前持有者：<Text span fw={600} c="dark.5">{item.currentHolder}</Text></Text>
                  </Group>
                )}

                {item.effects && (
                  <Paper mb="xs" p="xs" bg="teal.0" radius="sm" style={{ border: "1px solid var(--mantine-color-teal-2)" }}>
                    <Group gap={4} c="teal.9" fz={11} fw={700} mb={2}>
                      <FiZap size={12} />
                      <Text fz={11} fw={700}>核心异能机理</Text>
                    </Group>
                    <Text fz={12} c="teal.9" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.effects}
                    </Text>
                  </Paper>
                )}

                {item.drawbacks && (
                  <Paper mb="xs" p="xs" bg="red.0" radius="sm" style={{ border: "1px solid var(--mantine-color-red-2)" }}>
                    <Group gap={4} c="red.9" fz={11} fw={700} mb={2}>
                      <FiAlertTriangle size={12} />
                      <Text fz={11} fw={700}>代价与负面限制</Text>
                    </Group>
                    <Text fz={12} c="red.9" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.drawbacks}
                    </Text>
                  </Paper>
                )}

                <Group justify="flex-end" gap="xs" mt="auto" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                  <ActionIcon variant="subtle" color="cyan" size="sm" onClick={() => handleOpenEdit(item)}>
                    <FiEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑物品 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiBox color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑物品 - ${editingItem.name}` : "新建物品 / 神兵法宝设定"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="物品名称"
              placeholder="例如：诛仙古剑 / 掌天瓶"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              label="物品类别"
              value={category}
              onChange={(val) => setCategory(val || "weapon")}
              data={[
                { value: "weapon", label: "⚔️ 神兵武器 / 飞剑宝刀" },
                { value: "treasure", label: "🔮 法宝圣物 / 先天灵宝" },
                { value: "consumable", label: "💊 灵丹妙药 / 符箓耗材" },
                { value: "tech", label: "⚙️ 机械科技 / 装置图纸" },
                { value: "forbidden", label: "💀 禁忌邪物 / 诅咒奇物" },
                { value: "token", label: "🗝️ 宗门信物 / 密钥令牌" },
              ]}
            />
            <TextInput
              label="品阶 / 品级"
              placeholder="例如：天阶极品 / 荒古圣器"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="当前持有者 / 所处位置"
              placeholder="例如：主角林肆 / 封印在剑冢底层"
              value={currentHolder}
              onChange={(e) => setCurrentHolder(e.target.value)}
            />
            <TextInput
              label="外形外观与材质描写"
              placeholder="例如：通体赤红如血，剑身铭刻上古雷纹..."
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Textarea
              label="核心特殊功能 / 异能神通"
              placeholder="例如：挥剑可引九霄神雷，无视物理护甲直接震荡神魂..."
              value={effects}
              onChange={(e) => setEffects(e.target.value)}
              minRows={3}
            />
            <Textarea
              label="负面代价 / 缺陷与使用限制 (选填)"
              placeholder="例如：使用后需抽取宿主三年寿命，且极易引来天道反噬..."
              value={drawbacks}
              onChange={(e) => setDrawbacks(e.target.value)}
              minRows={3}
            />
          </SimpleGrid>

          <Textarea
            label="来历源流与历史传说 (选填)"
            placeholder="例如：上古大能渡劫遗落在此界的神物，曾斩杀十位大乘仙尊..."
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="详细补充说明"
            placeholder="记录其他设定备忘..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={2}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建物品"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
