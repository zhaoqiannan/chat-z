import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, Paper, Group, Card } from "@mantine/core";
import { FiPlus, FiEdit2, FiTrash2, FiBox, FiSearch, FiUser, FiShield, FiZap } from "react-icons/fi";
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
    setOwnerId(null);
    setOwnerName("");
    setFaction("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: ItemData) => {
    setEditingItem(item);
    setName(item.name || "");
    setCategory(item.category || "");
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
    if (confirm("确定要删除该物品道具吗？")) {
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
      (item.ownerName && item.ownerName.toLowerCase().includes(q)) ||
      (itemFaction && itemFaction.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.effects && item.effects.toLowerCase().includes(q))
    );
  });

  const charSelectData = [
    { value: "", label: "暂无归属角色" },
    ...characters.map((c) => ({ value: String(c.id), label: c.name })),
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
          placeholder="请输入关键词搜索物品..."
          size="xs"
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 260 }}
        />

        <Button size="xs" color="cyan" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新增物品道具
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading && (
        <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8">
          <FiBox size={36} strokeWidth={1.2} style={{ marginBottom: 8 }} />
          <Text fz={13}>暂无物品道具，点击右上角「新增物品道具」开始添加</Text>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {filteredList.map((item) => {
          const ownerDisplay = item.ownerName || item.currentHolder;
          const factionDisplay = item.faction || (item.extra?.faction as string);

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
                      <Badge size="xs" color="cyan" variant="light">
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
                  {item.description || item.effects || "暂无描述"}
                </Text>
              </Box>

              <Flex justify="space-between" align="center" pt={4} style={{ borderTop: "1px solid #f8fafc" }}>
                <Group gap={8} fz={11} c="#64748b">
                  {ownerDisplay && (
                    <Group gap={3}>
                      <FiUser size={10} color="#94a3b8" />
                      <Text fz={10.5}>{ownerDisplay}</Text>
                    </Group>
                  )}
                  {factionDisplay && (
                    <Group gap={3}>
                      <FiShield size={10} color="#94a3b8" />
                      <Text fz={10.5}>{factionDisplay}</Text>
                    </Group>
                  )}
                  {!ownerDisplay && !factionDisplay && (
                    <Text fz={10.5} c="#94a3b8">无归属绑定</Text>
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
            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fz={12} fw={500} c="#475569">物品名称 *</Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="cyan"
                  leftSection={<FiZap size={10} />}
                  onClick={() => setNameGenOpened(true)}
                  styles={{ root: { fontSize: 10, height: 18, padding: "0 4px" } }}
                >
                  智能起名
                </Button>
              </Flex>
              <TextInput
                placeholder="请输入"
                size="xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Box>
            <TextInput
              label="分类"
              placeholder="请输入"
              size="xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="所属角色"
              placeholder="请输入或选择角色"
              size="xs"
              value={ownerId || ""}
              onChange={(val) => {
                setOwnerId(val || null);
                const found = characters.find((c) => String(c.id) === val);
                if (found) setOwnerName(found.name);
              }}
              data={charSelectData}
              clearable
              searchable
            />
            <Select
              label="关联阵营"
              placeholder="请输入或选择阵营"
              size="xs"
              value={faction}
              onChange={(val) => setFaction(val || "")}
              data={factionSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          <Textarea
            label="物品效果"
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
              保存物品
            </Button>
          </Flex>
        </Stack>
      </Modal>

      <NameGeneratorModal
        opened={nameGenOpened}
        onClose={() => setNameGenOpened(false)}
        onSelectName={(val) => setName(val)}
        type="item"
      />
    </Box>
  );
}
