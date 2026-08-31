"use client";

import React, { useState, useEffect } from "react";
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
  Paper,
  Tabs,
  Group,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiClock,
  FiMapPin,
  FiUsers,
  FiZap,
  FiCalendar,
} from "react-icons/fi";
import {
  TimelineData,
  TimelineEventData,
  getTimelineFullData,
  createTimeline,
  createTimelineEvent,
  updateTimeline,
  updateTimelineEvent,
  deleteTimeline,
  deleteTimelineEvent,
} from "@/rest/project-extensions";
import styles from "./style.module.scss";

export default function TimelinePage() {
  const params = useParams();
  const workId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [timelines, setTimelines] = useState<TimelineData[]>([]);
  const [events, setEvents] = useState<TimelineEventData[]>([]);
  const [activeTimelineId, setActiveTimelineId] = useState<string>("");

  // 新建时间线 Modal
  const [timelineModalOpened, setTimelineModalOpened] = useState(false);
  const [newTimelineTitle, setNewTimelineTitle] = useState("");
  const [newTimelineDesc, setNewTimelineDesc] = useState("");

  // 事件节点 Modal
  const [eventModalOpened, setEventModalOpened] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEventData | null>(null);
  const [timePoint, setTimePoint] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [location, setLocation] = useState("");
  const [characters, setCharacters] = useState("");
  const [impactLevel, setImpactLevel] = useState("major");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [formLoading, setFormLoading] = useState(false);

  const fetchData = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getTimelineFullData(workId);
      if (res && res.success && res.result) {
        const tls = res.result.timelines || [];
        setTimelines(tls);
        setEvents(res.result.events || []);
        if (tls.length > 0 && !activeTimelineId) {
          setActiveTimelineId(String(tls[0].id));
        }
      }
    } catch (e) {
      console.error("获取时间线数据失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workId]);

  const handleCreateTimeline = async () => {
    if (!newTimelineTitle.trim()) {
      alert("时间线名称不能为空");
      return;
    }
    try {
      const res = await createTimeline({
        workId: Number(workId),
        title: newTimelineTitle.trim(),
        description: newTimelineDesc.trim(),
      });
      if (res && res.success && res.result) {
        setTimelineModalOpened(false);
        setNewTimelineTitle("");
        setNewTimelineDesc("");
        await fetchData();
        setActiveTimelineId(String(res.result.id));
      }
    } catch (err: any) {
      alert("创建时间线失败: " + err?.message);
    }
  };

  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setTimePoint("");
    setEventTitle("");
    setLocation("");
    setCharacters("");
    setImpactLevel("major");
    setDescription("");
    setSortOrder(events.filter((e) => String(e.timelineId) === activeTimelineId).length + 1);
    setEventModalOpened(true);
  };

  const handleOpenEditEvent = (item: TimelineEventData) => {
    setEditingEvent(item);
    setTimePoint(item.timePoint || "");
    setEventTitle(item.title || "");
    setLocation(item.location || "");
    setCharacters(item.characters || "");
    setImpactLevel(item.impactLevel || "major");
    setDescription(item.description || "");
    setSortOrder(item.sortOrder || 0);
    setEventModalOpened(true);
  };

  const handleSubmitEvent = async () => {
    if (!timePoint.trim() || !eventTitle.trim()) {
      alert("时间点与事件标题不能为空");
      return;
    }
    try {
      setFormLoading(true);
      if (editingEvent) {
        await updateTimelineEvent({
          id: editingEvent.id,
          timePoint: timePoint.trim(),
          title: eventTitle.trim(),
          location,
          characters,
          impactLevel,
          description,
          sortOrder,
        });
      } else {
        await createTimelineEvent({
          timelineId: Number(activeTimelineId),
          workId: Number(workId),
          timePoint: timePoint.trim(),
          title: eventTitle.trim(),
          location,
          characters,
          impactLevel,
          description,
          sortOrder,
        });
      }
      setEventModalOpened(false);
      await fetchData();
    } catch (err: any) {
      alert("保存事件节点失败: " + err?.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (confirm("确定要删除该时间节点吗？")) {
      const res = await deleteTimelineEvent(id);
      if (res && res.success) {
        await fetchData();
      }
    }
  };

  const currentTimelineEvents = events
    .filter((e) => String(e.timelineId) === activeTimelineId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const getImpactBadge = (lvl: string) => {
    switch (lvl) {
      case "climax":
        return <Badge color="red" variant="filled" size="xs">💥 核心转折高潮</Badge>;
      case "major":
        return <Badge color="orange" variant="light" size="xs">⚡ 重大历史事件</Badge>;
      case "minor":
        return <Badge color="gray" variant="light" size="xs">🌱 背景小事</Badge>;
      default:
        return <Badge color="cyan" variant="light" size="xs">📖 主线日常推进</Badge>;
    }
  };

  return (
    <Box className={styles.container}>
      {/* 顶部多时间线切换栏 */}
      <Flex justify="space-between" align="center" mb={20} gap={12} wrap="wrap">
        <Flex gap={10} align="center" wrap="wrap">
          {timelines.map((tl) => (
            <Button
              key={tl.id}
              size="sm"
              variant={activeTimelineId === String(tl.id) ? "filled" : "default"}
              color="cyan"
              leftSection={<FiClock size={13} />}
              onClick={() => setActiveTimelineId(String(tl.id))}
            >
              {tl.title}
            </Button>
          ))}

          <Button
            size="sm"
            variant="light"
            color="indigo"
            leftSection={<FiPlus size={13} />}
            onClick={() => setTimelineModalOpened(true)}
          >
            新建时间线
          </Button>
        </Flex>

        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreateEvent} disabled={!activeTimelineId}>
          添加时间节点
        </Button>
      </Flex>

      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {currentTimelineEvents.length === 0 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiCalendar size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>该时间线暂无事件节点</Text>
            <Text fz={13}>点击右上角「添加时间节点」记录小说世界的编年史或剧情推进节点</Text>
          </Flex>
        ) : (
          <div className={styles.timelineTrack}>
            {currentTimelineEvents.map((ev) => (
              <div
                key={ev.id}
                className={`${styles.timelineNode} ${styles[ev.impactLevel] || ""}`}
              >
                <div className={styles.eventCard}>
                  <Flex justify="space-between" align="center" mb={6}>
                    <Flex align="center" gap={8}>
                      <Badge color="blue" variant="outline" size="sm">
                        {ev.timePoint}
                      </Badge>
                      <Text fz={16} fw={700} c="#1e293b">
                        {ev.title}
                      </Text>
                    </Flex>

                    <Flex align="center" gap={6}>
                      {getImpactBadge(ev.impactLevel)}
                      <ActionIcon variant="subtle" color="blue" size="xs" onClick={() => handleOpenEditEvent(ev)}>
                        <FiEdit size={13} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" size="xs" onClick={() => handleDeleteEvent(ev.id)}>
                        <FiTrash2 size={13} />
                      </ActionIcon>
                    </Flex>
                  </Flex>

                  <Flex gap={16} fz={12} c="#64748b" mb={8} wrap="wrap">
                    {ev.location && (
                      <Flex align="center" gap={4}>
                        <FiMapPin size={12} color="#00c9ff" />
                        <span>地点：{ev.location}</span>
                      </Flex>
                    )}
                    {ev.characters && (
                      <Flex align="center" gap={4}>
                        <FiUsers size={12} color="#8b5cf6" />
                        <span>人物：{ev.characters}</span>
                      </Flex>
                    )}
                  </Flex>

                  {ev.description && (
                    <Text fz={13} c="#334155" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {ev.description}
                    </Text>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Box>

      {/* 新建时间线 Modal */}
      <Modal
        opened={timelineModalOpened}
        onClose={() => setTimelineModalOpened(false)}
        title={<Text fw={700}>新建独立时间线</Text>}
        centered
        size="md"
        radius="md"
      >
        <Stack gap="14px">
          <TextInput
            label="时间线名称"
            placeholder="例如：上古诸神之战 / 主角成长与历练线"
            value={newTimelineTitle}
            onChange={(e) => setNewTimelineTitle(e.target.value)}
            required
          />
          <Textarea
            label="时间线描述 (选填)"
            placeholder="简要说明该时间线所记录的背景范围..."
            value={newTimelineDesc}
            onChange={(e) => setNewTimelineDesc(e.target.value)}
          />
          <Flex justify="flex-end" gap={10} mt={8}>
            <Button variant="outline" color="gray" onClick={() => setTimelineModalOpened(false)}>
              取消
            </Button>
            <Button onClick={handleCreateTimeline}>确认创建</Button>
          </Flex>
        </Stack>
      </Modal>

      {/* 70vw 宽屏舒适创建/编辑事件节点 Modal */}
      <Modal
        opened={eventModalOpened}
        onClose={() => setEventModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiClock color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingEvent ? `编辑时间节点 - ${editingEvent.title}` : "添加时间轴关键事件"}
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
              label="时间点描述"
              placeholder="例如：天元历 320 年 / 宗门大比第 3 天清晨"
              value={timePoint}
              onChange={(e) => setTimePoint(e.target.value)}
              required
            />

            <TextInput
              label="事件标题"
              placeholder="例如：万剑圣宗遭逢巨变，剑皇陨落"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              required
              style={{ gridColumn: "span 2" }}
            />
          </SimpleGrid>

          <SimpleGrid cols={3}>
            <TextInput
              label="发生地点"
              placeholder="例如：天南落雪峰"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <TextInput
              label="涉及主要人物"
              placeholder="例如：林肆、剑皇独孤绝、暗夜刺客"
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
            />

            <Select
              label="影响级别与性质"
              value={impactLevel}
              onChange={(val) => setImpactLevel(val || "major")}
              data={[
                { value: "climax", label: "💥 核心转折高潮" },
                { value: "major", label: "⚡ 重大历史事件" },
                { value: "normal", label: "📖 主线日常推进" },
                { value: "minor", label: "🌱 背景小事伏笔" },
              ]}
            />
          </SimpleGrid>

          <Textarea
            label="详细事件经过与前因后果"
            placeholder="详细记录事件的爆发过程、对后续主线剧情带来的深远影响与人物命运转变..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={5}
          />

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setEventModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmitEvent}>
              {editingEvent ? "保存修改" : "确认添加节点"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
