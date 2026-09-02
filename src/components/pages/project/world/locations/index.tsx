import React, { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Button, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, SegmentedControl, Paper, Group, Card } from "@mantine/core";
import { FiPlus, FiEdit, FiTrash2, FiMapPin, FiSearch, FiCompass, FiLayers, FiZap } from "react-icons/fi";
import { LocationRecord, getLocationList, createLocation, updateLocation, deleteLocation } from "@/rest/world";
import NameGeneratorModal from "@/components/common/name-generator";

interface LocationsTabProps {
  workId: string;
}

export default function LocationsTab({ workId }: LocationsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<LocationRecord[]>([]);
  const [viewMode, setViewMode] = useState<"map" | "list">("list");
  const [searchKey, setSearchKey] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);

  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<LocationRecord | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [nameGenOpened, setNameGenOpened] = useState(false);

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [background, setBackground] = useState("");
  const [geography, setGeography] = useState("");
  const [customs, setCustoms] = useState("");
  const [climate, setClimate] = useState("");
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [detailItem, setDetailItem] = useState<LocationRecord | null>(null);

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getLocationList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取地点列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [workId]);

  const handleOpenCreate = (coords?: { x: number; y: number }) => {
    setEditingItem(null);
    setName("");
    setAlias("");
    setParentId(null);
    setBackground("");
    setGeography("");
    setCustoms("");
    setClimate("");
    setPosX(coords ? coords.x : Math.floor(Math.random() * 60) + 20);
    setPosY(coords ? coords.y : Math.floor(Math.random() * 60) + 20);
    setModalOpened(true);
  };

  const handleOpenEdit = (item: LocationRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setName(item.name || "");
    setAlias(item.alias || "");
    setParentId(item.parentId ? String(item.parentId) : null);
    setBackground(item.background || item.description || "");
    setGeography(item.geography || item.terrain || "");
    setCustoms(item.customs || item.features || "");
    setClimate(item.climate || "");
    setPosX(item.posX || 50);
    setPosY(item.posY || 50);
    setModalOpened(true);
  };

  const handleOpenDetail = (item: LocationRecord) => {
    setDetailItem(item);
    setDetailModalOpened(true);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = Math.round((clickX / rect.width) * 100);
    const percentY = Math.round((clickY / rect.height) * 100);

    handleOpenCreate({ x: percentX, y: percentY });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入地点名称！");
      return;
    }

    try {
      setFormLoading(true);
      const selectedParent = list.find((loc) => String(loc.id) === parentId);
      const parentName = selectedParent ? selectedParent.name : null;

      const payload = {
        name: name.trim(),
        alias: alias.trim() || undefined,
        parentId: parentId ? Number(parentId) : null,
        parentName: parentName || undefined,
        background: background || undefined,
        description: background || undefined,
        geography: geography || undefined,
        customs: customs || undefined,
        climate: climate || undefined,
        posX,
        posY,
      };

      if (editingItem) {
        await updateLocation({ id: editingItem.id, ...payload });
      } else {
        await createLocation({ workId: Number(workId), ...payload });
      }

      setModalOpened(false);
      await fetchList();
    } catch (e: any) {
      alert("保存地点失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("确定要删除该地点吗？此操作不可撤销。")) {
      const res = await deleteLocation(id);
      if (res && res.success) {
        await fetchList();
      }
    }
  };

  const parentOptions = [
    { value: "", label: "无上级地点（根级地点）" },
    ...list
      .filter((item) => !editingItem || item.id !== editingItem.id)
      .map((item) => ({
        value: String(item.id),
        label: item.name + (item.alias ? ` (${item.alias})` : ""),
      })),
  ];

  const filteredList = list.filter((item) => {
    return (
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.alias && item.alias.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.parentName && item.parentName.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.geography && item.geography.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.customs && item.customs.toLowerCase().includes(searchKey.toLowerCase()))
    );
  });

  return (
    <Box>
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 480 }}>
          <TextInput
            placeholder="搜索地点名称、别名或风土特点..."
            leftSection={<FiSearch size={14} />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            style={{ flex: 1 }}
            size="xs"
          />

          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as "map" | "list")}
            data={[
              { label: "卡片列表", value: "list" },
              { label: "地图画布", value: "map" },
            ]}
          />
        </Group>

        <Button size="xs" leftSection={<FiPlus size={13} />} color="cyan" onClick={() => handleOpenCreate()}>
          新建地点
        </Button>
      </Group>

      <Box pos="relative">
        <LoadingOverlay visible={loading} />

        {viewMode === "map" ? (
          <Box>
            <Group justify="space-between" align="center" mb="xs" fz={12} c="#64748b">
              <Text fz={12}>💡 提示：在画布任意位置单击可直接标记地标；点击地标可查看/编辑详情。</Text>
              <Text fz={12}>当前已标注地标数：<Text span fw={700} c="#0f172a">{list.length}</Text> 个</Text>
            </Group>

            <Paper
              ref={mapRef}
              withBorder
              radius="sm"
              shadow="xs"
              onClick={handleMapClick}
              style={{
                width: "100%",
                height: 540,
                backgroundColor: "#f8fafc",
                position: "relative",
                overflow: "hidden",
                cursor: "crosshair",
                backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            >
              {filteredList.map((loc) => {
                return (
                  <Box
                    key={loc.id}
                    onClick={(e) => handleOpenEdit(loc, e)}
                    style={{
                      position: "absolute",
                      left: `${loc.posX}%`,
                      top: `${loc.posY}%`,
                      transform: "translate(-50%, -50%)",
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                  >
                    <Paper
                      shadow="xs"
                      radius="sm"
                      withBorder
                      px={10}
                      py={4}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "#ffffff",
                        borderColor: "#06b6d4",
                        borderWidth: 1.5,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <FiMapPin size={13} color="#06b6d4" />
                      <Text fz={12} fw={700} c="#1e293b">{loc.name}</Text>
                      {loc.parentName && <Text fz={10.5} c="#64748b">[{loc.parentName}]</Text>}
                    </Paper>
                  </Box>
                );
              })}
            </Paper>
          </Box>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {filteredList.map((item) => (
              <Card
                key={item.id}
                radius="sm"
                withBorder
                p="sm"
                bg="#ffffff"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderColor: "#e2e8f0",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                  minHeight: 120,
                }}
                onClick={() => handleOpenDetail(item)}
              >
                <Box>
                  <Flex justify="space-between" align="center" mb={6}>
                    <Group gap={6} align="center">
                      <FiMapPin size={14} color="#06b6d4" />
                      <Text fz={14.5} fw={700} c="#0f172a">
                        {item.name}
                      </Text>
                      {item.alias ? (
                        <Text fz={11.5} c="#64748b">
                          「{item.alias}」
                        </Text>
                      ) : null}
                    </Group>

                    {item.parentName && (
                      <Group gap={4} align="center">
                        <FiLayers size={11} color="#64748b" />
                        <Text fz={10.5} c="#64748b" style={{ border: "1px solid #f1f5f9", padding: "1px 5px", borderRadius: 3 }}>
                          {item.parentName}
                        </Text>
                      </Group>
                    )}
                  </Flex>

                  {(item.background || item.description) && (
                    <Text fz={12} c="#475569" lineClamp={2} mb={6} style={{ whiteSpace: "pre-wrap" }}>
                      {item.background || item.description}
                    </Text>
                  )}

                  {item.geography && (
                    <Text fz={11.5} c="#64748b" lineClamp={1} mb={4}>
                      地貌：{item.geography}
                    </Text>
                  )}

                  {item.customs && (
                    <Text fz={11.5} c="#64748b" lineClamp={1} mb={4}>
                      风土：{item.customs}
                    </Text>
                  )}

                  {item.climate && (
                    <Text fz={11.5} c="#64748b" lineClamp={1}>
                      气候：{item.climate}
                    </Text>
                  )}
                </Box>

                <Group justify="flex-end" gap="xs" mt="xs" pt={6} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <ActionIcon variant="subtle" color="cyan" size="xs" onClick={(e) => handleOpenEdit(item, e)}>
                    <FiEdit size={13} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="xs" onClick={(e) => handleDelete(item.id, e)}>
                    <FiTrash2 size={13} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* 70vw 宽屏创建/编辑地点 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiCompass color="#06b6d4" size={16} />
            <Text fw={700} fz={15} c="#0f172a">
              {editingItem ? `编辑地点 - ${editingItem.name}` : "新建地点"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="sm"
        styles={{
          content: { maxHeight: "88vh", display: "flex", flexDirection: "column" },
          header: { borderBottom: "1px solid #f1f5f9", padding: "12px 20px", flexShrink: 0 },
          body: { flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 20px 12px 20px" },
        }}
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fz={12} fw={500} c="#475569">地点名称 *</Text>
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
              label="别名"
              placeholder="请输入"
              size="xs"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            <Select
              label="关联上级地点"
              placeholder="请选择上级地点（可选）"
              size="xs"
              value={parentId || ""}
              onChange={(val) => setParentId(val || null)}
              data={parentOptions}
              searchable
              clearable
            />
          </SimpleGrid>

          <Textarea
            label="背景"
            placeholder="请输入"
            size="xs"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            minRows={10}
            autosize
          />

          <Textarea
            label="地貌描述"
            placeholder="请输入"
            size="xs"
            value={geography}
            onChange={(e) => setGeography(e.target.value)}
            minRows={10}
            autosize
          />

          <Textarea
            label="风土设定"
            placeholder="请输入"
            size="xs"
            value={customs}
            onChange={(e) => setCustoms(e.target.value)}
            minRows={10}
            autosize
          />

          <Textarea
            label="气候特点"
            placeholder="请输入"
            size="xs"
            value={climate}
            onChange={(e) => setClimate(e.target.value)}
            minRows={10}
            autosize
          />
        </Stack>

        <Group justify="flex-end" gap="xs" mt="md" pt={12} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -12, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
          <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
            取消
          </Button>
          <Button color="cyan" size="xs" loading={formLoading} onClick={handleSubmit}>
            {editingItem ? "保存地点设定" : "创建地点"}
          </Button>
        </Group>
      </Modal>

      {/* 70vw 宽屏地点详情查看 Modal */}
      <Modal
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiMapPin color="#06b6d4" size={16} />
            <Text fw={700} fz={15} c="#0f172a">
              {detailItem?.name} 详情
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="sm"
        styles={{
          content: { maxHeight: "88vh", display: "flex", flexDirection: "column" },
          header: { borderBottom: "1px solid #f1f5f9", padding: "12px 20px", flexShrink: 0 },
          body: { flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 20px 12px 20px" },
        }}
      >
        {detailItem && (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
              <Box p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                <Text fz={11} c="#94a3b8" mb={2}>地点名称</Text>
                <Text fz={13} fw={700} c="#0f172a">{detailItem.name}</Text>
              </Box>
              <Box p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                <Text fz={11} c="#94a3b8" mb={2}>别名</Text>
                <Text fz={13} fw={500} c="#334155">{detailItem.alias || "无"}</Text>
              </Box>
              <Box p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                <Text fz={11} c="#94a3b8" mb={2}>关联上级地点</Text>
                <Text fz={13} fw={500} c="#0891b2">{detailItem.parentName || "无上级地点"}</Text>
              </Box>
            </SimpleGrid>

            {(detailItem.background || detailItem.description) && (
              <Box>
                <Text fz={12} fw={600} c="#64748b" mb={3}>背景</Text>
                <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 10px", border: "1px solid #f8fafc", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                  {detailItem.background || detailItem.description}
                </Text>
              </Box>
            )}

            {(detailItem.geography || detailItem.terrain) && (
              <Box>
                <Text fz={12} fw={600} c="#64748b" mb={3}>地貌描述</Text>
                <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 10px", border: "1px solid #f8fafc", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                  {detailItem.geography || detailItem.terrain}
                </Text>
              </Box>
            )}

            {(detailItem.customs || detailItem.features) && (
              <Box>
                <Text fz={12} fw={600} c="#64748b" mb={3}>风土设定</Text>
                <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 10px", border: "1px solid #f8fafc", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                  {detailItem.customs || detailItem.features}
                </Text>
              </Box>
            )}

            {detailItem.climate && (
              <Box>
                <Text fz={12} fw={600} c="#64748b" mb={3}>气候特点</Text>
                <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 10px", border: "1px solid #f8fafc", borderRadius: 4, backgroundColor: "#fafbfc" }}>
                  {detailItem.climate}
                </Text>
              </Box>
            )}
          </Stack>
        )}

        <Group justify="flex-end" gap="xs" mt="md" pt={12} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -12, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
          <Button variant="default" size="xs" onClick={() => setDetailModalOpened(false)}>
            关闭
          </Button>
          {detailItem && (
            <Button
              color="cyan"
              size="xs"
              leftSection={<FiEdit size={11} />}
              onClick={() => {
                setDetailModalOpened(false);
                handleOpenEdit(detailItem);
              }}
            >
              编辑地点
            </Button>
          )}
        </Group>
      </Modal>

      <NameGeneratorModal
        opened={nameGenOpened}
        onClose={() => setNameGenOpened(false)}
        onSelectName={(val) => setName(val)}
        type="location"
      />
    </Box>
  );
}
