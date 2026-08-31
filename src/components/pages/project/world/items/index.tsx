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
import styles from "../style.module.scss";

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
    setTier(item.tier || "天阶极品");
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
      alert("物品名称不能为空");
      return;
    }
    if (!effects.trim()) {
      alert("核心功能与异能机理不能为空");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateItem({
          id: editingItem.id,
          name: name.trim(),
          category,
          tier,
          appearance,
          effects: effects.trim(),
          drawbacks,
          currentHolder,
          history,
          description,
        });
      } else {
        await createItem({
          workId: Number(workId),
          name: name.trim(),
          category,
          tier,
          appearance,
          effects: effects.trim(),
          drawbacks,
          currentHolder,
          history,
          description,
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
    if (confirm("确定要删除该物品吗？")) {
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

    const matchCat = categoryFilter === "all" || item.category === categoryFilter;

    return matchSearch && matchCat;
  });

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={20} gap={12} wrap="wrap">
        <Flex gap={12} align="center" style={{ flex: 1, maxWidth: 500 }}>
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
        </Flex>

        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
          新建物品道具
        </Button>
      </Flex>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiBox size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无物品道具数据</Text>
            <Text fz={13}>点击右上角「新建物品道具」设定神兵、法宝与奇物</Text>
          </Flex>
        ) : (
          <div className={styles.cardGrid}>
            {filteredList.map((item) => (
              <div key={item.id} className={styles.entityCard}>
                <Flex justify="space-between" align="flex-start" mb={8}>
                  <Flex align="center" gap={8}>
                    <FiBox size={18} color="#00c9ff" />
                    <Text fz={17} fw={700} c="#1e293b">
                      {item.name}
                    </Text>
                  </Flex>
                  <Badge color="cyan" variant="light">
                    {item.tier || "极品"}
                  </Badge>
                </Flex>

                {item.currentHolder && (
                  <Flex align="center" gap={6} fz={12} c="#64748b" mb={8}>
                    <FiUser size={13} />
                    <span>当前持有者：<b>{item.currentHolder}</b></span>
                  </Flex>
                )}

                <Box mb={8} p="8px 12px" bg="#f0fdf4" style={{ borderRadius: 8, border: "1px solid #bbf7d0" }}>
                  <Flex align="center" gap={4} c="#166534" fz={11} fw={700} mb={2}>
                    <FiZap size={12} />
                    <span>核心异能机理</span>
                  </Flex>
                  <Text fz={12} c="#14532d" lineClamp={2} style={{ lineHeight: 1.5 }}>
                    {item.effects}
                  </Text>
                </Box>

                {item.drawbacks && (
                  <Box mb={8} p="8px 12px" bg="#fff1f2" style={{ borderRadius: 8, border: "1px solid #fecdd3" }}>
                    <Flex align="center" gap={4} c="#991b1b" fz={11} fw={700} mb={2}>
                      <FiAlertTriangle size={12} />
                      <span>代价与负面限制</span>
                    </Flex>
                    <Text fz={12} c="#7f1d1d" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.drawbacks}
                    </Text>
                  </Box>
                )}

                <Flex justify="flex-end" gap={6} mt="auto" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => handleOpenEdit(item)}>
                    <FiEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Flex>
              </div>
            ))}
          </div>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑物品 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiBox color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑物品 - ${editingItem.name}` : "新建物品 / 神兵法宝设定"}
            </Text>
          </Flex>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="16px">
          <SimpleGrid cols={3}>
            <TextInput
              label="物品名称"
              placeholder="例如：斩龙古剑 / 涅槃造化丹"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              label="物品类别"
              value={category}
              onChange={(val) => setCategory(val || "weapon")}
              data={[
                { value: "weapon", label: "⚔️ 神兵武器 / 战刃" },
                { value: "treasure", label: "🔮 法宝圣物 / 护身符" },
                { value: "consumable", label: "💊 灵丹妙药 / 消耗道具" },
                { value: "tech", label: "⚙️ 科技装置 / 概念武装" },
                { value: "forbidden", label: "💀 禁忌邪物 / 诅咒道具" },
                { value: "token", label: "🗝️ 关键信物 / 钥匙碎片" },
              ]}
            />
            <TextInput
              label="品阶 / 稀有度"
              placeholder="例如：天阶极品 / 史诗级 / 奇点概念"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            />
          </SimpleGrid>

          <TextInput
            label="当前持有角色 / 归属人物"
            placeholder="例如：主角 林肆"
            value={currentHolder}
            onChange={(e) => setCurrentHolder(e.target.value)}
          />

          <SimpleGrid cols={2}>
            <Textarea
              label="核心异能 / 发动效果机理"
              placeholder="例如：引动九天雷劫，对邪祟目标造成十倍真实破甲伤害..."
              value={effects}
              onChange={(e) => setEffects(e.target.value)}
              minRows={3}
              required
            />
            <Textarea
              label="代价、副作用与使用限制 (*防网文战力崩溃的关键)"
              placeholder="例如：每次拔剑需消耗三年寿元；冷却十二个时辰；唯有纯阳体质方可握持..."
              value={drawbacks}
              onChange={(e) => setDrawbacks(e.target.value)}
              minRows={3}
            />
          </SimpleGrid>

          <Textarea
            label="外形外观与材质描写"
            placeholder="例如：剑身通体玄黑，铭刻上古雷纹，寒芒流转..."
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="流传历史与争夺渊源 (选填)"
            placeholder="记录该物品的铸造者、历史持有者与涉及的古老传说..."
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            minRows={2}
          />

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建物品"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
