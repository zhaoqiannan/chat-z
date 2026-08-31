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
import styles from "../style.module.scss";

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
      alert("阵营势力名称不能为空");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateFaction({
          id: editingItem.id,
          name: name.trim(),
          leader,
          scale,
          alignment,
          doctrine,
          controlledLocations,
          description,
        });
      } else {
        await createFaction({
          workId: Number(workId),
          name: name.trim(),
          leader,
          scale,
          alignment,
          doctrine,
          controlledLocations,
          description,
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
    if (confirm("确定要删除该阵营势力吗？")) {
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
      <Flex justify="space-between" align="center" mb={20} gap={12}>
        <TextInput
          placeholder="搜索阵营名称、领袖或宗旨..."
          leftSection={<FiSearch size={14} />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 360 }}
        />
        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
          新建阵营势力
        </Button>
      </Flex>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiShield size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无阵营势力数据</Text>
            <Text fz={13}>点击右上角「新建阵营势力」创建门派、宗族或帝国组织</Text>
          </Flex>
        ) : (
          <div className={styles.cardGrid}>
            {filteredList.map((item) => (
              <div key={item.id} className={styles.entityCard}>
                <Flex justify="space-between" align="flex-start" mb={10}>
                  <Flex align="center" gap={8}>
                    <FiShield size={18} color="#00c9ff" />
                    <Text fz={17} fw={700} c="#1e293b">
                      {item.name}
                    </Text>
                  </Flex>
                  <Badge color="violet" variant="light">
                    {item.scale || "一流势力"}
                  </Badge>
                </Flex>

                {item.leader && (
                  <Flex align="center" gap={6} fz={13} c="#475569" mb={6}>
                    <FiUserCheck size={13} color="#64748b" />
                    <span>领袖掌门：<b>{item.leader}</b></span>
                  </Flex>
                )}

                {item.alignment && (
                  <Flex align="center" gap={6} fz={12} c="#64748b" mb={6}>
                    <span>阵营立场：<b>{item.alignment}</b></span>
                  </Flex>
                )}

                {item.controlledLocations && (
                  <Flex align="center" gap={6} fz={12} c="#0369a1" mb={8}>
                    <FiMapPin size={12} />
                    <span>控制区域：{item.controlledLocations}</span>
                  </Flex>
                )}

                {item.doctrine && (
                  <Box mb={8} p="8px 12px" bg="#f8fafc" style={{ borderRadius: 8 }}>
                    <Text fz={11} fw={700} c="#64748b" mb={2}>势力宗旨与纲领</Text>
                    <Text fz={12} c="#334155" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.doctrine}
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

      {/* 70vw 宽屏舒适创建/编辑阵营 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiShield color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑阵营 - ${editingItem.name}` : "新建阵营势力卡片"}
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

          <SimpleGrid cols={2}>
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

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建阵营"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
