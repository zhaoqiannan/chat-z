// 组件：阵营势力设定管理（表格视图，清晰呈现阵营规模、立场、领袖、据点、宗旨与描述）
"use client";

import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, Group, Paper, Table } from "@mantine/core";
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiSearch, FiUser, FiMapPin, FiTrendingUp } from "react-icons/fi";
import { FactionItem, getFactionList, createFaction, updateFaction, deleteFaction, getCharacterList, CharacterItem, getLocationList, LocationRecord } from "@/rest/world";
import NameGeneratorModal from "@/components/common/name-generator";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";

interface FactionsTabProps {
  workId: string;
}

const SCALE_OPTIONS = [
  { value: "p0", label: "P0 - 顶级" },
  { value: "p1", label: "P1 - 巨头" },
  { value: "p2", label: "P2 - 一流" },
  { value: "p3", label: "P3 - 中坚" },
  { value: "p4", label: "P4 - 区域豪强" },
  { value: "p5", label: "P5 - 地方帮派" },
  { value: "p6", label: "P6 - 小型散门" },
];

const ALIGNMENT_OPTIONS = [
  { value: "positive", label: "正派" },
  { value: "neutral", label: "中立" },
  { value: "negative", label: "反派" },
];

const TREND_PRESETS = [
  { value: "蒸蒸日上", label: "蒸蒸日上" },
  { value: "韬光养晦", label: "韬光养晦" },
  { value: "内部分裂", label: "内部分裂" },
  { value: "日薄西山", label: "日薄西山" },
  { value: "危机四伏", label: "危机四伏" },
];

