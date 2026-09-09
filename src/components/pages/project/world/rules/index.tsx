// 组件：世界规则与设定管理（表格视图，核心突出规则内容机制，关联角色与阵营）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, Paper, Group, Table } from "@mantine/core";
import { FiPlus, FiEdit2, FiTrash2, FiBookOpen, FiSearch, FiUser, FiShield, FiSliders } from "react-icons/fi";
import { WorldRuleItem, getWorldRuleList, createWorldRule, updateWorldRule, deleteWorldRule, getCharacterList, CharacterItem, getFactionList, FactionItem } from "@/rest/world";

interface RulesTabProps {
  workId: string;
}

export default function RulesTab({ workId }: RulesTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<WorldRuleItem[]>([]);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [factions, setFactions] = useState<FactionItem[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<WorldRuleItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [name, setName] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [factionName, setFactionName] = useState("");
  const [description, setDescription] = useState("");

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
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: WorldRuleItem) => {
    setEditingItem(item);
    setName(item.name || "");
    const charVal = item.characters || (item.extra?.characters as string) || "";
    const facVal = item.factions || (item.extra?.factions as string) || "";
    setCharacterName(charVal);
    setFactionName(facVal);
    setDescription(item.description || item.mechanisms || "");
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("请输入规则名称");
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: name.trim(),
        characters: characterName.trim() || undefined,
        factions: factionName.trim() || undefined,
        description: description.trim() || undefined,
        mechanisms: description.trim() || undefined,
      };

      if (editingItem) {
        await updateWorldRule({ id: editingItem.id, ...payload });
      } else {
        await createWorldRule({ workId: Number(workId), ...payload });
      }

      setModalOpened(false);
      await fetchData();
    } catch (e: any) {
      alert("保存规则失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该规则设定吗？此操作不可撤销。")) {
      try {
        await deleteWorldRule(id);
        setList((prev) => prev.filter((item) => item.id !== id));
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
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

  const formatTime = (time?: string | number) => {
    if (!time) return "—";
    try {
      return new Date(time).toLocaleDateString();
    } catch (_) {
      return "—";
    }
  };

  return (
    <Box pos="relative" >
      <LoadingOverlay visible={loading} />

      <Flex justify="space-between" align="center" mb="md" gap="sm">
        <TextInput
          placeholder="搜索规则设定名称、机制内容、角色或阵营..."
          size="xs"
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 320 }}
        />

        <Button size="xs" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新增世界规则
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading ? (
        <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8" bg="#ffffff">
          <FiBookOpen size={36} strokeWidth={1.2} style={{ marginBottom: 8 }} />
          <Text fz={13}>暂无匹配的世界规则设定，点击右上角「新增世界规则」开始添加</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="sm" bg="#ffffff" style={{ overflow: "hidden", borderColor: "#e2e8f0" }}>
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover striped>
            <Table.Thead bg="#f8fafc">
              <Table.Tr>
                <Table.Th style={{ width: "20%", minWidth: 160, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  规则名称
                </Table.Th>
                <Table.Th style={{ width: "42%", minWidth: 260, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  规则内容
                </Table.Th>
                <Table.Th style={{ width: "14%", minWidth: 110, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  关联角色
                </Table.Th>
                <Table.Th style={{ width: "14%", minWidth: 110, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  关联阵营
                </Table.Th>
                <Table.Th style={{ width: "10%", minWidth: 90, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  操作
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredList.map((item) => {
                const charVal = item.characters || (item.extra?.characters as string);
                const facVal = item.factions || (item.extra?.factions as string);
                const descText = item.description || item.mechanisms || "暂无机制描述";

                return (
                  <Table.Tr key={item.id} style={{ transition: "background-color 0.15s ease" }}>
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FiSliders size={13} color="#0284c7" />
                        </Box>
                        <Text fz={13.5} fw={700} c="#0f172a" style={{ wordBreak: "break-word" }}>
                          {item.name}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}>
                        {descText}
                      </Text>
                    </Table.Td>

                    <Table.Td>
                      {charVal ? (
                        <Badge size="sm" variant="light" leftSection={<FiUser size={10} />} styles={{ root: { maxWidth: 120 } }}>
                          {charVal}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">全局适用</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {facVal ? (
                        <Badge size="sm" variant="light" color="indigo" leftSection={<FiShield size={10} />} styles={{ root: { maxWidth: 120 } }}>
                          {facVal}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">全阵营通用</Text>
                      )}
                    </Table.Td>

                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" onClick={() => handleOpenEdit(item)} title="编辑规则">
                          <FiEdit2 size={13} />
                        </ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => handleDelete(item.id, e)} title="删除规则">
                          <FiTrash2 size={13} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* 新建/编辑规则弹窗 - 70vw 宽屏大文本编译器 */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap={8}>
            <FiSliders size={16} color="#0284c7" />
            <Text fw={700} fz={16} c="#0f172a">
              {editingItem ? "编辑世界规则与运转体系" : "新建世界规则与运转体系"}
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
            label="规则/体系名称"
            placeholder="例如：大陆通用货币与汇率体系 / 天地灵气与九品仙道修炼法则"
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

          <Box>
            <Flex justify="space-between" align="center" mb={6}>
              <Text fz={13} fw={600} c="#334155">
                核心规则内容、法则机制与数据表格 (支持 Markdown)
              </Text>
              <Group gap={6}>
                <Text fz={11} c="#94a3b8">快捷模版：</Text>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  onClick={() => {
                    const tableTemplate = `\n| 货币名称 | 换算比例 | 购买力参考 |\n| :--- | :--- | :--- |\n| 铜钱 (文) | 1 铜钱 | 1个大烧饼 / 粗茶一壶 |\n| 白银 (两) | 1两 = 1,000 铜钱 | 寻常三口之家一月用度 |\n| 黄金 (两) | 1两 = 10 两白银 | 京城上好绸缎一匹 / 凡品战刀 |\n| 灵石 (初品) | 1枚 = 100 两黄金 | 炼气期修士修炼基础资源 |\n`;
                    setDescription((prev) => prev ? prev + "\n" + tableTemplate : tableTemplate);
                  }}
                >
                  + 货币汇率表
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  onClick={() => {
                    const levelTemplate = `\n| 阶位等级 | 寿元上限 | 核心能力特征 | 突破瓶颈/代价 |\n| :--- | :--- | :--- | :--- |\n| 一阶 · 炼体期 | 百年 | 肉身坚如磐石，千斤巨力 | 需经脉筑基丹破关 |\n| 二阶 · 筑基期 | 二百年 | 气海化液，可御空滑翔 | 遭遇心魔反噬风险 |\n| 三阶 · 金丹期 | 五百年 | 丹碎成婴，引天地雷劫 | 需渡九重天雷劫 |\n`;
                    setDescription((prev) => prev ? prev + "\n" + levelTemplate : levelTemplate);
                  }}
                >
                  + 境界阶梯表
                </Button>
                <Button
                  size="compact-xs"
                  variant="light"
                  color="gray"
                  onClick={() => {
                    const genericTable = `\n| 条目/类别 | 规则约束 | 触发条件 | 代价与后果 |\n| :--- | :--- | :--- | :--- |\n| 禁忌条款一 | 不可逆向施法 | 强行催动禁术 | 寿元折损三成 |\n`;
                    setDescription((prev) => prev ? prev + "\n" + genericTable : genericTable);
                  }}
                >
                  + 通用规则表
                </Button>
              </Group>
            </Flex>

            <Textarea
              placeholder="详细描述该体系或法则的底层运转机理、约束条件、触发机制、代价反噬或禁忌，可直接使用 Markdown 插入各类表格..."
              size="sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minRows={14}
              autosize
              styles={{
                input: {
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "13px",
                  lineHeight: 1.6,
                },
              }}
              required
            />
          </Box>

          <Flex
            justify="space-between"
            align="center"
            mt="sm"
            pt={12}
            style={{
              borderTop: "1px solid #f1f5f9",
              position: "sticky",
              bottom: -20,
              backgroundColor: "#ffffff",
              zIndex: 10,
              paddingBottom: 4,
            }}
          >
            <Text fz={12} c="#94a3b8">
              💡 提示：在此处编写的表格与规则在 AI 协同创作中会自动进行摘要注入，完全不会过度消耗算力。
            </Text>
            <Group gap="xs">
              <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
                取消
              </Button>
              <Button size="xs" color="cyan" loading={formLoading} onClick={handleSave}>
                保存规则
              </Button>
            </Group>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
