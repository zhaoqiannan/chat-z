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
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiBookOpen,
  FiSearch,
  FiZap,
  FiAlertOctagon,
  FiLayers,
} from "react-icons/fi";
import {
  WorldRuleItem,
  LevelTreeNode,
  getWorldRuleList,
  createWorldRule,
  updateWorldRule,
  deleteWorldRule,
} from "@/rest/world";
import styles from "../style.module.scss";

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
        : [{ order: 1, name: "第一阶" }]
    );
    setModalOpened(true);
  };

  const handleAddStep = () => {
    setLevelSteps([
      ...levelSteps,
      {
        order: levelSteps.length + 1,
        name: `第 ${levelSteps.length + 1} 境`,
        lifespan: "",
        breakthrough: "",
        powers: "",
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    const updated = levelSteps.filter((_, i) => i !== index);
    setLevelSteps(updated);
  };

  const handleStepChange = (index: number, field: keyof LevelTreeNode, val: string) => {
    const updated = [...levelSteps];
    updated[index] = { ...updated[index], [field]: val };
    setLevelSteps(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("法则/体系名称不能为空");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateWorldRule({
          id: editingItem.id,
          name: name.trim(),
          category,
          levelTree: levelSteps,
          mechanisms,
          taboos,
          description,
        });
      } else {
        await createWorldRule({
          workId: Number(workId),
          name: name.trim(),
          category,
          levelTree: levelSteps,
          mechanisms,
          taboos,
          description,
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
    if (confirm("确定要删除该法则体系吗？")) {
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
      <Flex justify="space-between" align="center" mb={20} gap={12}>
        <TextInput
          placeholder="搜索法则体系名称、运转机制或禁忌..."
          leftSection={<FiSearch size={14} />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 360 }}
        />
        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
          新建规则体系
        </Button>
      </Flex>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiLayers size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无规则与力量体系</Text>
            <Text fz={13}>点击右上角「新建规则体系」构建修炼境界、物理魔法规律与世界禁忌</Text>
          </Flex>
        ) : (
          <Stack gap="20px">
            {filteredList.map((item) => (
              <div key={item.id} className={styles.entityCard}>
                <Flex justify="space-between" align="center" mb={12}>
                  <Flex align="center" gap={8}>
                    <FiLayers size={20} color="#00c9ff" />
                    <Text fz={18} fw={700} c="#1e293b">
                      {item.name}
                    </Text>
                  </Flex>

                  <Flex align="center" gap={8}>
                    <Badge color="cyan" variant="light">
                      {item.category === "power_system" ? "⚡ 力量/境界体系" : item.category === "taboo" ? "💀 世界禁忌" : "📜 法则公约"}
                    </Badge>
                    <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => handleOpenEdit(item)}>
                      <FiEdit size={14} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}>
                      <FiTrash2 size={14} />
                    </ActionIcon>
                  </Flex>
                </Flex>

                {/* 境界阶梯阶梯树 */}
                {Array.isArray(item.levelTree) && item.levelTree.length > 0 && (
                  <Box mb={14}>
                    <Text fz={13} fw={700} c="#475569" mb={8}>
                      🪜 境界突破阶梯序列：
                    </Text>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                      {item.levelTree.map((step, idx) => (
                        <div key={idx} className={styles.levelTreeStep}>
                          <Flex justify="space-between" align="center" mb={4}>
                            <Text fz={14} fw={700} c="#0284c7">
                              {step.order ? `${step.order}. ` : ""}{step.name}
                            </Text>
                            {step.lifespan && <Badge size="xs" color="gray" variant="light">寿命: {step.lifespan}</Badge>}
                          </Flex>
                          {step.breakthrough && (
                            <Text fz={12} c="#64748b" mb={2}>
                              🔑 突破契机：{step.breakthrough}
                            </Text>
                          )}
                          {step.powers && (
                            <Text fz={12} c="#059669">
                              ✨ 标志神通：{step.powers}
                            </Text>
                          )}
                        </div>
                      ))}
                    </div>
                  </Box>
                )}

                {item.mechanisms && (
                  <Box mb={8} p="8px 12px" bg="#f8fafc" style={{ borderRadius: 8 }}>
                    <Text fz={11} fw={700} c="#64748b" mb={2}>底层运转机制</Text>
                    <Text fz={12} c="#334155" style={{ lineHeight: 1.5 }}>
                      {item.mechanisms}
                    </Text>
                  </Box>
                )}

                {item.taboos && (
                  <Box p="8px 12px" bg="#fff1f2" style={{ borderRadius: 8, border: "1px solid #fecdd3" }}>
                    <Flex align="center" gap={4} c="#991b1b" fz={11} fw={700} mb={2}>
                      <FiAlertOctagon size={12} />
                      <span>天道禁忌与走火入魔风险</span>
                    </Flex>
                    <Text fz={12} c="#7f1d1d" style={{ lineHeight: 1.5 }}>
                      {item.taboos}
                    </Text>
                  </Box>
                )}
              </div>
            ))}
          </Stack>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑规则 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiLayers color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑法则体系 - ${editingItem.name}` : "新建世界法则与境界体系"}
            </Text>
          </Flex>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="16px">
          <SimpleGrid cols={2}>
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
          <Paper p="16px" withBorder bg="#f8fafc" radius="md">
            <Flex justify="space-between" align="center" mb={12}>
              <Text fz={14} fw={700} c="#1e293b">
                🪜 境界等级阶梯设计 (从低到高递进)
              </Text>
              <Button size="xs" variant="light" leftSection={<FiPlus size={12} />} onClick={handleAddStep}>
                添加下一阶境界
              </Button>
            </Flex>

            <Stack gap="10px">
              {levelSteps.map((step, idx) => (
                <Flex key={idx} gap={8} align="center">
                  <TextInput
                    placeholder="境界名 (如 练气期)"
                    value={step.name}
                    onChange={(e) => handleStepChange(idx, "name", e.target.value)}
                    style={{ width: 140 }}
                  />
                  <TextInput
                    placeholder="寿命 (如 120年)"
                    value={step.lifespan || ""}
                    onChange={(e) => handleStepChange(idx, "lifespan", e.target.value)}
                    style={{ width: 110 }}
                  />
                  <TextInput
                    placeholder="突破契机与瓶颈要求"
                    value={step.breakthrough || ""}
                    onChange={(e) => handleStepChange(idx, "breakthrough", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    placeholder="标志性战力/神通表现"
                    value={step.powers || ""}
                    onChange={(e) => handleStepChange(idx, "powers", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <ActionIcon color="red" variant="subtle" onClick={() => handleRemoveStep(idx)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Flex>
              ))}
            </Stack>
          </Paper>

          <Textarea
            label="底层运作机理与公式"
            placeholder="例如：灵气需经由十二正经炼化为真元；能量遵循热力学与因果律守恒..."
            value={mechanisms}
            onChange={(e) => setMechanisms(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="天道禁忌与走火入魔风险"
            placeholder="例如：强行吞服暴烈丹药将导致经脉尽断；不可向深渊呼唤旧日之名..."
            value={taboos}
            onChange={(e) => setTaboos(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="详细设定说明 (选填)"
            placeholder="补充关于该规则的细节与战力平衡备忘..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={2}
          />

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建法则"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