export default function FactionsTab({ workId }: FactionsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<FactionItem[]>([]);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [searchKey, setSearchKey] = useState("");

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<FactionItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [nameGenOpened, setNameGenOpened] = useState(false);

  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [leaderName, setLeaderName] = useState("");
  const [scale, setScale] = useState("p3");
  const [alignment, setAlignment] = useState("neutral");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [controlledLocations, setControlledLocations] = useState("");
  const [trend, setTrend] = useState("蒸蒸日上");
  const [doctrine, setDoctrine] = useState("");
  const [description, setDescription] = useState("");

  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const [facRes, charRes, locRes] = await Promise.all([
        getFactionList(workId),
        getCharacterList(workId),
        getLocationList(workId),
      ]);

      if (facRes && facRes.success && Array.isArray(facRes.result)) {
        setList(facRes.result);
      }
      if (charRes && charRes.success && Array.isArray(charRes.result)) {
        setCharacters(charRes.result);
      }
      if (locRes && locRes.success && Array.isArray(locRes.result)) {
        setLocations(locRes.result);
      }
    } catch (e) {
      console.error("获取阵营失败:", e);
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
    setLeaderId(null);
    setLeaderName("");
    setScale("p3");
    setAlignment("neutral");
    setLocationId(null);
    setControlledLocations("");
    setTrend("蒸蒸日上");
    setDoctrine("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: FactionItem) => {
    setEditingItem(item);
    setName(item.name || "");
    const foundChar = characters.find((c) => c.name === item.leader);
    setLeaderId(foundChar ? String(foundChar.id) : null);
    setLeaderName(item.leader || "");
    setScale(item.scale || "p3");
    setAlignment(item.alignment || "neutral");
    const foundLoc = locations.find((l) => l.name === item.controlledLocations);
    setLocationId(foundLoc ? String(foundLoc.id) : null);
    setControlledLocations(item.controlledLocations || "");
    setTrend(item.trend || "蒸蒸日上");
    setDoctrine(item.doctrine || "");
    setDescription(item.description || "");
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      useAlert.warning("请输入阵营名称");
      return;
    }

    try {
      setFormLoading(true);
      const selChar = characters.find((c) => String(c.id) === leaderId);
      const finalLeader = selChar ? selChar.name : leaderName.trim();

      const selLoc = locations.find((l) => String(l.id) === locationId);
      const finalLoc = selLoc ? selLoc.name : controlledLocations.trim();

      const payload = {
        name: name.trim(),
        leader: finalLeader || undefined,
        scale: scale || undefined,
        alignment: alignment || undefined,
        controlledLocations: finalLoc || undefined,
        trend: trend || undefined,
        doctrine: doctrine.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editingItem) {
        await updateFaction({ id: editingItem.id, ...payload });
      } else {
        await createFaction({ workId: Number(workId), ...payload });
      }

      useAlert.success("阵营势力已成功保存！");
      setModalOpened(false);
      await fetchData();
    } catch (e: any) {
      useAlert.error("保存阵营失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = await showConfirm({
      title: "删除阵营",
      message: "确定要删除该阵营势力吗？此操作不可撤销。",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (isConfirmed) {
      try {
        await deleteFaction(id);
        setList((prev) => prev.filter((item) => item.id !== id));
        useAlert.success("阵营已成功删除");
      } catch (e: any) {
        useAlert.error("删除失败: " + (e?.message || "网络异常"));
      }
    }
  };

  const getAlignmentBadge = (align?: string | null) => {
    if (align === "positive") return <Badge size="xs" color="teal" variant="light">正派</Badge>;
    if (align === "negative") return <Badge size="xs" color="red" variant="light">反派</Badge>;
    return <Badge size="xs" color="gray" variant="light">中立</Badge>;
  };

  const getScaleLabel = (scaleKey?: string | null) => {
    return scaleKey ? scaleKey.toUpperCase() : "P3";
  };

  const filteredList = list.filter((item) => {
    if (!searchKey) return true;
    const q = searchKey.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.leader && item.leader.toLowerCase().includes(q)) ||
      (item.controlledLocations && item.controlledLocations.toLowerCase().includes(q)) ||
      (item.doctrine && item.doctrine.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  const charSelectData = [
    { value: "", label: "暂无特定领袖" },
    ...characters.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const locSelectData = [
    { value: "", label: "暂无特定区域" },
    ...locations.map((l) => ({ value: String(l.id), label: l.name })),
  ];

  return (
    <Box pos="relative" style={{ minHeight: 400 }}>
      <LoadingOverlay visible={loading} />

      <Flex justify="space-between" align="center" mb="md" gap="sm">
        <TextInput
          placeholder="搜索势力名称、领袖、据点、宗旨或背景..."
          size="xs"
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 320 }}
        />
        <Button size="xs" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新增势力阵营
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading ? (
        <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8" bg="#ffffff">
          <FiShield size={36} strokeWidth={1.2} style={{ marginBottom: 8 }} />
          <Text fz={13}>暂无阵营势力，点击右上角「新增势力阵营」开始构建</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="sm" bg="#ffffff" style={{ overflow: "hidden", borderColor: "#e2e8f0" }}>
          <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover striped>
            <Table.Thead bg="#f8fafc">
              <Table.Tr>
                <Table.Th style={{ width: "22%", minWidth: 180, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  阵营势力名称
                </Table.Th>
                <Table.Th style={{ width: "13%", minWidth: 100, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  领袖掌舵人
                </Table.Th>
                <Table.Th style={{ width: "14%", minWidth: 110, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  核心据点 / 区域
                </Table.Th>
                <Table.Th style={{ width: "11%", minWidth: 90, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  发展态势
                </Table.Th>
                <Table.Th style={{ width: "30%", minWidth: 200, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  宗旨信条与核心设定
                </Table.Th>
                <Table.Th style={{ width: "10%", minWidth: 90, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                  操作
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredList.map((item) => {
                return (
                  <Table.Tr key={item.id} style={{ transition: "background-color 0.15s ease" }}>
                    <Table.Td>
                      <Group gap={8} wrap="nowrap">
                        <Box style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FiShield size={13} color="#0284c7" />
                        </Box>
                        <Box>
                          <Text fz={13.5} fw={700} c="#0f172a" style={{ wordBreak: "break-word" }}>
                            {item.name}
                          </Text>
                          <Group gap={4} mt={2}>
                            <Badge size="xs" variant="outline">
                              {getScaleLabel(item.scale)}
                            </Badge>
                            {getAlignmentBadge(item.alignment)}
                          </Group>
                        </Box>
                      </Group>
                    </Table.Td>

                    <Table.Td>
                      {item.leader ? (
                        <Badge size="sm" variant="outline" color="blue" leftSection={<FiUser size={10} />} styles={{ root: { maxWidth: 120 } }}>
                          {item.leader}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">暂无领袖</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {item.controlledLocations ? (
                        <Badge size="sm" variant="outline" color="teal" leftSection={<FiMapPin size={10} />} styles={{ root: { maxWidth: 120 } }}>
                          {item.controlledLocations}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">未知据点</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {item.trend ? (
                        <Badge size="xs" variant="light" color={item.trend === "蒸蒸日上" ? "teal" : item.trend === "危机四伏" || item.trend === "日薄西山" ? "red" : "gray"} leftSection={<FiTrendingUp size={9} />}>
                          {item.trend}
                        </Badge>
                      ) : (
                        <Text fz={11.5} c="#94a3b8">—</Text>
                      )}
                    </Table.Td>

                    <Table.Td>
                      {item.doctrine && (
                        <Text fz={12} fw={600} c="#0284c7" mb={2} lineClamp={1}>
                          「{item.doctrine}」
                        </Text>
                      )}
                      <Text fz={12} c="#475569" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 80, overflowY: "auto" }}>
                        {item.description || "暂无阵营背景描述"}
                      </Text>
                    </Table.Td>

                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" onClick={() => handleOpenEdit(item)} title="编辑阵营">
                          <FiEdit2 size={13} />
                        </ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => handleDelete(item.id, e)} title="删除阵营">
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
        title={<Text fw={700} fz={15} c="#0f172a">{editingItem ? "编辑势力阵营" : "新建势力阵营"}</Text>}
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
              label="阵营名称"
              placeholder="例如：万剑宗、暗夜议会"
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
            <Select
              label="领袖人物"
              placeholder="选择领袖角色"
              size="xs"
              value={leaderId}
              onChange={(val) => setLeaderId(val)}
              data={charSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
            <Select
              label="势力规模"
              size="xs"
              value={scale}
              onChange={(val) => setScale(val || "p3")}
              data={SCALE_OPTIONS}
            />
            <Select
              label="阵营立场"
              size="xs"
              value={alignment}
              onChange={(val) => setAlignment(val || "neutral")}
              data={ALIGNMENT_OPTIONS}
            />
            <Select
              label="发展态势"
              size="xs"
              value={trend}
              onChange={(val) => setTrend(val || "蒸蒸日上")}
              data={TREND_PRESETS}
            />
          </SimpleGrid>

          <Select
            label="所属据点 / 区域"
            placeholder="选择主要据点"
            size="xs"
            value={locationId}
            onChange={(val) => setLocationId(val)}
            data={locSelectData}
            clearable
            searchable
          />

          <TextInput
            label="宗旨信条 / 门派祖训"
            placeholder="例如：替天行道、弱肉强食、科技重塑一切"
            size="xs"
            value={doctrine}
            onChange={(e) => setDoctrine(e.target.value)}
          />

          <Textarea
            label="阵营背景与核心设定"
            placeholder="详细描述该势力的起源历史、组织架构、战力底蕴、核心利益诉求..."
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
              保存阵营
            </Button>
          </Flex>
        </Stack>
      </Modal>

      <NameGeneratorModal
        opened={nameGenOpened}
        onClose={() => setNameGenOpened(false)}
        type="faction"
        onSelectName={(genName) => setName(genName)}
      />
    </Box>
  );
}
