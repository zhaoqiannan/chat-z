// 组件：物品与道具法宝设定管理（表格视图，直观展示品阶、持有者、所属阵营与效果描述）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, Paper, Group, Table } from "@mantine/core";
import { FiPlus, FiEdit2, FiTrash2, FiBox, FiSearch, FiUser, FiShield, FiPackage } from "react-icons/fi";
import { ItemData, getItemList, createItem, updateItem, deleteItem, getCharacterList, CharacterItem, getFactionList, FactionItem } from "@/rest/world";
import NameGeneratorModal from "@/components/common/name-generator";

interface ItemsTabProps {
  workId: string;
}

export default function ItemsTab({ workId }: ItemsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ItemData[]>([]);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [factions, setFactions] = useState<FactionItem[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemData | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [nameGenOpened, setNameGenOpened] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [faction, setFaction] = useState("");
  const [description, setDescription] = useState("");

  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const [itemRes, charRes, facRes] = await Promise.all([
        getItemList(workId),
        getCharacterList(workId),
        getFactionList(workId),
      ]);

      if (itemRes && itemRes.success && Array.isArray(itemRes.result)) {
        setList(itemRes.result);
      }
      if (charRes && charRes.success && Array.isArray(charRes.result)) {
        setCharacters(charRes.result);
      }
      if (facRes && facRes.success && Array.isArray(facRes.result)) {
        setFactions(facRes.result);
      }
    } catch (e) {
      console.error("获取物品列表失败:", e);
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
    setOwnerId(null);
    setOwnerName("");
    setFaction("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: ItemData) => {
    setEditingItem(item);
    setName(item.name || "");
    setCategory(item.category || item.tier || "");
    setOwnerId(item.ownerId ? String(item.ownerId) : null);
    setOwnerName(item.ownerName || item.currentHolder || "");
    setFaction(item.faction || (item.extra?.faction as string) || "");
    setDescription(item.description || item.effects || "");
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("请输入物品名称");
      return;
    }

    try {
      setFormLoading(true);
      const selectedChar = characters.find((c) => String(c.id) === ownerId);
      const finalOwner = selectedChar ? selectedChar.name : ownerName.trim();

      const payload = {
        name: name.trim(),
        category: category.trim() || undefined,
        tier: category.trim() || undefined,
        ownerId: ownerId ? Number(ownerId) : undefined,
        ownerName: finalOwner || undefined,
        currentHolder: finalOwner || undefined,
        faction: faction.trim() || undefined,
        description: description.trim() || undefined,
        effects: description.trim() || undefined,
      };

      if (editingItem) {
        await updateItem({ id: editingItem.id, ...payload });
      } else {
        await createItem({ workId: Number(workId), ...payload });
      }

      setModalOpened(false);
      await fetchData();
    } catch (e: any) {
      alert("保存物品失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该物品道具吗？此操作不可撤销。")) {
      try {
        await deleteItem(id);
        setList((prev) => prev.filter((item) => item.id !== id));
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const filteredList = list.filter((item) => {
    if (!searchKey) return true;
    const q = searchKey.toLowerCase();
    const itemFaction = item.faction || (item.extra?.faction as string) || "";
    return (
      item.name.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.tier && item.tier.toLowerCase().includes(q)) ||
      (item.ownerName && item.ownerName.toLowerCase().includes(q)) ||
      (itemFaction && itemFaction.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.effects && item.effects.toLowerCase().includes(q))
    );
  });

  const charSelectData = [
    { value: "", label: "暂无归属角色 (无主之物)" },
    ...characters.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const factionSelectData = [
    { value: "", label: "暂无关联阵营" },
    ...factions.map((f) => ({ value: f.name, label: f.name })),
  ];

  return (
    <Box pos="relative" style={{ minHeight: 400 }}>
      <LoadingOverlay visible={loading} />

      <Flex justify="space-between" align="center" mb="md" gap="sm">
        <TextInput
          placeholder="搜索物品名称、品阶、持有者、阵营或效果..."
          size="xs"
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 320 }}
        />

        <Button size="xs" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新增物品道具
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading ? (
        <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8" bg="#ffffff">
          <FiBox size={36} strokeWidth={1.2} style={{ marginBottom: 8 }} />
          <Text fz={13}>暂无物品道具，点击右上角「新增物品道具」开始添加</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="sm" bg="#ffffff" style={{ overflow: "hidden", borderColor: "#e2e8f0" }}>
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover striped>
            <Table.Thead bg="#f8fafc">
              <Table.Tr>
                <Table.Th style={{ width: "20%", minWidth: 160, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  物品道具名称
                </Table.Th>
                <Table.Th style={{ width: "12%", minWidth: 100, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  品阶 / 类型
                </Table.Th>
                <Table.Th style={{ width: "15%", minWidth: 110, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  持有者 / 归属
                </Table.Th>
                <Table.Th style={{ width: "15%", minWidth: 110, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  所属阵营
                </Table.Th>
                <Table.Th style={{ width: "28%", minWidth: 200, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  效果机制与背景描述
                </Table.Th>
                <Table.Th style={{ width: "10%", minWidth: 90, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  操作
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredList.map((item) => {
                const ownerDisplay = item.ownerName || item.currentHolder;
                const factionDisplay = item.faction || (item.extra?.faction as string);
                const categoryDisplay = item.category || item.tier;
                const descText = item.description || item.effects || "暂无效果描述";

                return (
                  <Table.Tr key={item.id} style={{ transition: "background-color 0.15s ease" }}>
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FiPackage size={13} color="#0284c7" />
                        </Box>
                        <Text fz={13.5} fw={700} c="#0f172a" style={{ wordBreak: "break-word" }}>
                          {item.name}
                        </Text>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      {categoryDisplay ? (
                        <Badge size="sm" variant="light" >
                          {categoryDisplay}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">—</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {ownerDisplay ? (
                        <Badge size="sm" variant="outline" color="blue" leftSection={<FiUser size={10} />} styles={{ root: { maxWidth: 130 } }}>
                          {ownerDisplay}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">无主之物</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {factionDisplay ? (
                        <Badge size="sm" variant="outline" color="indigo" leftSection={<FiShield size={10} />} styles={{ root: { maxWidth: 130 } }}>
                          {factionDisplay}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">中立通用</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 90, overflowY: "auto" }}>
                        {descText}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" onClick={() => handleOpenEdit(item)} title="编辑物品">
                          <FiEdit2 size={13} />
                        </ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => handleDelete(item.id, e)} title="删除物品">
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

      {/* 新建/编辑弹窗 */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={700} fz={15} c="#0f172a">{editingItem ? "编辑物品道具" : "新建物品道具"}</Text>}
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
              label="物品名称"
              placeholder="例如：斩龙剑、九转还魂丹"
              size="xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              rightSection={
                <Button
                  size="compact-xs"
                  variant="subtle"

                  onClick={() => setNameGenOpened(true)}
                  style={{ fontSize: 10, height: 20 }}
                >
                  取名
                </Button>
              }
            />
            <TextInput
              label="品阶 / 分类"
              placeholder="例如：极品灵宝、神阶法宝、疗伤圣药"
              size="xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="持有者 (角色)"
              placeholder="选择归属角色"
              size="xs"
              value={ownerId}
              onChange={(val) => setOwnerId(val)}
              data={charSelectData}
              clearable
              searchable
            />
            <Select
              label="关联阵营"
              placeholder="选择归属阵营"
              size="xs"
              value={faction}
              onChange={(val) => setFaction(val || "")}
              data={factionSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          <Textarea
            label="效果机制与背景描述"
            placeholder="详细描述物品的异能特效、使用限制、反噬代价、来历背景..."
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
            <Button size="xs" loading={formLoading} onClick={handleSave}>
              保存物品
            </Button>
          </Flex>
        </Stack>
      </Modal>

      <NameGeneratorModal
        opened={nameGenOpened}
        onClose={() => setNameGenOpened(false)}
        type="item"
        onSelectName={(genName) => setName(genName)}
      />
    </Box>
  );
}
