"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Textarea,
  Select,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  SegmentedControl,
  Paper,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiMapPin,
  FiMap,
  FiGrid,
  FiSearch,
  FiFlag,
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
import styles from "../style.module.scss";

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
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [type, setType] = useState("city");
  const [climate, setClimate] = useState("");
  const [terrain, setTerrain] = useState("");
  const [features, setFeatures] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [governingFaction, setGoverningFaction] = useState("");
  const [plotPoints, setPlotPoints] = useState("");
  const [description, setDescription] = useState("");

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

  // 点击地图画布任意位置添加地标
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const roundX = Math.round(Math.max(5, Math.min(95, clickX)));
    const roundY = Math.round(Math.max(5, Math.min(95, clickY)));

    setEditingItem(null);
    setName("");
    setAlias("");
    setRegion("");
    setPosX(roundX);
    setPosY(roundY);
    setType("city");
    setClimate("");
    setTerrain("");
    setFeatures("");
    setSpecialties("");
    setGoverningFaction("");
    setPlotPoints("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setAlias("");
    setRegion("");
    setPosX(50);
    setPosY(50);
    setType("city");
    setClimate("");
    setTerrain("");
    setFeatures("");
    setSpecialties("");
    setGoverningFaction("");
    setPlotPoints("");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: LocationRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setName(item.name || "");
    setAlias(item.alias || "");
    setRegion(item.region || "");
    setPosX(item.posX || 50);
    setPosY(item.posY || 50);
    setType(item.type || "city");
    setClimate(item.climate || "");
    setTerrain(item.terrain || "");
    setFeatures(item.features || "");
    setSpecialties(item.specialties || "");
    setGoverningFaction(item.governingFaction || "");
    setPlotPoints(item.plotPoints || "");
    setDescription(item.description || "");
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("地点名称不能为空");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateLocation({
          id: editingItem.id,
          name: name.trim(),
          alias,
          region,
          posX,
          posY,
          type,
          climate,
          terrain,
          features,
          specialties,
          governingFaction,
          plotPoints,
          description,
        });
      } else {
        await createLocation({
          workId: Number(workId),
          name: name.trim(),
          alias,
          region,
          posX,
          posY,
          type,
          climate,
          terrain,
          features,
          specialties,
          governingFaction,
          plotPoints,
          description,
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
        return "#00c9ff";
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
      <Flex justify="space-between" align="center" mb={16} gap={12} wrap="wrap">
        <Flex gap={12} align="center" style={{ flex: 1, maxWidth: 460 }}>
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
        </Flex>

        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
          新建地点
        </Button>
      </Flex>

      <Box pos="relative">
        <LoadingOverlay visible={loading} />

        {/* 视图模式 1: 可视化交互世界地图画布 */}
        {viewMode === "map" ? (
          <Box>
            <Flex justify="space-between" align="center" mb={8} fz={12} c="#64748b">
              <span>💡 提示：在画布任意位置<b>单击</b>可直接快速标记地标；点击地标可查看/编辑详情。</span>
              <span>当前已标注地标数：<b>{list.length}</b> 个</span>
            </Flex>

            <div ref={mapRef} className={styles.mapCanvasWrapper} onClick={handleMapClick}>
              {/* 各地点地标 Pin */}
              {filteredList.map((loc) => {
                const pinColor = getTypeColor(loc.type);
                return (
                  <div
                    key={loc.id}
                    className={styles.mapLocationPin}
                    style={{ left: `${loc.posX}%`, top: `${loc.posY}%` }}
                    onClick={(e) => handleOpenEdit(loc, e)}
                  >
                    <div className={styles.pinBadge} style={{ borderColor: pinColor }}>
                      <FiMapPin size={13} color={pinColor} />
                      <span>{loc.name}</span>
                      {loc.region && <span style={{ color: "#94a3b8", fontWeight: 400 }}>({loc.region})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Box>
        ) : (
          /* 视图模式 2: 卡片网格列表 */
          <div className={styles.cardGrid}>
            {filteredList.map((item) => (
              <div key={item.id} className={styles.entityCard}>
                <Flex justify="space-between" align="center" mb={8}>
                  <Flex align="center" gap={8}>
                    <FiMapPin size={16} color={getTypeColor(item.type)} />
                    <Text fz={16} fw={700} c="#1e293b">
                      {item.name} {item.alias ? `(${item.alias})` : ""}
                    </Text>
                  </Flex>
                  <Badge color="cyan" variant="light">
                    {item.type || "城池"}
                  </Badge>
                </Flex>

                {item.region && (
                  <Text fz={12} c="#64748b" mb={4}>
                    所属大区：<b>{item.region}</b> · 坐标 ({item.posX}%, {item.posY}%)
                  </Text>
                )}

                {item.climate && (
                  <Flex align="center" gap={6} fz={12} c="#475569" mb={4}>
                    <FiSun size={12} color="#f59e0b" />
                    <span>气候环境：{item.climate}</span>
                  </Flex>
                )}

                {item.terrain && (
                  <Text fz={12} c="#475569" mb={6}>
                    🏔️ 地形地貌：{item.terrain}
                  </Text>
                )}

                {item.features && (
                  <Box mb={8} p="6px 10px" bg="#f8fafc" style={{ borderRadius: 6 }}>
                    <Text fz={11} fw={700} c="#64748b">标志特点</Text>
                    <Text fz={12} c="#334155" lineClamp={2}>{item.features}</Text>
                  </Box>
                )}

                {item.plotPoints && (
                  <Text fz={12} c="#dc2626" mb={6} lineClamp={1}>
                    💥 核心剧情点：{item.plotPoints}
                  </Text>
                )}

                <Flex justify="flex-end" gap={6} mt="auto" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <ActionIcon variant="subtle" color="blue" size="sm" onClick={(e) => handleOpenEdit(item, e)}>
                    <FiEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={(e) => handleDelete(item.id, e)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Flex>
              </div>
            ))}
          </div>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑地点 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiCompass color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑地点设定 - ${editingItem.name}` : "新建地理空间与地标"}
            </Text>
          </Flex>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="16px">
          <SimpleGrid cols={3}>
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

          <SimpleGrid cols={3}>
            <Select
              label="地点类型"
              value={type}
              onChange={(val) => setType(val || "city")}
              data={[
                { value: "city", label: "🏰 城池 / 都市 / 聚落" },
                { value: "sect", label: "⛩️ 宗门祖庭 / 势力据点" },
                { value: "dungeon", label: "🔥 秘境 / 上古遗迹 / 危险禁区" },
                { value: "natural", label: "🏔️ 山川大泽 / 荒野平原" },
                { value: "landmark", label: "✨ 特殊地标 / 奇观节点" },
              ]}
            />
            <TextInput
              label="地图画布 X 坐标 (0-100%)"
              type="number"
              value={posX}
              onChange={(e) => setPosX(Number(e.target.value))}
            />
            <TextInput
              label="地图画布 Y 坐标 (0-100%)"
              type="number"
              value={posY}
              onChange={(e) => setPosY(Number(e.target.value))}
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <TextInput
              label="气候环境"
              placeholder="例如：终年落雪、极寒罡风肆虐..."
              value={climate}
              onChange={(e) => setClimate(e.target.value)}
            />
            <TextInput
              label="地形地貌"
              placeholder="例如：万丈深渊绝壁，怪石嶙峋，悬空浮岛..."
              value={terrain}
              onChange={(e) => setTerrain(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <TextInput
              label="特产资源 / 矿产灵药"
              placeholder="例如：千年寒铁、天灵雪莲、灵石矿脉..."
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
            />
            <TextInput
              label="统治 / 占领势力"
              placeholder="例如：落雪山庄、暗月神教..."
              value={governingFaction}
              onChange={(e) => setGoverningFaction(e.target.value)}
            />
          </SimpleGrid>

          <Textarea
            label="标志性风貌与风土人情特点"
            placeholder="例如：城内全为飞檐吊桥建筑，人人佩剑，民风彪悍善战..."
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="核心剧情事件点 (在此发生的重要高潮或伏笔)"
            placeholder="例如：第12章 主角在此遭遇第一次刺杀；第45章 宗门大比擂台决战地..."
            value={plotPoints}
            onChange={(e) => setPlotPoints(e.target.value)}
            minRows={2}
          />

          <Textarea
            label="详细地理介绍与背景设定 (选填)"
            placeholder="记录关于该地点的历史渊源与传说..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
          />

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认添加地标"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
