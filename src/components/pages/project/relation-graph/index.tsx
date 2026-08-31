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
  SegmentedControl,
  Image,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiShare2,
  FiUsers,
  FiSearch,
  FiHeart,
  FiShield,
  FiRefreshCw,
} from "react-icons/fi";
import {
  CharacterRelationData,
  RelationGraphCharNode,
  getRelationGraphData,
  createCharacterRelation,
  updateCharacterRelation,
  deleteCharacterRelation,
} from "@/rest/project-extensions";
import styles from "./style.module.scss";

export default function RelationGraphPage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [relations, setRelations] = useState<CharacterRelationData[]>([]);
  const [characters, setCharacters] = useState<RelationGraphCharNode[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "graph">("graph");
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

  // 拓扑节点坐标映射 (charId -> {x, y})
  const [nodePositions, setNodePositions] = useState<Record<number, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingNodeId = useRef<number | null>(null);

  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getRelationGraphData(workId);
      if (res && res.success && res.result) {
        const rels = res.result.relations || [];
        const chars = res.result.characters || [];
        setRelations(rels);
        setCharacters(chars);

        // 自动计算初始圆形环状节点布局
        initNodePositions(chars);
      }
    } catch (e) {
      console.error("获取人物关系失败:", e);
    } finally {
      setLoading(false);
    }
  };

  const initNodePositions = (charList: RelationGraphCharNode[]) => {
    if (charList.length === 0) return;
    const centerX = 50;
    const centerY = 50;
    const radius = Math.min(36, 12 + charList.length * 4);

    const positions: Record<number, { x: number; y: number }> = {};
    charList.forEach((c, idx) => {
      const angle = (idx / charList.length) * 2 * Math.PI - Math.PI / 2;
      const x = Math.round(centerX + radius * Math.cos(angle));
      const y = Math.round(centerY + radius * Math.sin(angle));
      positions[c.id] = { x, y };
    });
    setNodePositions(positions);
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

  const handleOpenEdit = (item: CharacterRelationData) => {
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
      alert("请选择关联的角色");
      return;
    }
    if (sourceCharId === targetCharId) {
      alert("不能将角色与自身建立关联");
      return;
    }
    if (!relationType.trim()) {
      alert("请填写关系名称 (如 生死之交、同门、仇敌)");
      return;
    }

    const sourceChar = characters.find((c) => String(c.id) === sourceCharId);
    const targetChar = characters.find((c) => String(c.id) === targetCharId);

    try {
      setFormLoading(true);
      if (editingRelation) {
        await updateCharacterRelation({
          id: editingRelation.id,
          relationType: relationType.trim(),
          relationTag,
          description: description.trim(),
        });
      } else {
        await createCharacterRelation({
          workId: Number(workId),
          sourceCharId: Number(sourceCharId),
          sourceCharName: sourceChar?.name || "未知角色",
          targetCharId: Number(targetCharId),
          targetCharName: targetChar?.name || "未知角色",
          relationType: relationType.trim(),
          relationTag,
          description: description.trim(),
        });
      }
      setModalOpened(false);
      await fetchData();
    } catch (err: any) {
      alert("保存关系失败: " + err?.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("确定要删除该条人物关系吗？")) {
      const res = await deleteCharacterRelation(id);
      if (res && res.success) {
        await fetchData();
      }
    }
  };

  // 拖拽节点
  const handleNodeMouseDown = (charId: number) => {
    draggingNodeId.current = charId;
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNodeId.current === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));

    setNodePositions((prev) => ({
      ...prev,
      [draggingNodeId.current!]: { x: Math.round(x), y: Math.round(y) },
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
        return <Badge color="green" variant="light" size="xs">🤝 同盟友好</Badge>;
    }
  };

  const filteredRelations = relations.filter((r) => {
    return (
      !searchKey ||
      r.sourceCharName.toLowerCase().includes(searchKey.toLowerCase()) ||
      r.targetCharName.toLowerCase().includes(searchKey.toLowerCase()) ||
      r.relationType.toLowerCase().includes(searchKey.toLowerCase())
    );
  });

  const charOptions = characters.map((c) => ({
    value: String(c.id),
    label: `${c.name} (${c.roleType === "protagonist" ? "主角" : c.faction || "角色"})`,
  }));

  return (
    <Box className={styles.container}>
      <Flex justify="space-between" align="center" mb={16} gap={12} wrap="wrap">
        <Flex gap={12} align="center" style={{ flex: 1, maxWidth: 500 }}>
          <TextInput
            placeholder="搜索角色名或关系类型..."
            leftSection={<FiSearch size={14} />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            style={{ flex: 1 }}
          />

          <SegmentedControl
            value={viewMode}
            onChange={(v) => setViewMode(v as "table" | "graph")}
            data={[
              { label: "🕸️ 可视化图谱", value: "graph" },
              { label: "📋 关系表格", value: "table" },
            ]}
          />
        </Flex>

        <Flex gap={10}>
          <Button
            variant="default"
            leftSection={<FiRefreshCw size={13} />}
            onClick={() => initNodePositions(characters)}
          >
            重置图谱分布
          </Button>

          <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate} disabled={characters.length < 2}>
            新建角色关系
          </Button>
        </Flex>
      </Flex>

      <Box pos="relative" style={{ minHeight: 320 }}>
        <LoadingOverlay visible={loading} />

        {characters.length < 2 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiUsers size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>角色库中角色不足（当前少于 2 位）</Text>
            <Text fz={13}>请先在「世界/知识库 · 角色」中创建至少 2 个角色，即可在此建立人物关系网</Text>
          </Flex>
        ) : viewMode === "graph" ? (
          /* 视图模式 1: 交互式可视化人物关系拓扑网络 */
          <Box>
            <Flex justify="space-between" align="center" mb={6} fz={12} c="#64748b">
              <span>💡 提示：可按住角色头像自由拖拽排版；彩色连线标明了人物之间的爱恨情仇与羁绊。</span>
              <span>已建立关联：<b>{relations.length}</b> 组关系</span>
            </Flex>

            <div
              ref={canvasRef}
              className={styles.graphCanvasWrapper}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            >
              {/* SVG 连线层 */}
              <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                {relations.map((rel) => {
                  const p1 = nodePositions[rel.sourceCharId];
                  const p2 = nodePositions[rel.targetCharId];
                  if (!p1 || !p2) return null;

                  const color = getTagColor(rel.relationTag);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;

                  return (
                    <g key={rel.id}>
                      <line
                        x1={`${p1.x}%`}
                        y1={`${p1.y}%`}
                        x2={`${p2.x}%`}
                        y2={`${p2.y}%`}
                        stroke={color}
                        strokeWidth="2.5"
                        strokeDasharray={rel.relationTag === "hostile" ? "5,5" : "none"}
                        opacity="0.85"
                      />
                      {/* 连线中点的关系文字标签 */}
                      <rect
                        x={`calc(${midX}% - 34px)`}
                        y={`calc(${midY}% - 10px)`}
                        width="68"
                        height="20"
                        rx="10"
                        fill="#ffffff"
                        stroke={color}
                        strokeWidth="1.5"
                      />
                      <text
                        x={`${midX}%`}
                        y={`${midY}%`}
                        fill={color}
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {rel.relationType}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* 角色节点元素 */}
              {characters.map((c) => {
                const pos = nodePositions[c.id] || { x: 50, y: 50 };
                return (
                  <div
                    key={c.id}
                    className={styles.nodeItem}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onMouseDown={() => handleNodeMouseDown(c.id)}
                  >
                    <div className={styles.nodeAvatarCircle}>
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span>{c.name.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className={styles.nodeLabel}>
                      {c.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </Box>
        ) : (
          /* 视图模式 2: 可编辑关系表格 */
          <Paper withBorder radius="md" p="12px" bg="#ffffff">
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>角色 A</Table.Th>
                  <Table.Th>关系类型</Table.Th>
                  <Table.Th>角色 B</Table.Th>
                  <Table.Th>关系性质</Table.Th>
                  <Table.Th>关系背景渊源</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>操作</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredRelations.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Text fw={700} c="#1e293b">{r.sourceCharName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="cyan" variant="filled" size="sm">
                        {r.relationType}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={700} c="#1e293b">{r.targetCharName}</Text>
                    </Table.Td>
                    <Table.Td>{getTagBadge(r.relationTag)}</Table.Td>
                    <Table.Td>
                      <Text fz={13} c="#64748b" lineClamp={1}>
                        {r.description || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => handleOpenEdit(r)}>
                        <FiEdit size={14} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(r.id)}>
                        <FiTrash2 size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑关系 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiShare2 color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingRelation ? "编辑人物关系" : "新建人物双向/单向关系"}
            </Text>
          </Flex>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="16px">
          <SimpleGrid cols={2}>
            <Select
              label="角色 A (主体角色)"
              placeholder="选择角色"
              value={sourceCharId}
              onChange={(v) => setSourceCharId(v || "")}
              data={charOptions}
              disabled={Boolean(editingRelation)}
              required
            />

            <Select
              label="角色 B (目标角色)"
              placeholder="选择角色"
              value={targetCharId}
              onChange={(v) => setTargetCharId(v || "")}
              data={charOptions}
              disabled={Boolean(editingRelation)}
              required
            />
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <TextInput
              label="关系名称"
              placeholder="例如：生死之交、同门师兄妹、杀父仇敌、暗恋、上下级..."
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              required
            />

            <Select
              label="关系性质标签"
              value={relationTag}
              onChange={(v) => setRelationTag(v || "friendly")}
              data={[
                { value: "friendly", label: "🤝 同盟 / 挚友友好" },
                { value: "hostile", label: "⚔️ 敌对 / 仇恨宿敌" },
                { value: "romantic", label: "💖 恋爱 / 情感羁绊" },
                { value: "family", label: "🏛️ 同门 / 血亲家族" },
                { value: "neutral", label: "⚖️ 利益合作 / 中立" },
              ]}
            />
          </SimpleGrid>

          <Textarea
            label="关系前因后果与背景渊源"
            placeholder="例如：曾在三年前宗门大比时被林肆所救，暗中结下生死契约；虽阵营不同但惺惺相惜..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={4}
          />

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingRelation ? "保存修改" : "确认建立关联"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
