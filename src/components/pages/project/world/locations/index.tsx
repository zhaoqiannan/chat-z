// 组件：地理空间与地点地标设定（70vw宽度、地图画布自由拖拽保存坐标、SVG拓扑关联关系连线、主属地标层级、10行Textarea支持换行格式化）
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Flex, Text, Button, ActionIcon, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, LoadingOverlay, SegmentedControl, Paper, Group, Card, Tooltip, Badge, Switch } from "@mantine/core";
import { FiPlus, FiEdit, FiTrash2, FiMapPin, FiSearch, FiCompass, FiLayers, FiZap, FiMove, FiEye, FiEyeOff, FiCheck, FiShare2 } from "react-icons/fi";
import { LocationRecord, getLocationList, createLocation, updateLocation, deleteLocation } from "@/rest/world";
import NameGeneratorModal from "@/components/common/name-generator";

interface LocationsTabProps {
  workId: string;
}

export default function LocationsTab({ workId }: LocationsTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<LocationRecord[]>([]);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [searchKey, setSearchKey] = useState("");
  const [showRelations, setShowRelations] = useState(true);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [savingPosId, setSavingPosId] = useState<number | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragInfoRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    currentPosX: number;
    currentPosY: number;
    hasMoved: boolean;
  } | null>(null);

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

  const handleMapCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    if (dragInfoRef.current && dragInfoRef.current.hasMoved) return;

    const rect = mapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = Math.max(3, Math.min(97, Math.round((clickX / rect.width) * 100)));
    const percentY = Math.max(4, Math.min(96, Math.round((clickY / rect.height) * 100)));

    handleOpenCreate({ x: percentX, y: percentY });
  };

  const handleNodeMouseDown = (loc: LocationRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    setDraggingId(loc.id);
    dragInfoRef.current = {
      id: loc.id,
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: loc.posX || 50,
      initialPosY: loc.posY || 50,
      currentPosX: loc.posX || 50,
      currentPosY: loc.posY || 50,
      hasMoved: false,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!mapRef.current || !dragInfoRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();

      const deltaX = moveEvent.clientX - dragInfoRef.current.startX;
      const deltaY = moveEvent.clientY - dragInfoRef.current.startY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        dragInfoRef.current.hasMoved = true;
      }

      const deltaPercentX = (deltaX / rect.width) * 100;
      const deltaPercentY = (deltaY / rect.height) * 100;

      let newX = Math.round(dragInfoRef.current.initialPosX + deltaPercentX);
      let newY = Math.round(dragInfoRef.current.initialPosY + deltaPercentY);

      newX = Math.max(3, Math.min(97, newX));
      newY = Math.max(4, Math.min(96, newY));

      dragInfoRef.current.currentPosX = newX;
      dragInfoRef.current.currentPosY = newY;

      setList((prev) =>
        prev.map((item) => (item.id === loc.id ? { ...item, posX: newX, posY: newY } : item))
      );
    };

    const handleMouseUp = async () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const info = dragInfoRef.current;
      setDraggingId(null);
      dragInfoRef.current = null;

      if (info && info.hasMoved) {
        try {
          setSavingPosId(info.id);
          await updateLocation({
            id: info.id,
            posX: info.currentPosX,
            posY: info.currentPosY,
          });
          setTimeout(() => setSavingPosId(null), 1200);
        } catch (err) {
          console.error("保存位置失败:", err);
          setSavingPosId(null);
        }
      } else if (info && !info.hasMoved) {
        handleOpenDetail(loc);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
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

  const parentIdsWithChildren = new Set(
    list.filter((l) => l.parentId).map((l) => Number(l.parentId))
  );

  const activeRelationIds = new Set<number>();
  if (hoveredId) {
    activeRelationIds.add(hoveredId);
    const targetLoc = list.find((l) => l.id === hoveredId);
    if (targetLoc && targetLoc.parentId) {
      activeRelationIds.add(Number(targetLoc.parentId));
    }
    list.forEach((l) => {
      if (l.parentId === hoveredId) {
        activeRelationIds.add(l.id);
      }
    });
  }

  return (
    <Box>
      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 520 }}>
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
              { label: "地图画布", value: "map" },
              { label: "卡片列表", value: "list" },
            ]}
          />
        </Group>

        <Group gap="xs">
          {viewMode === "map" && (
            <Button
              size="xs"
              variant={showRelations ? "light" : "default"}
              color="cyan"
              leftSection={showRelations ? <FiEye size={12} /> : <FiEyeOff size={12} />}
              onClick={() => setShowRelations((v) => !v)}
            >
              {showRelations ? "关联连线: 显示" : "关联连线: 隐藏"}
            </Button>
          )}

          <Button size="xs" leftSection={<FiPlus size={13} />} color="cyan" onClick={() => handleOpenCreate()}>
            新建地点
          </Button>
        </Group>
      </Group>

      <Box pos="relative">
        <LoadingOverlay visible={loading} />

        {viewMode === "map" ? (
          <Box>
            <Flex justify="space-between" align="center" mb="xs" wrap="wrap" gap="xs">
              <Group gap="xs" align="center">
                <Text fz={12} c="#64748b">
                  💡 提示：按住地标卡片可<Text span fw={700} c="#0891b2">自由拖拽移动并自动保存坐标</Text>；在空白处单击可快速标记新地点。
                </Text>
                {savingPosId && (
                  <Badge size="xs" color="teal" variant="light" leftSection={<FiCheck size={10} />}>
                    位置已保存
                  </Badge>
                )}
              </Group>

              <Group gap="md" fz={11.5} c="#64748b">
                <Group gap={4} align="center">
                  <Box style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#0284c7" }} />
                  <Text fz={11.5}>核心主地标</Text>
                </Group>
                <Group gap={4} align="center">
                  <Box style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#06b6d4" }} />
                  <Text fz={11.5}>从属属地 / 附属地标</Text>
                </Group>
                <Text fz={11.5}>
                  总地标: <Text span fw={700} c="#0f172a">{list.length}</Text> 个
                </Text>
              </Group>
            </Flex>

            <Paper
              ref={mapRef}
              withBorder
              radius="md"
              shadow="sm"
              onClick={handleMapCanvasClick}
              style={{
                width: "100%",
                height: 580,
                backgroundColor: "#f8fafc",
                position: "relative",
                overflow: "hidden",
                cursor: "crosshair",
                backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 1.2px, transparent 0)`,
                backgroundSize: "28px 28px",
                userSelect: "none",
              }}
            >
              {/* SVG 拓扑关联关系连线层 */}
              {showRelations && (
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                >
                  <defs>
                    <linearGradient id="rel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
                    </linearGradient>
                    <linearGradient id="rel-gradient-active" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="1" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
                    </linearGradient>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="18"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" opacity="0.85" />
                    </marker>
                    <marker
                      id="arrow-active"
                      viewBox="0 0 10 10"
                      refX="18"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
                    </marker>
                  </defs>

                  {filteredList.map((loc) => {
                    if (!loc.parentId) return null;
                    const parentLoc = list.find((p) => p.id === loc.parentId);
                    if (!parentLoc) return null;

                    const isHighlighted =
                      hoveredId &&
                      (hoveredId === loc.id ||
                        hoveredId === parentLoc.id ||
                        activeRelationIds.has(loc.id));
                    const isFaded = hoveredId && !isHighlighted;

                    const x1 = `${parentLoc.posX || 50}%`;
                    const y1 = `${parentLoc.posY || 50}%`;
                    const x2 = `${loc.posX || 50}%`;
                    const y2 = `${loc.posY || 50}%`;

                    const px1 = parentLoc.posX || 50;
                    const py1 = parentLoc.posY || 50;
                    const px2 = loc.posX || 50;
                    const py2 = loc.posY || 50;
                    const cx = (px1 + px2) / 2;
                    const cy = (py1 + py2) / 2 + (px2 > px1 ? -3 : 3);

                    return (
                      <g key={`rel-${parentLoc.id}-${loc.id}`} style={{ transition: "opacity 0.2s ease", opacity: isFaded ? 0.18 : 1 }}>
                        <path
                          d={`M ${px1} ${py1} Q ${cx} ${cy} ${px2} ${py2}`}
                          fill="none"
                          stroke={isHighlighted ? "url(#rel-gradient-active)" : "url(#rel-gradient)"}
                          strokeWidth={isHighlighted ? 2.5 : 1.8}
                          strokeDasharray={isHighlighted ? "none" : "5,4"}
                          markerEnd={isHighlighted ? "url(#arrow-active)" : "url(#arrow)"}
                        />
                        {/* 连线中点关系徽标 */}
                        <circle cx={`${cx}%`} cy={`${cy}%`} r={isHighlighted ? 4 : 3} fill={isHighlighted ? "#0284c7" : "#06b6d4"} />
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* 地标节点 */}
              {filteredList.map((loc) => {
                const isParentCore = parentIdsWithChildren.has(loc.id) || !loc.parentId;
                const isDragging = draggingId === loc.id;
                const isHighlighted =
                  hoveredId &&
                  (hoveredId === loc.id || activeRelationIds.has(loc.id));
                const isFaded = hoveredId && !isHighlighted;

                return (
                  <Box
                    key={loc.id}
                    onMouseDown={(e) => handleNodeMouseDown(loc, e)}
                    onMouseEnter={() => setHoveredId(loc.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      position: "absolute",
                      left: `${loc.posX || 50}%`,
                      top: `${loc.posY || 50}%`,
                      transform: `translate(-50%, -50%) scale(${isDragging ? 1.08 : isHighlighted ? 1.04 : 1})`,
                      cursor: isDragging ? "grabbing" : "grab",
                      zIndex: isDragging ? 30 : isHighlighted ? 25 : isParentCore ? 15 : 10,
                      transition: isDragging ? "none" : "transform 0.15s ease, opacity 0.2s ease",
                      opacity: isFaded ? 0.35 : 1,
                    }}
                  >
                    <Paper
                      shadow={isDragging ? "lg" : isHighlighted ? "md" : "xs"}
                      radius="sm"
                      withBorder
                      px={10}
                      py={6}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        backgroundColor: isParentCore ? "#f0f9ff" : "#ffffff",
                        borderColor: isDragging
                          ? "#0284c7"
                          : isHighlighted
                          ? "#0284c7"
                          : isParentCore
                          ? "#38bdf8"
                          : "#06b6d4",
                        borderWidth: isParentCore || isHighlighted ? 2 : 1.5,
                        boxShadow: isHighlighted ? "0 4px 14px rgba(2, 132, 199, 0.25)" : undefined,
                      }}
                    >
                      <FiMapPin
                        size={isParentCore ? 15 : 13}
                        color={isParentCore ? "#0284c7" : "#06b6d4"}
                      />

                      <Box style={{ textAlign: "left" }}>
                        <Flex align="center" gap={4}>
                          <Text
                            fz={isParentCore ? 12.5 : 12}
                            fw={isParentCore ? 800 : 700}
                            c={isParentCore ? "#0369a1" : "#1e293b"}
                          >
                            {loc.name}
                          </Text>
                          {loc.alias && (
                            <Text fz={10.5} c="#64748b">
                              ({loc.alias})
                            </Text>
                          )}
                        </Flex>

                        {loc.parentName ? (
                          <Flex align="center" gap={2} mt={1}>
                            <FiShare2 size={9} color="#0891b2" />
                            <Text fz={9.5} c="#0891b2" fw={500}>
                              隶属: {loc.parentName}
                            </Text>
                          </Flex>
                        ) : parentIdsWithChildren.has(loc.id) ? (
                          <Text fz={9.5} c="#0284c7" fw={600} mt={1}>
                            🏛️ 核心主域
                          </Text>
                        ) : null}
                      </Box>

                      <Group gap={2} ml={4} onClick={(e) => e.stopPropagation()}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={(e) => handleOpenEdit(loc, e)}
                          title="编辑地点"
                        >
                          <FiEdit size={11} />
                        </ActionIcon>
                      </Group>
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
