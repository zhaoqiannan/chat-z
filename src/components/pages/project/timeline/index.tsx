"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Text,
  Button,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Stack,
  LoadingOverlay,
  Paper,
  Timeline,
  ThemeIcon,
  Group,
  Card,
  ScrollArea,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiClock,
  FiMapPin,
  FiUsers,
  FiCalendar,
  FiStar,
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
        description: newTimelineDesc.trim() || undefined,
      });
      if (res && res.success) {
        setTimelineModalOpened(false);
        setNewTimelineTitle("");
        setNewTimelineDesc("");
        await fetchData();
      }
    } catch (e: any) {
      alert("创建失败: " + (e?.message || "网络异常"));
    }
  };

  const handleOpenCreateEvent = () => {
    if (!activeTimelineId) return;
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

  const handleOpenEditEvent = (ev: TimelineEventData) => {
    setEditingEvent(ev);
    setTimePoint(ev.timePoint || "");
    setEventTitle(ev.title);
    setLocation(ev.location || "");
    setCharacters(ev.characters || "");
    setImpactLevel(ev.impactLevel || "major");
    setDescription(ev.description || "");
    setSortOrder(ev.sortOrder || 0);
    setEventModalOpened(true);
  };

  const handleSubmitEvent = async () => {
    if (!eventTitle.trim()) {
      alert("事件名称不能为空");
      return;
    }
    if (!timePoint.trim()) {
      alert("请填写时间点");
      return;
    }

    try {
      setFormLoading(true);
      if (editingEvent) {
        await updateTimelineEvent({
          id: editingEvent.id,
          timePoint: timePoint.trim(),
          title: eventTitle.trim(),
          location: location.trim() || undefined,
          characters: characters.trim() || undefined,
          impactLevel,
          description: description.trim() || undefined,
          sortOrder,
        });
      } else {
        await createTimelineEvent({
          workId: Number(workId),
          timelineId: Number(activeTimelineId),
          timePoint: timePoint.trim(),
          title: eventTitle.trim(),
          location: location.trim() || undefined,
          characters: characters.trim() || undefined,
          impactLevel,
          description: description.trim() || undefined,
          sortOrder,
        });
      }
      setEventModalOpened(false);
      await fetchData();
    } catch (e: any) {
      alert("保存失败: " + (e?.message || "网络异常"));
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
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "climax":
        return "red";
      case "major":
        return "orange";
      case "minor":
        return "gray";
      default:
        return "cyan";
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "climax":
        return <Badge color="red" variant="filled" size="xs">🔥 核心高潮大事件</Badge>;
      case "major":
        return <Badge color="orange" variant="light" size="xs">⚡ 重大历史事件</Badge>;
      case "minor":
        return <Badge color="gray" variant="light" size="xs">🌱 背景小事</Badge>;
      default:
        return <Badge color="cyan" variant="light" size="xs">📖 主线日常推进</Badge>;
    }
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
      <ScrollArea style={{ flex: 1 }} p={{ base: "md", md: "xl" }}>
        {/* 顶部多时间线切换栏 */}
        <Group justify="space-between" align="center" mb="lg" wrap="wrap">
          <Group gap="xs" align="center" wrap="wrap">
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
          </Group>

          <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreateEvent} disabled={!activeTimelineId}>
            添加时间节点
          </Button>
        </Group>

        <Box pos="relative" style={{ minHeight: 300 }}>
          <LoadingOverlay visible={loading} />

          {currentTimelineEvents.length === 0 && !loading ? (
            <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
              <FiCalendar size={40} strokeWidth={1.2} />
              <Text fz={15} fw={600}>该时间线暂无事件节点</Text>
              <Text fz={13}>点击右上角「添加时间节点」记录小说世界的编年史或剧情推进节点</Text>
            </Stack>
          ) : (
            <Box py="md" px={{ base: 0, sm: "lg" }} style={{ maxWidth: 880, margin: "0 auto" }}>
              <Timeline active={currentTimelineEvents.length} bulletSize={28} lineWidth={2} color="cyan">
                {currentTimelineEvents.map((ev) => {
                  const color = getImpactColor(ev.impactLevel);
                  return (
                    <Timeline.Item
                      key={ev.id}
                      bullet={
                        <ThemeIcon size={26} radius="xl" color={color} variant="filled">
                          <FiStar size={13} />
                        </ThemeIcon>
                      }
                      title={
                        <Group justify="space-between" align="center" mb={4} wrap="nowrap">
                          <Group gap="xs" align="center" wrap="nowrap">
                            <Badge color="cyan" variant="outline" size="sm">
                              {ev.timePoint}
                            </Badge>
                            <Text fz={16} fw={700} c="dark.7">
                              {ev.title}
                            </Text>
                          </Group>

                          <Group gap={6} wrap="nowrap">
                            {getImpactBadge(ev.impactLevel)}
                            <ActionIcon variant="subtle" color="cyan" size="xs" onClick={() => handleOpenEditEvent(ev)}>
                              <FiEdit size={13} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" color="red" size="xs" onClick={() => handleDeleteEvent(ev.id)}>
                              <FiTrash2 size={13} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      }
                    >
                      <Card shadow="xs" radius="md" withBorder p="md" mt={6} bg="gray.0">
                        {(ev.location || ev.characters) && (
                          <Group gap="md" fz={12} c="dimmed" mb="xs" wrap="wrap">
                            {ev.location && (
                              <Group gap={4}>
                                <FiMapPin size={12} color="#06b6d4" />
                                <Text fz={12}>地点：{ev.location}</Text>
                              </Group>
                            )}
                            {ev.characters && (
                              <Group gap={4}>
                                <FiUsers size={12} color="#6366f1" />
                                <Text fz={12}>人物：{ev.characters}</Text>
                              </Group>
                            )}
                          </Group>
                        )}

                        {ev.description && (
                          <Text fz={13} c="dark.6" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                            {ev.description}
                          </Text>
                        )}
                      </Card>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            </Box>
          )}
        </Box>
      </ScrollArea>

      {/* 新建时间线 Modal */}
      <Modal
        opened={timelineModalOpened}
        onClose={() => setTimelineModalOpened(false)}
        title={<Text fw={700}>新建独立时间线</Text>}
        centered
        size="md"
        radius="md"
      >
        <Stack gap="md">
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
          <Group justify="flex-end" gap="sm" mt="sm">
            <Button variant="outline" color="gray" onClick={() => setTimelineModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" onClick={handleCreateTimeline}>确认创建</Button>
          </Group>
        </Stack>
      </Modal>

      {/* 70vw 宽屏舒适创建/编辑事件节点 Modal */}
      <Modal
        opened={eventModalOpened}
        onClose={() => setEventModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiClock color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingEvent ? `编辑时间节点 - ${editingEvent.title}` : "添加时间轴关键事件"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          <Group grow align="flex-start">
            <TextInput
              label="时间定位 / 纪年"
              placeholder="例如：神历345年春 / 灭门之夜三更"
              value={timePoint}
              onChange={(e) => setTimePoint(e.target.value)}
              required
            />
            <TextInput
              label="事件核心标题"
              placeholder="例如：青云门被围攻 / 取得诛仙古剑"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              required
            />
          </Group>

          <Group grow align="flex-start">
            <TextInput
              label="发生地点"
              placeholder="例如：万剑圣宗后山断魂崖"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <TextInput
              label="参与核心角色"
              placeholder="例如：林肆、独孤绝、九幽教众"
              value={characters}
              onChange={(e) => setCharacters(e.target.value)}
            />
            <Select
              label="事件严重程度 / 剧情权重"
              value={impactLevel}
              onChange={(val) => setImpactLevel(val || "major")}
              data={[
                { value: "climax", label: "🔥 核心高潮大事件 (决战/灭宗/渡劫)" },
                { value: "major", label: "⚡ 重大推进节点 (结盟/秘境开启)" },
                { value: "normal", label: "📖 主线常规剧情 (日常历练/偶遇)" },
                { value: "minor", label: "🌱 背景铺垫与支线插曲" },
              ]}
            />
          </Group>

          <Textarea
            label="事件详细过程与深远影响"
            placeholder="描写该事件发生的起因、交战经过、战局反转以及对后文天下大势带来的改变..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={5}
            autosize
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setEventModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmitEvent}>
              {editingEvent ? "保存修改" : "确认添加事件"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
