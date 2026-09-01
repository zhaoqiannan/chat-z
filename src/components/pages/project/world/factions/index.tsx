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
  Group,
  Card,
  Paper,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiShield,
  FiSearch,
  FiUserCheck,
  FiMapPin,
} from "react-icons/fi";
import {
  FactionItem,
  getFactionList,
  createFaction,
  updateFaction,
  deleteFaction,
} from "@/rest/world";

interface FactionsTabProps {
  workId: string;
}

export default function FactionsTab({ workId }: FactionsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<FactionItem[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<FactionItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [leader, setLeader] = useState("");
  const [scale, setScale] = useState("一流大派");
  const [alignment, setAlignment] = useState("中立");
  const [doctrine, setDoctrine] = useState("");
  const [controlledLocations, setControlledLocations] = useState("");
  const [description, setDescription] = useState("");

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getFactionList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取阵营列表失败:", e);
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
    setLeader("");
    setScale("一流大派");
    setAlignment("中立");
    setDoctrine("");
    setControlledLocations("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: FactionItem) => {
    setEditingItem(item);
    setName(item.name || "");
    setLeader(item.leader || "");
    setScale(item.scale || "一流大派");
    setAlignment(item.alignment || "中立");
    setDoctrine(item.doctrine || "");
    setControlledLocations(item.controlledLocations || "");
    setDescription(item.description || "");
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入阵营势力名称！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateFaction({
          id: editingItem.id,
          name: name.trim(),
          leader: leader.trim() || undefined,
          scale,
          alignment,
          doctrine: doctrine.trim() || undefined,
          controlledLocations: controlledLocations.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await createFaction({
          workId: Number(workId),
          name: name.trim(),
          leader: leader.trim() || undefined,
          scale,
          alignment,
          doctrine: doctrine.trim() || undefined,
          controlledLocations: controlledLocations.trim() || undefined,
          description: description.trim() || undefined,
        });
      }
      setModalOpened(false);
      await fetchList();
    } catch (e: any) {
      alert("保存阵营失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("确定要删除该阵营势力吗？此操作不可撤销。")) {
      const res = await deleteFaction(id);
      if (res && res.success) {
        await fetchList();
      }
    }
  };

  const filteredList = list.filter((item) => {
    return (
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.leader && item.leader.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.doctrine && item.doctrine.toLowerCase().includes(searchKey.toLowerCase()))
    );
  });

  return (
    <Box>
      <Group justify="space-between" align="center" mb="lg" wrap="wrap">
        <TextInput
          placeholder="搜索阵营名称、领袖或宗旨..."
          leftSection={<FiSearch size={14} />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 360 }}
        />
        <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreate}>
          新建阵营势力
        </Button>
      </Group>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
            <FiShield size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无阵营势力数据</Text>
            <Text fz={13}>点击右上角「新建阵营势力」创建门派、宗族或帝国组织</Text>
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
                    <FiShield size={18} color="#06b6d4" />
                    <Text fz={17} fw={700} c="dark.7">
                      {item.name}
                    </Text>
                  </Group>
                  <Badge color="violet" variant="light" size="sm">
                    {item.scale || "一流势力"}
                  </Badge>
                </Group>

                {item.leader && (
                  <Group gap={6} fz={13} c="dark.5" mb={4}>
                    <FiUserCheck size={13} color="#64748b" />
                    <Text fz={13}>领袖掌门：<Text span fw={700}>{item.leader}</Text></Text>
                  </Group>
                )}

                {item.alignment && (
                  <Group gap={6} fz={12} c="dimmed" mb={4}>
                    <Text fz={12}>阵营立场：<Text span fw={600} c="dark.5">{item.alignment}</Text></Text>
                  </Group>
                )}

                {item.controlledLocations && (
                  <Group gap={6} fz={12} c="cyan.8" mb="xs">
                    <FiMapPin size={12} />
                    <Text fz={12}>控制区域：{item.controlledLocations}</Text>
                  </Group>
                )}

                {item.doctrine && (
                  <Paper mb="xs" p="xs" bg="gray.0" radius="sm">
                    <Text fz={11} fw={700} c="dimmed" mb={2}>势力宗旨与纲领</Text>
                    <Text fz={12} c="dark.6" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.doctrine}
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

      {/* 70vw 宽屏舒适创建/编辑阵营 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiShield color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑阵营 - ${editingItem.name}` : "新建阵营势力卡片"}
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
              label="阵营 / 势力名称"
              placeholder="例如：万剑圣宗 / 暗影议会"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextInput
              label="最高领袖 / 掌门人"
              placeholder="例如：剑皇独孤绝 / 执政官阿修罗"
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="势力规模与等级"
              value={scale}
              onChange={(val) => setScale(val || "一流大派")}
              data={["超级霸主 / 皇朝巨头", "一流大派", "中等宗门", "隐世古族", "地方豪强 / 帮会", "地下刺客组织"]}
            />
            <Select
              label="阵营立场"
              value={alignment}
              onChange={(val) => setAlignment(val || "中立")}
              data={["守序正道", "中立守望", "混乱魔道", "绝对邪恶", "科技狂热", "狂乱不可名状"]}
            />
          </SimpleGrid>

          <TextInput
            label="控制区域与根据地"
            placeholder="例如：天南剑域全境、幽冥九渊..."
            value={controlledLocations}
            onChange={(e) => setControlledLocations(e.target.value)}
          />

          <Textarea
            label="立派宗旨 / 核心纲领与教条"
            placeholder="例如：以剑证道，斩尽天下不平事；凡我门人，见魔必诛..."
            value={doctrine}
            onChange={(e) => setDoctrine(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="详细背景历史与外交关系"
            placeholder="记录门派的起源传说、敌对仇家与同盟协议..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建阵营"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
