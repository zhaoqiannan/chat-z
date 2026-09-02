// 组件：世界规则与设定管理（自由文本类型/领域、关联角色与关联阵营下拉选择、极简线条卡片流）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, Paper, Group, Card } from "@mantine/core";
import { FiPlus, FiEdit2, FiTrash2, FiBookOpen, FiSearch, FiUser, FiShield } from "react-icons/fi";
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
  const [category, setCategory] = useState("");
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
      console.error(e);
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
    setCategory("");
    setCharacterName("");
    setFactionName("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: WorldRuleItem) => {
    setEditingItem(item);
    setName(item.name || "");
    setCategory(item.category || "");
    const charVal = item.characters || (item.extra?.characters as string) || "";
    const facVal = item.factions || (item.extra?.factions as string) || "";
    setCharacterName(charVal);
    setFactionName(facVal);
    setDescription(item.description || item.mechanisms || "");
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("请输入规则/设定名称");
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: name.trim(),
        category: category.trim() || undefined,
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
    if (confirm("确定要删除该规则设定吗？")) {
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
      (item.category && item.category.toLowerCase().includes(q)) ||
      (charVal && charVal.toLowerCase().includes(q)) ||
      (facVal && facVal.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.mechanisms && item.mechanisms.toLowerCase().includes(q))
    );
  });

  const charSelectData = [
    { value: "", label: "暂无关联角色" },
    ...characters.map((c) => ({ value: c.name, label: c.name })),
  ];

  const factionSelectData = [
    { value: "", label: "暂无关联阵营" },
    ...factions.map((f) => ({ value: f.name, label: f.name })),
  ];

  return (
    <Box p="md" pos="relative" style={{ minHeight: 400 }}>
      <LoadingOverlay visible={loading} />

      <Flex justify="space-between" align="center" mb="md" gap="sm">
        <TextInput
          placeholder="请输入关键词搜索规则设定..."
          size="xs"
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 260 }}
        />

        <Button size="xs" color="cyan" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新增世界规则
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading && (
        <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8">
          <FiBookOpen size={36} strokeWidth={1.2} style={{ marginBottom: 8 }} />
          <Text fz={13}>暂无世界规则设定，点击右上角「新增世界规则」开始添加</Text>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {filteredList.map((item) => {
          const charVal = item.characters || (item.extra?.characters as string);
          const facVal = item.factions || (item.extra?.factions as string);

          return (
            <Card
              key={item.id}
              p="12px 14px"
              radius="sm"
              withBorder
              bg="#ffffff"
              style={{
                borderColor: "#f1f5f9",
                display: "flex",
                flexDirection: "column",
                height: 140,
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Flex justify="space-between" align="flex-start" mb={4}>
                  <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                    <Text fz={14} fw={700} c="#0f172a" truncate="end">
                      {item.name}
                    </Text>
                    {item.category && (
                      <Badge size="xs" color="indigo" variant="light">
                        {item.category}
                      </Badge>
                    )}
                  </Group>
                  <Group gap={2}>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => handleOpenEdit(item)}>
                      <FiEdit2 size={12} />
                    </ActionIcon>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => handleDelete(item.id, e)}>
                      <FiTrash2 size={12} />
                    </ActionIcon>
                  </Group>
                </Flex>

                <Text fz={11.5} c="#334155" lineClamp={2} style={{ lineHeight: 1.5 }}>
                  {item.description || item.mechanisms || "暂无规则描述"}
                </Text>
              </Box>

              <Flex justify="space-between" align="center" pt={4} style={{ borderTop: "1px solid #f8fafc" }}>
                <Group gap={8} fz={11} c="#64748b">
                  {charVal && (
                    <Group gap={3}>
                      <FiUser size={10} color="#94a3b8" />
                      <Text fz={10.5}>{charVal}</Text>
                    </Group>
                  )}
                  {facVal && (
                    <Group gap={3}>
                      <FiShield size={10} color="#94a3b8" />
                      <Text fz={10.5}>{facVal}</Text>
                    </Group>
                  )}
                  {!charVal && !facVal && (
                    <Text fz={10.5} c="#94a3b8">全局生效</Text>
                  )}
                </Group>
              </Flex>
            </Card>
          );
        })}
      </SimpleGrid>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={700} fz={15} c="#0f172a">{editingItem ? "编辑世界规则" : "新建世界规则"}</Text>}
        size="md"
        centered
        radius="sm"
        styles={{
          content: { maxHeight: "88vh", display: "flex", flexDirection: "column" },
          header: { borderBottom: "1px solid #f1f5f9", padding: "12px 20px", flexShrink: 0 },
          body: { flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 20px 12px 20px" },
        }}
      >
        <Stack gap="xs">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <TextInput
              label="规则名称"
              placeholder="请输入"
              size="xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextInput
              label="领域分类"
              placeholder="请输入"
              size="xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="关联角色"
              placeholder="请输入或选择角色"
              size="xs"
              value={characterName}
              onChange={(val) => setCharacterName(val || "")}
              data={charSelectData}
              clearable
              searchable
            />
            <Select
              label="关联阵营"
              placeholder="请输入或选择阵营"
              size="xs"
              value={factionName}
              onChange={(val) => setFactionName(val || "")}
              data={factionSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          <Textarea
            label="规则描述"
            placeholder="请输入"
            size="xs"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={5}
            autosize
          />

          <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -12, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
            <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" size="xs" loading={formLoading} onClick={handleSave}>
              保存规则
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
