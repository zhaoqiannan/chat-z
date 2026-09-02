import React, { useState, useEffect } from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, Group, Card, Paper } from "@mantine/core";
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiSearch, FiUser, FiMapPin, FiTrendingUp, FiZap } from "react-icons/fi";
import { FactionItem, getFactionList, createFaction, updateFaction, deleteFaction, getCharacterList, CharacterItem, getLocationList, LocationRecord } from "@/rest/world";
import NameGeneratorModal from "@/components/common/name-generator";

interface FactionsTabProps {
  workId: string;
}

const SCALE_OPTIONS = [
  { value: "p0", label: "P0" },
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
  { value: "p3", label: "P3" },
  { value: "p4", label: "P4" },
  { value: "p5", label: "P5" },
  { value: "p6", label: "P6" },
  { value: "p7", label: "P7" },
  { value: "p8", label: "P8" },
  { value: "p9", label: "P9" },
  { value: "p10", label: "P10" },
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
    setLeaderId(item.leaderId ? String(item.leaderId) : null);
    setLeaderName(item.leader || "");
    setScale(item.scale || "p3");
    setAlignment(item.alignment || "neutral");
    setLocationId(item.locationId ? String(item.locationId) : null);
    setControlledLocations(item.controlledLocations || "");
    setTrend(item.trend || "蒸蒸日上");
    setDoctrine(item.doctrine || "");
    setDescription(item.description || "");
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("请输入阵营名称");
      return;
    }

    try {
      setFormLoading(true);
      const selectedLeader = characters.find((c) => String(c.id) === leaderId);
      const finalLeader = selectedLeader ? selectedLeader.name : leaderName.trim();

      const selectedLoc = locations.find((l) => String(l.id) === locationId);
      const finalLoc = selectedLoc ? selectedLoc.name : controlledLocations.trim();

      const payload = {
        name: name.trim(),
        leader: finalLeader || undefined,
        leaderId: leaderId ? Number(leaderId) : undefined,
        scale,
        alignment,
        locationId: locationId ? Number(locationId) : undefined,
        controlledLocations: finalLoc || undefined,
        trend: trend?.trim() || undefined,
        doctrine: doctrine.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editingItem) {
        await updateFaction({ id: editingItem.id, ...payload });
      } else {
        await createFaction({ workId: Number(workId), ...payload });
      }

      setModalOpened(false);
      await fetchData();
    } catch (e: any) {
      alert("保存阵营失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除该阵营势力吗？")) {
      try {
        await deleteFaction(id);
        setList((prev) => prev.filter((item) => item.id !== id));
      } catch (e: any) {
        alert("删除失败: " + (e?.message || "网络异常"));
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
      (item.doctrine && item.doctrine.toLowerCase().includes(q))
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
    <Box p="md" pos="relative" style={{ minHeight: 400 }}>
      <LoadingOverlay visible={loading} />

      <Flex justify="space-between" align="center" mb="md" gap="sm">
        <TextInput
          placeholder="请输入关键词搜索阵营..."
          size="xs"
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          style={{ width: 260 }}
        />
        <Button size="xs" color="cyan" leftSection={<FiPlus size={13} />} onClick={handleOpenCreate}>
          新增势力阵营
        </Button>
      </Flex>

      {filteredList.length === 0 && !loading && (
        <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8">
          <FiShield size={36} strokeWidth={1.2} style={{ marginBottom: 8 }} />
          <Text fz={13}>暂无阵营势力，点击右上角「新增势力阵营」开始构建</Text>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {filteredList.map((item) => (
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
              height: 156,
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Flex justify="space-between" align="flex-start" mb={4}>
                <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                  <Text fz={14} fw={700} c="#0f172a" truncate="end">
                    {item.name}
                  </Text>
                  <Badge size="xs" color="cyan" variant="outline">
                    {getScaleLabel(item.scale)}
                  </Badge>
                  {getAlignmentBadge(item.alignment)}
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

              {item.doctrine && (
                <Text fz={11.5} c="#0284c7" lineClamp={1} mb={4} style={{ fontStyle: "italic" }}>
                  「{item.doctrine}」
                </Text>
              )}

              <Text fz={11.5} c="#64748b" lineClamp={2} style={{ lineHeight: 1.5, marginBottom: 6 }}>
                {item.description || "暂无阵营背景描述"}
              </Text>
            </Box>

            <Flex justify="space-between" align="center" pt={4} style={{ borderTop: "1px solid #f8fafc" }}>
              <Group gap={8} fz={11} c="#64748b">
                {item.leader && (
                  <Group gap={3}>
                    <FiUser size={10} color="#94a3b8" />
                    <Text fz={10.5}>{item.leader}</Text>
                  </Group>
                )}
                {item.controlledLocations && (
                  <Group gap={3}>
                    <FiMapPin size={10} color="#94a3b8" />
                    <Text fz={10.5}>{item.controlledLocations}</Text>
                  </Group>
                )}
              </Group>

              {item.trend && (
                <Badge size="xs" variant="light" color="teal" leftSection={<FiTrendingUp size={9} />}>
                  {item.trend}
                </Badge>
              )}
            </Flex>
          </Card>
        ))}
      </SimpleGrid>

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
            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fz={12} fw={500} c="#475569">阵营名称 *</Text>
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
            <Select
              label="规模与等级"
              size="xs"
              value={scale}
              onChange={(val) => setScale(val || "p3")}
              data={SCALE_OPTIONS}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="阵营立场"
              size="xs"
              value={alignment}
              onChange={(val) => setAlignment(val || "neutral")}
              data={ALIGNMENT_OPTIONS}
            />
            <Select
              label="发展走势"
              size="xs"
              placeholder="请输入或选择"
              value={trend}
              onChange={(val) => setTrend(val || "蒸蒸日上")}
              data={TREND_PRESETS}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Select
              label="最高领袖"
              placeholder="请输入或选择角色"
              size="xs"
              value={leaderId || ""}
              onChange={(val) => {
                setLeaderId(val || null);
                const found = characters.find((c) => String(c.id) === val);
                if (found) setLeaderName(found.name);
              }}
              data={charSelectData}
              clearable
              searchable
            />
            <Select
              label="控制区域"
              placeholder="请输入或选择地点"
              size="xs"
              value={locationId || ""}
              onChange={(val) => {
                setLocationId(val || null);
                const found = locations.find((l) => String(l.id) === val);
                if (found) setControlledLocations(found.name);
              }}
              data={locSelectData}
              clearable
              searchable
            />
          </SimpleGrid>

          <TextInput
            label="势力宗旨"
            placeholder="请输入"
            size="xs"
            value={doctrine}
            onChange={(e) => setDoctrine(e.target.value)}
          />

          <Textarea
            label="背景设定"
            placeholder="请输入"
            size="xs"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
            autosize
          />

          <Flex justify="flex-end" gap="xs" mt="sm" pt={10} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -12, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
            <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" size="xs" loading={formLoading} onClick={handleSave}>
              保存阵营
            </Button>
          </Flex>
        </Stack>
      </Modal>

      <NameGeneratorModal
        opened={nameGenOpened}
        onClose={() => setNameGenOpened(false)}
        onSelectName={(val) => setName(val)}
        type="faction"
      />
    </Box>
  );
}
