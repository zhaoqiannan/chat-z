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
  Divider,
  Group,
  Card,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiZap,
  FiAlertOctagon,
  FiLayers,
  FiSearch,
} from "react-icons/fi";
import {
  WorldRuleItem,
  LevelTreeNode,
  getWorldRuleList,
  createWorldRule,
  updateWorldRule,
  deleteWorldRule,
} from "@/rest/world";

interface RulesTabProps {
  workId: string;
}

export default function RulesTab({ workId }: RulesTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<WorldRuleItem[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<WorldRuleItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [category, setCategory] = useState("power_system");
  const [mechanisms, setMechanisms] = useState("");
  const [taboos, setTaboos] = useState("");
  const [description, setDescription] = useState("");

  // 境界阶梯列表
  const [levelSteps, setLevelSteps] = useState<LevelTreeNode[]>([
    { order: 1, name: "练气期", lifespan: "120年", breakthrough: "引气入体，打通任督二脉", powers: "五行初级法术" },
    { order: 2, name: "筑基期", lifespan: "250年", breakthrough: "灵气化液，筑造道基", powers: "御剑飞行，神识外放" },
    { order: 3, name: "金丹期", lifespan: "500年", breakthrough: "凝练九品金丹，渡三九雷劫", powers: "掌控本命法宝，法相初显" },
  ]);

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getWorldRuleList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取规则列表失败:", e);
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
    setCategory("power_system");
    setMechanisms("");
    setTaboos("");
    setDescription("");
    setLevelSteps([
      { order: 1, name: "第一阶", lifespan: "常规", breakthrough: "突破条件", powers: "标志性战力" },
      { order: 2, name: "第二阶", lifespan: "翻倍", breakthrough: "质变契机", powers: "神通觉醒" },
    ]);
    setModalOpened(true);
  };

  const handleOpenEdit = (item: WorldRuleItem) => {
    setEditingItem(item);
    setName(item.name || "");
    setCategory(item.category || "power_system");
    setMechanisms(item.mechanisms || "");
    setTaboos(item.taboos || "");
    setDescription(item.description || "");
    setLevelSteps(
      Array.isArray(item.levelTree) && item.levelTree.length > 0
        ? item.levelTree
        : [{ order: 1, name: "初级", lifespan: "", breakthrough: "", powers: "" }]
    );
    setModalOpened(true);
  };

  const handleAddStep = () => {
    setLevelSteps((prev) => [
      ...prev,
      { order: prev.length + 1, name: `第${prev.length + 1}阶段`, lifespan: "", breakthrough: "", powers: "" },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setLevelSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, key: keyof LevelTreeNode, val: string | number) => {
    setLevelSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入规则体系名称！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateWorldRule({
          id: editingItem.id,
          name: name.trim(),
          category,
          mechanisms: mechanisms.trim() || undefined,
          taboos: taboos.trim() || undefined,
          levelTree: category === "power_system" ? levelSteps : undefined,
          description: description.trim() || undefined,
        });
      } else {
        await createWorldRule({
          workId: Number(workId),
          name: name.trim(),
          category,
          mechanisms: mechanisms.trim() || undefined,
          taboos: taboos.trim() || undefined,
          levelTree: category === "power_system" ? levelSteps : undefined,
          description: description.trim() || undefined,
        });
      }
      setModalOpened(false);
      await fetchList();
    } catch (e: any) {
      alert("保存规则失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("确定要删除该规则体系吗？此操作不可撤销。")) {
      const res = await deleteWorldRule(id);
      if (res && res.success) {
        await fetchList();
      }
    }
  };

  const filteredList = list.filter((item) => {
    return (
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.mechanisms && item.mechanisms.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.taboos && item.taboos.toLowerCase().includes(searchKey.toLowerCase()))
    );
  });

  return (
    <Box>
      <Group justify="space-between" align="center" mb="lg" wrap="wrap">
        <TextInput
          placeholder="搜索法则体系名称、运转机制或禁忌..."
          leftSection={<FiSearch size={14} />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 360 }}
        />
        <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreate}>
          新建规则体系
        </Button>
      </Group>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
            <FiLayers size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无规则与力量体系</Text>
            <Text fz={13}>点击右上角「新建规则体系」构建修炼境界、物理魔法规律与世界禁忌</Text>
          </Stack>
        ) : (
          <Stack gap="lg">
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
                <Group justify="space-between" align="center" mb="sm">
                  <Group gap="xs" align="center">
                    <FiLayers size={20} color="#06b6d4" />
                    <Text fz={18} fw={700} c="dark.7">
                      {item.name}
                    </Text>
                  </Group>

                  <Group gap="xs" align="center">
                    <Badge color="cyan" variant="light" size="sm">
                      {item.category === "power_system" ? "⚡ 力量/境界体系" : item.category === "taboo" ? "💀 世界禁忌" : "📜 法则公约"}
                    </Badge>
                    <ActionIcon variant="subtle" color="cyan" size="sm" onClick={() => handleOpenEdit(item)}>
                      <FiEdit size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}>
                      <FiTrash2 size={14} />
                    </ActionIcon>
                  </Group>
                </Group>

                {/* 境界阶梯序列 */}
                {Array.isArray(item.levelTree) && item.levelTree.length > 0 && (
                  <Box mb="sm">
                    <Text fz={13} fw={700} c="dark.5" mb="xs">
                      🪜 境界突破阶梯序列：
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
                      {item.levelTree.map((step, idx) => (
                        <Paper
                          key={idx}
                          p="xs"
                          withBorder
                          bg="gray.0"
                          radius="sm"
                          style={{ borderColor: "var(--mantine-color-gray-3)" }}
                        >
                          <Group justify="space-between" align="center" mb={4}>
                            <Text fz={14} fw={700} c="cyan.8">
                              {step.order ? `${step.order}. ` : ""}{step.name}
                            </Text>
                            {step.lifespan && <Badge size="xs" color="gray" variant="light">寿元: {step.lifespan}</Badge>}
                          </Group>
                          {step.breakthrough && (
                            <Text fz={12} c="dimmed" mb={2} lineClamp={1}>
                              🔑 突破：{step.breakthrough}
                            </Text>
                          )}
                          {step.powers && (
                            <Text fz={12} c="teal.8" lineClamp={1}>
                              ✨ 神通：{step.powers}
                            </Text>
                          )}
                        </Paper>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {item.mechanisms && (
                  <Paper mb="xs" p="xs" bg="gray.0" radius="sm">
                    <Text fz={11} fw={700} c="dimmed" mb={2}>底层运转机制</Text>
                    <Text fz={12} c="dark.6" style={{ lineHeight: 1.5 }}>
                      {item.mechanisms}
                    </Text>
                  </Paper>
                )}

                {item.taboos && (
                  <Paper p="xs" bg="red.0" radius="sm" style={{ border: "1px solid var(--mantine-color-red-2)" }}>
                    <Group gap={4} c="red.9" fz={11} fw={700} mb={2}>
                      <FiAlertOctagon size={12} />
                      <Text fz={11} fw={700}>天道禁忌与走火入魔风险</Text>
                    </Group>
                    <Text fz={12} c="red.9" style={{ lineHeight: 1.5 }}>
                      {item.taboos}
                    </Text>
                  </Paper>
                )}
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑规则 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiLayers color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑法则体系 - ${editingItem.name}` : "新建世界法则与境界体系"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="体系 / 法则名称"
              placeholder="例如：传统仙道修真境界 / 纳米基因觉醒序列"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Select
              label="规则分类"
              value={category}
              onChange={(val) => setCategory(val || "power_system")}
              data={[
                { value: "power_system", label: "⚡ 修炼 / 战力境界体系" },
                { value: "physics_magic", label: "🔮 物理 / 魔法运行规律" },
                { value: "society_law", label: "📜 社会律法 / 契约公约" },
                { value: "taboo", label: "💀 世界天道禁忌 / 因果律" },
              ]}
            />
          </SimpleGrid>

          {/* 境界阶梯阶梯编辑器 */}
          {category === "power_system" && (
            <Paper p="md" withBorder bg="gray.0" radius="md">
              <Group justify="space-between" align="center" mb="xs">
                <Text fz={13} fw={700} c="dark.7">
                  🪜 境界递进阶梯配置（自低向高排序）
                </Text>
                <Button size="xs" variant="light" color="cyan" leftSection={<FiPlus size={12} />} onClick={handleAddStep}>
                  添加下一阶段境界
                </Button>
              </Group>

              <Stack gap="xs">
                {levelSteps.map((step, idx) => (
                  <Paper key={idx} p="xs" withBorder bg="#ffffff" radius="sm">
                    <Group gap="xs" align="center" wrap="nowrap">
                      <Badge circle size="md" color="cyan">{idx + 1}</Badge>
                      <TextInput
                        placeholder="境界名 (如: 金丹期)"
                        value={step.name}
                        onChange={(e) => handleStepChange(idx, "name", e.target.value)}
                        style={{ width: 130 }}
                        size="xs"
                      />
                      <TextInput
                        placeholder="寿元极限 (如: 500年)"
                        value={step.lifespan || ""}
                        onChange={(e) => handleStepChange(idx, "lifespan", e.target.value)}
                        style={{ width: 120 }}
                        size="xs"
                      />
                      <TextInput
                        placeholder="突破条件/契机"
                        value={step.breakthrough || ""}
                        onChange={(e) => handleStepChange(idx, "breakthrough", e.target.value)}
                        style={{ flex: 1 }}
                        size="xs"
                      />
                      <TextInput
                        placeholder="标志神通/威能"
                        value={step.powers || ""}
                        onChange={(e) => handleStepChange(idx, "powers", e.target.value)}
                        style={{ flex: 1 }}
                        size="xs"
                      />
                      <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleRemoveStep(idx)}>
                        <FiTrash2 size={13} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}

          <Textarea
            label="底层运转机理 / 能量循环本质"
            placeholder="例如：万物皆有灵性，通过吸纳天地灵气淬炼神魂肉体，暗合天道运转..."
            value={mechanisms}
            onChange={(e) => setMechanisms(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="违背代价 / 禁忌戒律 / 天谴劫难 (选填)"
            placeholder="例如：强行催动超阶功法会导致经脉尽碎；杀戮过重将遭遇九九灭世雷劫..."
            value={taboos}
            onChange={(e) => setTaboos(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="详细设定备忘与补充 (选填)"
            placeholder="记录关于该法则体系的其他渊源与思考..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={2}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建规则"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
