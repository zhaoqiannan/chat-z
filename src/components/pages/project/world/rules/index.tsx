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

      {/* 新建/编辑规则弹窗 */}
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
        <Stack gap="sm">
          <TextInput
            label="规则名称"
            placeholder="请输入"
            size="xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="关联角色 (选填)"
              placeholder="选择生效专属角色"
              size="xs"
              value={characterName}
              onChange={(val) => setCharacterName(val || "")}
              data={charSelectData}
              clearable
              searchable
            />
            <Select
              label="关联阵营 (选填)"
              placeholder="选择生效所属阵营"
              size="xs"
              value={factionName}
              onChange={(val) => setFactionName(val || "")}
              data={factionSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          <Textarea
            label="核心规则内容与运转机制"
            placeholder="详细描述该体系或法则的底层运转机理、约束条件、触发机制、代价反噬或禁忌..."
            size="xs"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={7}
            autosize
            required
          />

          <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -12, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
            <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button size="xs" loading={formLoading} onClick={handleSave}>
              保存规则
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
