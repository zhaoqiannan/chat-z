"use client";

import React, { useState, useEffect, useRef } from "react";
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
  SegmentedControl,
  Paper,
  Group,
  Card,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiMapPin,
  FiSearch,
  FiSun,
  FiCompass,
} from "react-icons/fi";
import {
  LocationRecord,
  getLocationList,
  createLocation,
  updateLocation,
  deleteLocation,
} from "@/rest/world";

interface LocationsTabProps {
  workId: string;
}

export default function LocationsTab({ workId }: LocationsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<LocationRecord[]>([]);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [searchKey, setSearchKey] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);

  // 编辑/新建 Modal
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<LocationRecord | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // 表单状态
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [region, setRegion] = useState("");
  const [type, setType] = useState("city");
  const [climate, setClimate] = useState("");
  const [terrain, setTerrain] = useState("");
  const [features, setFeatures] = useState("");
  const [plotPoints, setPlotPoints] = useState("");
  const [description, setDescription] = useState("");
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

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
    setRegion("");
    setType("city");
    setClimate("");
    setTerrain("");
    setFeatures("");
    setPlotPoints("");
    setDescription("");
    setPosX(coords ? coords.x : Math.floor(Math.random() * 60) + 20);
    setPosY(coords ? coords.y : Math.floor(Math.random() * 60) + 20);
    setModalOpened(true);
  };

  const handleOpenEdit = (item: LocationRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setName(item.name);
    setAlias(item.alias || "");
    setRegion(item.region || "");
    setType(item.type || "city");
    setClimate(item.climate || "");
    setTerrain(item.terrain || "");
    setFeatures(item.features || "");
    setPlotPoints(item.plotPoints || "");
    setDescription(item.description || "");
    setPosX(item.posX || 50);
    setPosY(item.posY || 50);
    setModalOpened(true);
  };

  // 点击地图空白区域添加新地标
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
      if (editingItem) {
        await updateLocation({
          id: editingItem.id,
          name: name.trim(),
          alias: alias.trim() || undefined,
          region: region.trim() || undefined,
          type,
          climate: climate.trim() || undefined,
          terrain: terrain.trim() || undefined,
          features: features.trim() || undefined,
          plotPoints: plotPoints.trim() || undefined,
          description: description.trim() || undefined,
          posX,
          posY,
        });
      } else {
        await createLocation({
          workId: Number(workId),
          name: name.trim(),
          alias: alias.trim() || undefined,
          region: region.trim() || undefined,
          type,
          climate: climate.trim() || undefined,
          terrain: terrain.trim() || undefined,
          features: features.trim() || undefined,
          plotPoints: plotPoints.trim() || undefined,
          description: description.trim() || undefined,
          posX,
          posY,
        });
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

  const getTypeColor = (locType: string) => {
    switch (locType) {
      case "sect":
        return "#8b5cf6";
      case "dungeon":
        return "#ef4444";
      case "natural":
        return "#10b981";
      case "landmark":
        return "#f59e0b";
      default:
        return "#06b6d4";
    }
  };

  const filteredList = list.filter((item) => {
    return (
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.region && item.region.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.features && item.features.toLowerCase().includes(searchKey.toLowerCase()))
    );
  });

  return (
    <Box>
      {/* 顶部操作与模式切换 */}
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 480 }}>
          <TextInput
            placeholder="搜索地点名称、大区或地形特点..."
            leftSection={<FiSearch size={14} />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            style={{ flex: 1 }}
          />

          <SegmentedControl
            value={viewMode}
            onChange={(v) => setViewMode(v as "map" | "list")}
            data={[
              { label: "🗺️ 地图画布", value: "map" },
              { label: "📋 卡片列表", value: "list" },
            ]}
          />
        </Group>

        <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={() => handleOpenCreate()}>
          新建地点
        </Button>
      </Group>

      <Box pos="relative">
        <LoadingOverlay visible={loading} />

        {/* 视图模式 1: 可视化交互世界地图画布 */}
        {viewMode === "map" ? (
          <Box>
            <Group justify="space-between" align="center" mb="xs" fz={12} c="dimmed">
              <Text fz={12}>💡 提示：在画布任意位置<Text span fw={700} c="dark.6">单击</Text>可直接快速标记地标；点击地标可查看/编辑详情。</Text>
              <Text fz={12}>当前已标注地标数：<Text span fw={700} c="dark.6">{list.length}</Text> 个</Text>
            </Group>

            <Paper
              ref={mapRef}
              withBorder
              radius="md"
              shadow="sm"
              onClick={handleMapClick}
              style={{
                width: "100%",
                height: 520,
                backgroundColor: "#f8fafc",
                position: "relative",
                overflow: "hidden",
                cursor: "crosshair",
                backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            >
              {/* 各地点地标 Pin */}
              {filteredList.map((loc) => {
                const pinColor = getTypeColor(loc.type);
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
                      shadow="md"
                      radius="xl"
                      withBorder
                      px={10}
                      py={4}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "#ffffff",
                        borderColor: pinColor,
                        borderWidth: 2,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <FiMapPin size={13} color={pinColor} />
                      <Text fz={12} fw={700} c="dark.7">{loc.name}</Text>
                      {loc.region && <Text fz={11} c="dimmed">({loc.region})</Text>}
                    </Paper>
                  </Box>
                );
              })}
            </Paper>
          </Box>
        ) : (
          /* 视图模式 2: 卡片网格列表 */
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
                <Group justify="space-between" align="center" mb="xs">
                  <Group gap="xs" align="center">
                    <FiMapPin size={16} color={getTypeColor(item.type)} />
                    <Text fz={16} fw={700} c="dark.7">
                      {item.name} {item.alias ? `(${item.alias})` : ""}
                    </Text>
                  </Group>
                  <Badge color="cyan" variant="light" size="sm">
                    {item.type || "城池"}
                  </Badge>
                </Group>

                {item.region && (
                  <Text fz={12} c="dimmed" mb={4}>
                    所属大区：<Text span fw={600} c="dark.5">{item.region}</Text> · 坐标 ({item.posX}%, {item.posY}%)
                  </Text>
                )}

                {item.climate && (
                  <Group gap={6} fz={12} c="dark.5" mb={4}>
                    <FiSun size={12} color="#f59e0b" />
                    <Text fz={12}>气候环境：{item.climate}</Text>
                  </Group>
                )}

                {item.terrain && (
                  <Text fz={12} c="dark.5" mb="xs">
                    🏔️ 地形地貌：{item.terrain}
                  </Text>
                )}

                {item.features && (
                  <Paper mb="xs" p="xs" bg="gray.0" radius="sm">
                    <Text fz={11} fw={700} c="dimmed">标志特点</Text>
                    <Text fz={12} c="dark.6" lineClamp={2}>{item.features}</Text>
                  </Paper>
                )}

                {item.plotPoints && (
                  <Text fz={12} c="red.7" mb="xs" lineClamp={1}>
                    💥 核心剧情点：{item.plotPoints}
                  </Text>
                )}

                <Group justify="flex-end" gap="xs" mt="auto" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                  <ActionIcon variant="subtle" color="cyan" size="sm" onClick={(e) => handleOpenEdit(item, e)}>
                    <FiEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={(e) => handleDelete(item.id, e)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑地点 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiCompass color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑地点设定 - ${editingItem.name}` : "新建地理空间与地标"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="地点名称"
              placeholder="例如：万剑城 / 黑石要塞"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextInput
              label="别名 / 古称"
              placeholder="例如：剑祖故里 / 绝望深渊"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            <TextInput
              label="所属大区 / 州界 / 星域"
              placeholder="例如：东荒神洲 / 天南九国"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Select
              label="地理空间类型"
              value={type}
              onChange={(val) => setType(val || "city")}
              data={[
                { value: "city", label: "🏰 城池 / 聚落 / 帝国帝都" },
                { value: "sect", label: "⛩️ 宗门圣地 / 学院道场" },
                { value: "dungeon", label: "💀 禁地秘境 / 遗迹深渊" },
                { value: "natural", label: "🌲 自然风貌 / 荒原山脉" },
                { value: "landmark", label: "⭐ 特殊地标 / 奇观通天塔" },
              ]}
            />
            <TextInput
              label="气候 / 天气特点"
              placeholder="例如：常年暴雪冰封 / 烈阳不落 / 瘴气弥漫"
              value={climate}
              onChange={(e) => setClimate(e.target.value)}
            />
            <TextInput
              label="地形 / 地貌结构"
              placeholder="例如：悬空浮岛群 / 熔岩裂谷 / 绝壁天堑"
              value={terrain}
              onChange={(e) => setTerrain(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Textarea
              label="标志性建筑 / 核心特点"
              placeholder="例如：城中央屹立三千丈诛仙剑雕像，全城由不朽玄晶铸就..."
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              minRows={3}
            />
            <Textarea
              label="关键剧情发展点 / 故事关联 (选填)"
              placeholder="例如：第三卷主角在此遭遇退婚风波，引发两派圣战..."
              value={plotPoints}
              onChange={(e) => setPlotPoints(e.target.value)}
              minRows={3}
            />
          </SimpleGrid>

          <Textarea
            label="详细背景风土人情设定"
            placeholder="描写该地点的历史渊源、常住人口、势力割据、物产资源等细节..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建地点"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
