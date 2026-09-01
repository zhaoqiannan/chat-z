// 组件：角色档案库工作台（极简线条卡片流、置顶调度、独立详情与编辑弹窗、删除二次确认）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Select, TextInput, Stack, SimpleGrid, LoadingOverlay, Group, Modal } from "@mantine/core";
import { FiPlus, FiSearch, FiUser, FiAlertTriangle } from "react-icons/fi";
import { CharacterItem, getCharacterList, deleteCharacter, togglePinCharacter } from "@/rest/world";
import CharacterCard from "./character-card";
import ModalCharacterForm from "./modal-character-form";
import ModalCharacterDetail from "./modal-character-detail";

interface CharactersTabProps {
  workId: string;
}

export default function CharactersTab({ workId }: CharactersTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<CharacterItem[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [detailItem, setDetailItem] = useState<CharacterItem | null>(null);

  const [formModalOpened, setFormModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<CharacterItem | null>(null);

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CharacterItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getCharacterList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取角色列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormModalOpened(true);
  };

  const handleOpenEdit = (item: CharacterItem) => {
    setEditingItem(item);
    setFormModalOpened(true);
  };

  const handleOpenDetail = (item: CharacterItem) => {
    setDetailItem(item);
    setDetailModalOpened(true);
  };

  const handleTogglePin = async (item: CharacterItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPin = !item.isPinned;
    try {
      await togglePinCharacter(item.id, nextPin);
      setList((prev) =>
        prev
          .map((c) => (c.id === item.id ? { ...c, isPinned: nextPin ? 1 : 0, pinnedAt: nextPin ? new Date().toISOString() : null } : c))
          .sort((a, b) => Number(b.isPinned || 0) - Number(a.isPinned || 0))
      );
    } catch (err: any) {
      alert("置顶操作失败: " + (err?.message || "网络异常"));
    }
  };

  const handlePromptDelete = (item: CharacterItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteModalOpened(true);
  };

  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    try {
      setDeleting(true);
      await deleteCharacter(itemToDelete.id);
      setList((prev) => prev.filter((c) => c.id !== itemToDelete.id));
      if (detailItem?.id === itemToDelete.id) {
        setDetailModalOpened(false);
      }
      setDeleteModalOpened(false);
      setItemToDelete(null);
    } catch (e: any) {
      alert("删除失败: " + (e?.message || "网络异常"));
    } finally {
      setDeleting(false);
    }
  };

  const filteredList = list.filter((item) => {
    const matchSearch =
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.alias && item.alias.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.identity && item.identity.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.faction && item.faction.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.tags && item.tags.toLowerCase().includes(searchKey.toLowerCase()));

    const matchRole = roleFilter === "all" || item.roleType === roleFilter;

    return matchSearch && matchRole;
  });

  return (
    <Box pos="relative" style={{ minHeight: "100%", backgroundColor: "#ffffff" }}>
      <LoadingOverlay visible={loading} />

      <Flex justify="space-between" align="center" mb="md" gap="md" wrap="wrap">
        <Group gap="sm">
          <TextInput
            placeholder="搜索姓名、称号、标签、势力..."
            leftSection={<FiSearch size={14} />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            size="xs"
            style={{ width: 260 }}
          />

          <Select
            size="xs"
            value={roleFilter}
            onChange={(val) => setRoleFilter(val || "all")}
            data={[
              { value: "all", label: "全部定位" },
              { value: "protagonist", label: "主角" },
              { value: "major", label: "重要配角" },
              { value: "antagonist", label: "反派 Boss" },
              { value: "supporting", label: "普通配角" },
              { value: "mob", label: "龙套/过客" },
            ]}
            style={{ width: 130 }}
          />
        </Group>

        <Button size="xs" color="cyan" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新建角色档案
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading ? (
        <Stack align="center" justify="center" p={60} c="#94a3b8" gap={8}>
          <FiUser size={40} strokeWidth={1.2} />
          <Text fz={14} fw={600}>暂无角色档案</Text>
          <Text fz={12}>点击右上角「新建角色档案」记录人物设定、成长弧线与出场章节</Text>
        </Stack>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
          {filteredList.map((item) => (
            <CharacterCard
              key={item.id}
              item={item}
              onViewDetail={handleOpenDetail}
              onEdit={handleOpenEdit}
              onTogglePin={handleTogglePin}
              onDelete={handlePromptDelete}
            />
          ))}
        </SimpleGrid>
      )}

      <ModalCharacterDetail
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        character={detailItem}
        onOpenEdit={handleOpenEdit}
      />

      <ModalCharacterForm
        opened={formModalOpened}
        onClose={() => setFormModalOpened(false)}
        workId={workId}
        editingItem={editingItem}
        onSuccess={async () => {
          await fetchList();
          if (detailItem && editingItem && detailItem.id === editingItem.id) {
            const updated = list.find((c) => c.id === detailItem.id);
            if (updated) setDetailItem(updated);
          }
        }}
      />

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={
          <Group gap={6} align="center">
            <FiAlertTriangle color="#ef4444" size={18} />
            <Text fw={700} fz={15}>确认删除角色档案</Text>
          </Group>
        }
        centered
        size="sm"
        radius="md"
      >
        <Stack gap="sm">
          <Text fz={13.5} c="#334155">
            确定要删除角色 <Text span fw={700} c="#0f172a">「{itemToDelete?.name}」</Text> 吗？
          </Text>
          <Text fz={12} c="#94a3b8">
            删除后该角色的全部人设资料、成长弧线及关联设定将无法恢复。
          </Text>
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="outline" color="gray" size="xs" onClick={() => setDeleteModalOpened(false)}>
              取消
            </Button>
            <Button color="red" size="xs" loading={deleting} onClick={handleExecuteDelete}>
              确认删除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
