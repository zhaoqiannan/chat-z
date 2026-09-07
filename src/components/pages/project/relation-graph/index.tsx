// 组件：人物关系图谱系统（图谱可视化画布与关系表格双Tab切换，拖拽排版与多维羁绊管理）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
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
  Table,
  Paper,
  Tabs,
  Avatar,
  Group,
  ScrollArea,
  Tooltip,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiShare2,
  FiUsers,
  FiSearch,
  FiRefreshCw,
  FiArrowRight,
} from "react-icons/fi";
import {
  CharacterRelationData,
  RelationGraphCharNode,
  getRelationGraphData,
  createCharacterRelation,
  updateCharacterRelation,
  deleteCharacterRelation,
} from "@/rest/project-extensions";

export default function RelationGraphPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [relations, setRelations] = useState<CharacterRelationData[]>([]);
  const [characters, setCharacters] = useState<RelationGraphCharNode[]>([]);
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [searchKey, setSearchKey] = useState("");

  // Modal 状态
  const [modalOpened, setModalOpened] = useState(false);
  const [editingRelation, setEditingRelation] = useState<CharacterRelationData | null>(null);
  const [sourceCharId, setSourceCharId] = useState<string>("");
  const [targetCharId, setTargetCharId] = useState<string>("");
  const [relationType, setRelationType] = useState("");
  const [relationTag, setRelationTag] = useState("friendly");
  const [description, setDescription] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // 拓扑图节点绝对坐标 (百分比: 0~100)
  const [nodePositions, setNodePositions] = useState<Record<string | number, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingNodeId = useRef<number | null>(null);
  const [hoveredRelId, setHoveredRelId] = useState<number | null>(null);
  const [hoveredCharId, setHoveredCharId] = useState<number | null>(null);

  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getRelationGraphData(workId);
      if (res && res.success && res.result) {
        const chars = res.result.characters || [];
        const rels = res.result.relations || [];
        setCharacters(chars);
        setRelations(rels);
        initNodePositions(chars);
      }
    } catch (e) {
      console.error("获取人物关系图谱失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const initNodePositions = (chars: RelationGraphCharNode[]) => {
    const total = chars.length;
    if (total === 0) return;

    const newPos: Record<string | number, { x: number; y: number }> = {};
    const radius = 36; // 环形半径 %
    const centerX = 50;
    const centerY = 50;

    chars.forEach((c, idx) => {
      let x = 50;
      let y = 50;
      if (total > 1) {
        const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
        x = Math.round(centerX + radius * Math.cos(angle));
        y = Math.round(centerY + radius * Math.sin(angle));
      }
      newPos[c.id] = { x, y };
      newPos[String(c.id)] = { x, y };
      newPos[Number(c.id)] = { x, y };
    });

    setNodePositions(newPos);
  };

  useEffect(() => {
    fetchData();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingRelation(null);
    setSourceCharId(characters[0] ? String(characters[0].id) : "");
    setTargetCharId(characters[1] ? String(characters[1].id) : "");
    setRelationType("");
    setRelationTag("friendly");
    setDescription("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: CharacterRelationData, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRelation(item);
    setSourceCharId(String(item.sourceCharId));
    setTargetCharId(String(item.targetCharId));
    setRelationType(item.relationType);
    setRelationTag(item.relationTag || "friendly");
    setDescription(item.description || "");
    setModalOpened(true);
  };

  const handleSubmit = async () => {
    if (!sourceCharId || !targetCharId) {
      alert("请选择关联的两个角色！");
      return;
    }
    if (sourceCharId === targetCharId) {
      alert("角色不能与自己建立关联关系！");
      return;
    }
    if (!relationType.trim()) {
      alert("请输入关系名称！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingRelation) {
        await updateCharacterRelation({
          id: editingRelation.id,
          relationType: relationType.trim(),
          relationTag,
          description: description.trim() || undefined,
        });
      } else {
        const sChar = characters.find((c) => String(c.id) === String(sourceCharId));
        const tChar = characters.find((c) => String(c.id) === String(targetCharId));
        await createCharacterRelation({
          workId: Number(workId),
          sourceCharId: Number(sourceCharId),
          sourceCharName: sChar?.name || `角色${sourceCharId}`,
          targetCharId: Number(targetCharId),
          targetCharName: tChar?.name || `角色${targetCharId}`,
          relationType: relationType.trim(),
          relationTag,
          description: description.trim() || undefined,
        });
      }
      setModalOpened(false);
      await fetchData();
    } catch (e: any) {
      alert("保存关系失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("确定要删除此条人物关系吗？此操作不可撤销。")) {
      const res = await deleteCharacterRelation(id);
      if (res && res.success) {
        await fetchData();
      }
    }
  };

  // 拖拽人物节点逻辑
  const handleNodeMouseDown = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    draggingNodeId.current = id;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNodeId.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 5), 95);
    const y = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 5), 95);

    const targetId = draggingNodeId.current;
    setNodePositions((prev) => ({
      ...prev,
      [targetId]: { x: Math.round(x), y: Math.round(y) },
      [String(targetId)]: { x: Math.round(x), y: Math.round(y) },
      [Number(targetId)]: { x: Math.round(x), y: Math.round(y) },
    }));
  };

  const handleCanvasMouseUp = () => {
    draggingNodeId.current = null;
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case "hostile":
        return "#ef4444"; // 敌对 红色
      case "romantic":
        return "#ec4899"; // 恋爱 粉色
      case "family":
        return "#6366f1"; // 同门/血亲 靛蓝
      case "neutral":
        return "#64748b"; // 中立 灰色
      default:
        return "#10b981"; // 友好/同盟 绿色
    }
  };

  const getTagBadge = (tag: string) => {
    switch (tag) {
      case "hostile":
        return <Badge color="red" variant="light" size="xs">⚔️ 敌对仇恨</Badge>;
      case "romantic":
        return <Badge color="pink" variant="light" size="xs">💖 恋爱羁绊</Badge>;
      case "family":
        return <Badge color="indigo" variant="light" size="xs">🏛️ 同门血亲</Badge>;
      case "neutral":
        return <Badge color="gray" variant="light" size="xs">⚖️ 利益中立</Badge>;
      default:
        return <Badge color="teal" variant="light" size="xs">🤝 同盟友好</Badge>;
    }
  };

  const filteredRelations = relations.filter((r) => {
    return (
      !searchKey ||
      (r.sourceCharName && r.sourceCharName.toLowerCase().includes(searchKey.toLowerCase())) ||
      (r.targetCharName && r.targetCharName.toLowerCase().includes(searchKey.toLowerCase())) ||
      (r.relationType && r.relationType.toLowerCase().includes(searchKey.toLowerCase()))
    );
  });

  const charOptions = characters.map((c) => ({
    value: String(c.id),
    label: `${c.name} (${c.roleType === "protagonist" ? "主角" : c.faction || "角色"})`,
  }));

  // 获取安全节点坐标
  const getNodePos = (id: number | string) => {
    if (nodePositions[id]) return nodePositions[id];
    if (nodePositions[Number(id)]) return nodePositions[Number(id)];
    if (nodePositions[String(id)]) return nodePositions[String(id)];
    return { x: 50, y: 50 };
  };

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <ScrollArea style={{ flex: 1 }} p={{ base: "md", md: "lg" }}>
        {/* Mantine Tabs 切换组件 */}
        <Tabs
          value={viewMode}
          onChange={(v) => setViewMode((v as "graph" | "table") || "graph")}
          variant="outline"
          radius="sm"
        >
          {/* 头部 Tab 与控制栏 */}
          <Flex justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
            <Tabs.List>
              <Tabs.Tab value="graph" leftSection={<FiShare2 size={13} />}>
                图谱可视化
              </Tabs.Tab>
              <Tabs.Tab value="table" leftSection={<FiUsers size={13} />}>
                关系列表
              </Tabs.Tab>
            </Tabs.List>

            <Group gap="xs">
              {viewMode === "table" && (
                <TextInput
                  placeholder="搜索角色名或关系类型..."
                  leftSection={<FiSearch size={14} />}
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  style={{ width: 260 }}
                  size="xs"
                />
              )}

              {viewMode === "graph" && (
                <Button
                  variant="default"
                  size="xs"
                  leftSection={<FiRefreshCw size={12} />}
                  onClick={() => initNodePositions(characters)}
                >
                  重置布局
                </Button>
              )}

              <Button
                size="xs"
                leftSection={<FiPlus size={13} />}

                onClick={handleOpenCreate}
                disabled={characters.length < 2}
              >
                新建人物关系
              </Button>
            </Group>
          </Flex>

          <Box pos="relative" style={{ minHeight: 360 }}>
            <LoadingOverlay visible={loading} />

            {characters.length < 2 && !loading ? (
              <Paper p="xl" withBorder radius="sm" ta="center" c="#94a3b8" bg="#ffffff">
                <FiUsers size={40} strokeWidth={1.2} style={{ marginBottom: 8 }} />
                <Text fz={15} fw={700} c="#1e293b">角色库中角色不足（当前少于 2 位）</Text>
                <Text fz={13} mt={4}>请先在「世界设定 · 角色」中创建至少 2 个角色，即可在此建立人物关系网</Text>
              </Paper>
            ) : (
              <>
                {/* 视图模式 1: 交互式可视化人物关系拓扑网络 */}
                <Tabs.Panel value="graph">
                  <Box>
                    <Flex justify="space-between" align="center" mb="xs" fz={12} c="#64748b">
                      <Text fz={12}>💡 提示：按住头像可<Text span fw={700} c="#0891b2">自由拖拽排版</Text>；连线与标记卡片直观显示人物羁绊类型与指向，点击标记可快速编辑。</Text>
                      <Text fz={12}>已建立关系：<Text span fw={700} c="#0f172a">{relations.length}</Text> 组</Text>
                    </Flex>

                    <Paper
                      ref={canvasRef}
                      withBorder
                      radius="md"
                      shadow="xs"
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      style={{
                        width: "100%",
                        height: "calc(100vh - 240px)",
                        minHeight: 560,
                        backgroundColor: "#f8fafc",
                        position: "relative",
                        overflow: "hidden",
                        backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 1.2px, transparent 0)`,
                        backgroundSize: "28px 28px",
                        userSelect: "none",
                      }}
                    >
                      {/* SVG 连线层 */}
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
                          <marker
                            id="rel-arrow-green"
                            viewBox="0 0 10 10"
                            refX="22"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                          </marker>
                          <marker
                            id="rel-arrow-red"
                            viewBox="0 0 10 10"
                            refX="22"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                          </marker>
                          <marker
                            id="rel-arrow-pink"
                            viewBox="0 0 10 10"
                            refX="22"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#ec4899" />
                          </marker>
                          <marker
                            id="rel-arrow-indigo"
                            viewBox="0 0 10 10"
                            refX="22"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                          </marker>
                          <marker
                            id="rel-arrow-gray"
                            viewBox="0 0 10 10"
                            refX="22"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                          </marker>
                        </defs>

                        {relations.map((rel) => {
                          const sPos = getNodePos(rel.sourceCharId);
                          const tPos = getNodePos(rel.targetCharId);
                          const color = getTagColor(rel.relationTag || "friendly");

                          let markerId = "rel-arrow-green";
                          if (rel.relationTag === "hostile") markerId = "rel-arrow-red";
                          if (rel.relationTag === "romantic") markerId = "rel-arrow-pink";
                          if (rel.relationTag === "family") markerId = "rel-arrow-indigo";
                          if (rel.relationTag === "neutral") markerId = "rel-arrow-gray";

                          const isHighlighted =
                            hoveredRelId === rel.id ||
                            hoveredCharId === Number(rel.sourceCharId) ||
                            hoveredCharId === Number(rel.targetCharId);

                          return (
                            <g key={rel.id} style={{ opacity: hoveredCharId && !isHighlighted ? 0.25 : 1, transition: "opacity 0.2s" }}>
                              <line
                                x1={`${sPos.x}%`}
                                y1={`${sPos.y}%`}
                                x2={`${tPos.x}%`}
                                y2={`${tPos.y}%`}
                                stroke={color}
                                strokeWidth={isHighlighted ? 3 : 2}
                                strokeDasharray={rel.relationTag === "neutral" ? "5,5" : "none"}
                                markerEnd={`url(#${markerId})`}
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* 关系连线居中文字标签卡片 (HTML 绝对定位层，保证 100% 渲染且可点击) */}
                      {relations.map((rel) => {
                        const sPos = getNodePos(rel.sourceCharId);
                        const tPos = getNodePos(rel.targetCharId);
                        const midX = (sPos.x + tPos.x) / 2;
                        const midY = (sPos.y + tPos.y) / 2;
                        const color = getTagColor(rel.relationTag || "friendly");
                        const isHighlighted =
                          hoveredRelId === rel.id ||
                          hoveredCharId === Number(rel.sourceCharId) ||
                          hoveredCharId === Number(rel.targetCharId);

                        return (
                          <Box
                            key={`badge-${rel.id}`}
                            onMouseEnter={() => setHoveredRelId(rel.id)}
                            onMouseLeave={() => setHoveredRelId(null)}
                            onClick={(e) => handleOpenEdit(rel, e)}
                            style={{
                              position: "absolute",
                              left: `${midX}%`,
                              top: `${midY}%`,
                              transform: `translate(-50%, -50%) scale(${isHighlighted ? 1.08 : 1})`,
                              zIndex: isHighlighted ? 25 : 12,
                              cursor: "pointer",
                              transition: "transform 0.15s ease, opacity 0.2s ease",
                              opacity: hoveredCharId && !isHighlighted ? 0.3 : 1,
                            }}
                          >
                            <Tooltip
                              label={`${rel.sourceCharName} ➔ ${rel.targetCharName}：${rel.relationType}${rel.description ? ` (${rel.description})` : ""} [点击编辑]`}
                              position="top"
                              withArrow
                              fz={11}
                            >
                              <Paper
                                px={8}
                                py={2}
                                radius="xl"
                                withBorder
                                shadow={isHighlighted ? "md" : "xs"}
                                style={{
                                  backgroundColor: "#ffffff",
                                  borderColor: color,
                                  borderWidth: isHighlighted ? 2 : 1.5,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  whiteSpace: "nowrap",
                                  boxShadow: isHighlighted ? `0 4px 12px ${color}33` : "0 2px 5px rgba(0,0,0,0.06)",
                                }}
                              >
                                <Text fz={11} fw={700} c={color}>
                                  {rel.relationType}
                                </Text>
                              </Paper>
                            </Tooltip>
                          </Box>
                        );
                      })}

                      {/* 节点层 (角色卡片) */}
                      {characters.map((c) => {
                        const pos = getNodePos(c.id);
                        const isMain = c.roleType === "protagonist";
                        const isHovered = hoveredCharId === c.id;

                        return (
                          <Box
                            key={c.id}
                            onMouseDown={(e) => handleNodeMouseDown(c.id, e)}
                            onMouseEnter={() => setHoveredCharId(c.id)}
                            onMouseLeave={() => setHoveredCharId(null)}
                            style={{
                              position: "absolute",
                              left: `${pos.x}%`,
                              top: `${pos.y}%`,
                              transform: `translate(-50%, -50%) scale(${isHovered ? 1.05 : 1})`,
                              cursor: "grab",
                              zIndex: isHovered ? 30 : 15,
                              transition: "transform 0.15s ease",
                            }}
                          >
                            <Paper
                              p="6px 12px"
                              radius="md"
                              withBorder
                              shadow={isHovered ? "md" : "xs"}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                backgroundColor: isMain ? "#f0fdf4" : "#ffffff",
                                borderColor: isHovered ? "#0284c7" : isMain ? "#22c55e" : "#e2e8f0",
                                borderWidth: isMain || isHovered ? 2 : 1,
                                boxShadow: isHovered ? "0 4px 14px rgba(2, 132, 199, 0.2)" : undefined,
                              }}
                            >
                              <Avatar
                                src={c.avatarUrl}
                                radius="xl"
                                size="sm"
                                color={isMain ? "teal" : "cyan"}
                              >
                                {c.name.slice(0, 1)}
                              </Avatar>
                              <Box>
                                <Text fz={12.5} fw={700} c="#0f172a" lineClamp={1}>
                                  {c.name}
                                </Text>
                                <Text fz={10} c="#64748b" lineClamp={1}>
                                  {c.faction || (isMain ? "主角" : "角色")}
                                </Text>
                              </Box>
                            </Paper>
                          </Box>
                        );
                      })}
                    </Paper>
                  </Box>
                </Tabs.Panel>

                {/* 视图模式 2: 关系表格明细 */}
                <Tabs.Panel value="table">
                  <Paper withBorder radius="sm" bg="#ffffff" style={{ overflow: "hidden", borderColor: "#e2e8f0" }}>
                    <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover striped>
                      <Table.Thead bg="#f8fafc">
                        <Table.Tr>
                          <Table.Th style={{ width: "20%", minWidth: 140, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            主体角色
                          </Table.Th>
                          <Table.Th style={{ width: "20%", minWidth: 140, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            目标角色
                          </Table.Th>
                          <Table.Th style={{ width: "16%", minWidth: 120, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            关系类型
                          </Table.Th>
                          <Table.Th style={{ width: "14%", minWidth: 100, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            羁绊属性
                          </Table.Th>
                          <Table.Th style={{ width: "20%", minWidth: 160, fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            关系背景渊源
                          </Table.Th>
                          <Table.Th style={{ width: "10%", minWidth: 80, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
                            操作
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredRelations.map((r) => (
                          <Table.Tr key={r.id}>
                            <Table.Td>
                              <Group gap={6}>
                                <Avatar size="xs" radius="xl" >
                                  {r.sourceCharName.slice(0, 1)}
                                </Avatar>
                                <Text fz={13} fw={700} c="#0f172a">
                                  {r.sourceCharName}
                                </Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={6}>
                                <Avatar size="xs" radius="xl" color="blue">
                                  {r.targetCharName.slice(0, 1)}
                                </Avatar>
                                <Text fz={13} fw={700} c="#0f172a">
                                  {r.targetCharName}
                                </Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="outline">
                                {r.relationType}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{getTagBadge(r.relationTag || "friendly")}</Table.Td>
                            <Table.Td>
                              <Text fz={12} c="#64748b" lineClamp={2}>
                                {r.description || "—"}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: "right" }}>
                              <Group gap={4} justify="flex-end" wrap="nowrap">
                                <ActionIcon size="sm" variant="subtle" onClick={(e) => handleOpenEdit(r, e)} title="编辑">
                                  <FiEdit size={13} />
                                </ActionIcon>
                                <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => handleDelete(r.id, e)} title="删除">
                                  <FiTrash2 size={13} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        ))}

                        {filteredRelations.length === 0 && !loading && (
                          <Table.Tr>
                            <Table.Td colSpan={6} style={{ textAlign: "center", padding: "36px 0", color: "#94a3b8" }}>
                              <Text fz={13}>
                                {searchKey ? "未找到符合条件的人物关系" : "暂无建立的角色关系网络"}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Tabs.Panel>
              </>
            )}
          </Box>
        </Tabs>
      </ScrollArea>

      {/* 新建/编辑关系 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={700} fz={15} c="#0f172a">{editingRelation ? "编辑人物关系" : "新建人物关系"}</Text>}
        centered
        radius="sm"
        size="md"
        styles={{
          header: { borderBottom: "1px solid #f1f5f9", padding: "12px 20px" },
          body: { padding: "16px 20px" },
        }}
      >
        <Stack gap="sm">
          {!editingRelation && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <Select
                label="主体角色 A"
                placeholder="请选择主体角色"
                data={charOptions}
                value={sourceCharId}
                onChange={(val) => setSourceCharId(val || "")}
                required
                size="xs"
              />
              <Select
                label="目标角色 B"
                placeholder="请选择目标角色"
                data={charOptions}
                value={targetCharId}
                onChange={(val) => setTargetCharId(val || "")}
                required
                size="xs"
              />
            </SimpleGrid>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <TextInput
              label="关系名称"
              placeholder="如：同门师兄妹、生死宿敌、青梅竹马"
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              required
              size="xs"
            />
            <Select
              label="羁绊性质"
              value={relationTag}
              onChange={(val) => setRelationTag(val || "friendly")}
              data={[
                { value: "friendly", label: "🤝 同盟友好" },
                { value: "hostile", label: "⚔️ 敌对仇恨" },
                { value: "romantic", label: "💖 恋爱羁绊" },
                { value: "family", label: "🏛️ 同门血亲" },
                { value: "neutral", label: "⚖️ 利益中立" },
              ]}
              size="xs"
            />
          </SimpleGrid>

          <Textarea
            label="关系渊源与背景描述"
            placeholder="说明两人结识缘由、过往恩怨或互动模式..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={4}
            size="xs"
            autosize
          />

          <Flex justify="flex-end" gap="xs" mt="xs" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
            <Button variant="default" size="xs" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button size="xs" onClick={handleSubmit} loading={formLoading}>
              保存关系
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
