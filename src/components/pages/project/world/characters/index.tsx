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
  Image,
  Paper,
  Group,
  Avatar,
  Card,
} from "@mantine/core";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiUser,
  FiUploadCloud,
  FiSearch,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import {
  CharacterItem,
  getCharacterList,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  uploadImageFile,
} from "@/rest/world";

interface CharactersTabProps {
  workId: string;
}

export default function CharactersTab({ workId }: CharactersTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<CharacterItem[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // 编辑/新建 Modal
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<CharacterItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 表单状态
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [gender, setGender] = useState("男");
  const [age, setAge] = useState("");
  const [identity, setIdentity] = useState("");
  const [faction, setFaction] = useState("");
  const [roleType, setRoleType] = useState("protagonist");
  const [appearance, setAppearance] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [personality, setPersonality] = useState("");
  const [description, setDescription] = useState("");
  const [experiences, setExperiences] = useState("");
  const [organizations, setOrganizations] = useState("");
  const [abilities, setAbilities] = useState("");

  const fetchList = async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getCharacterList(workId);
      if (res && res.success && Array.isArray(res.result)) {
        setList(res.result);
      }
    } catch (e) {
      console.error("获取角色列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [workId]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setAlias("");
    setGender("男");
    setAge("");
    setIdentity("");
    setFaction("");
    setRoleType("protagonist");
    setAppearance("");
    setAvatarUrl("");
    setPersonality("");
    setDescription("");
    setExperiences("");
    setOrganizations("");
    setAbilities("");
    setModalOpened(true);
  };

  const handleOpenEdit = (item: CharacterItem) => {
    setEditingItem(item);
    setName(item.name);
    setAlias(item.alias || "");
    setGender(item.gender || "男");
    setAge(item.age || "");
    setIdentity(item.identity || "");
    setFaction(item.faction || "");
    setRoleType(item.roleType || "major");
    setAppearance(item.appearance || "");
    setAvatarUrl(item.avatarUrl || "");
    setPersonality(item.personality || "");
    setDescription(item.description || "");
    setExperiences(item.experiences || "");
    setOrganizations(item.organizations || "");
    setAbilities(item.abilities || "");
    setModalOpened(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFormLoading(true);
      const res = await uploadImageFile(file);
      if (res && res.success && res.url) {
        setAvatarUrl(res.url);
      }
    } catch (e: any) {
      alert("上传头像失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("请输入角色姓名！");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateCharacter({
          id: editingItem.id,
          name: name.trim(),
          alias: alias.trim() || undefined,
          gender,
          age: age.trim() || undefined,
          identity: identity.trim() || undefined,
          faction: faction.trim() || undefined,
          roleType,
          appearance: appearance.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          personality: personality.trim() || undefined,
          description: description.trim() || undefined,
          experiences: experiences.trim() || undefined,
          organizations: organizations.trim() || undefined,
          abilities: abilities.trim() || undefined,
        });
      } else {
        await createCharacter({
          workId: Number(workId),
          name: name.trim(),
          alias: alias.trim() || undefined,
          gender,
          age: age.trim() || undefined,
          identity: identity.trim() || undefined,
          faction: faction.trim() || undefined,
          roleType,
          appearance: appearance.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          personality: personality.trim() || undefined,
          description: description.trim() || undefined,
          experiences: experiences.trim() || undefined,
          organizations: organizations.trim() || undefined,
          abilities: abilities.trim() || undefined,
        });
      }
      setModalOpened(false);
      await fetchList();
    } catch (e: any) {
      alert("保存角色失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("确定要删除该角色吗？此操作不可撤销。")) {
      const res = await deleteCharacter(id);
      if (res && res.success) {
        await fetchList();
      }
    }
  };

  const getRoleBadge = (type: string) => {
    switch (type) {
      case "protagonist":
        return <Badge color="cyan" variant="filled" size="sm">主角</Badge>;
      case "antagonist":
        return <Badge color="red" variant="filled" size="sm">反派 Boss</Badge>;
      case "major":
        return <Badge color="indigo" variant="light" size="sm">重要配角</Badge>;
      case "supporting":
        return <Badge color="teal" variant="light" size="sm">配角</Badge>;
      default:
        return <Badge color="gray" variant="light" size="sm">龙套</Badge>;
    }
  };

  const filteredList = list.filter((item) => {
    const matchSearch =
      !searchKey ||
      item.name.toLowerCase().includes(searchKey.toLowerCase()) ||
      (item.identity && item.identity.toLowerCase().includes(searchKey.toLowerCase())) ||
      (item.faction && item.faction.toLowerCase().includes(searchKey.toLowerCase()));

    const matchRole = roleFilter === "all" || item.roleType === roleFilter;

    return matchSearch && matchRole;
  });

  return (
    <Box>
      {/* 顶部搜索与操作栏 */}
      <Group justify="space-between" align="center" mb="lg" wrap="wrap">
        <Group gap="sm" align="center" style={{ flex: 1, maxWidth: 520 }}>
          <TextInput
            placeholder="搜索角色姓名、身份或阵营..."
            leftSection={<FiSearch size={14} />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            style={{ flex: 1 }}
          />

          <Select
            value={roleFilter}
            onChange={(val) => setRoleFilter(val || "all")}
            data={[
              { value: "all", label: "全部角色定位" },
              { value: "protagonist", label: "主角" },
              { value: "major", label: "重要配角" },
              { value: "antagonist", label: "反派" },
              { value: "supporting", label: "普通配角" },
              { value: "mob", label: "龙套" },
            ]}
            style={{ width: 140 }}
          />
        </Group>

        <Button leftSection={<FiPlus size={14} />} color="cyan" onClick={handleOpenCreate}>
          新建角色卡
        </Button>
      </Group>

      {/* 角色卡片网格 */}
      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Stack align="center" justify="center" p={60} c="dimmed" gap="xs">
            <FiUsers size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无匹配的角色数据</Text>
            <Text fz={13}>点击右上角「新建角色卡」添加小说世界人物设定</Text>
          </Stack>
        ) : (
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
                <Group align="flex-start" gap="md" mb="xs" wrap="nowrap">
                  <Avatar
                    src={item.avatarUrl || undefined}
                    alt={item.name}
                    size={64}
                    radius="md"
                    color="cyan"
                  >
                    <FiUser size={28} />
                  </Avatar>

                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                      <Text fz={16} fw={700} c="dark.7" truncate="end">
                        {item.name} {item.alias ? `(${item.alias})` : ""}
                      </Text>
                      {getRoleBadge(item.roleType)}
                    </Group>

                    <Group gap="xs" mt={4} fz={12} c="dimmed" wrap="wrap">
                      <Text fz={12} c="dimmed">性别：{item.gender || "未知"}</Text>
                      {item.age && <Text fz={12} c="dimmed">· 年龄：{item.age}</Text>}
                    </Group>

                    {item.identity && (
                      <Text fz={12} c="cyan.8" mt={2} fw={600} truncate="end">
                        身份：{item.identity}
                      </Text>
                    )}
                  </Box>
                </Group>

                {item.faction && (
                  <Group gap={6} mb="xs" fz={12} c="dark.4">
                    <FiTag size={12} color="#06b6d4" />
                    <Text fz={12}>所属阵营：<Text span fw={700}>{item.faction}</Text></Text>
                  </Group>
                )}

                {item.personality && (
                  <Paper mb="xs" p="xs" bg="gray.0" radius="sm">
                    <Text fz={11} fw={700} c="dimmed" mb={2}>性格侧写</Text>
                    <Text fz={12} c="dark.6" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.personality}
                    </Text>
                  </Paper>
                )}

                {item.abilities && (
                  <Text fz={12} c="teal.7" mb="xs" lineClamp={1}>
                    ⚡ 能力功法：{item.abilities}
                  </Text>
                )}

                <Group justify="flex-end" gap="xs" mt="auto" pt="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                  <ActionIcon variant="subtle" color="cyan" size="sm" onClick={() => handleOpenEdit(item)}>
                    <FiEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑角色 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs" align="center">
            <FiUser color="#06b6d4" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑角色设定 - ${editingItem.name}` : "新建角色卡片"}
            </Text>
          </Group>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="md">
          {/* 基本信息 */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <TextInput
              label="角色姓名"
              placeholder="例如：林肆"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <TextInput
              label="别名 / 称号 / 尊号"
              placeholder="例如：万剑剑尊 / 九幽邪君"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            <Select
              label="角色定位"
              value={roleType}
              onChange={(val) => setRoleType(val || "major")}
              data={[
                { value: "protagonist", label: "🌟 主角" },
                { value: "major", label: "🔥 重要配角" },
                { value: "antagonist", label: "💀 反派 Boss" },
                { value: "supporting", label: "🌿 普通配角" },
                { value: "mob", label: "👥 龙套/过客" },
              ]}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Select
              label="性别"
              value={gender}
              onChange={(val) => setGender(val || "男")}
              data={["男", "女", "非二元", "未知", "灵兽/机械"]}
            />
            <TextInput
              label="年龄 / 骨龄"
              placeholder="例如：18岁 / 三千载"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <TextInput
              label="身份地位 / 职业"
              placeholder="例如：宗门弃徒 / 皇室七皇子"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
            <TextInput
              label="所属势力 / 阵营"
              placeholder="例如：青云门 / 暗夜守望者"
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
            />
          </SimpleGrid>

          {/* 头像/立绘上传 */}
          <Paper p="md" withBorder bg="gray.0" radius="md">
            <Group gap="md" align="center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
              <Paper
                withBorder
                radius="md"
                p={4}
                style={{
                  width: 120,
                  height: 120,
                  flexShrink: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#ffffff",
                  overflow: "hidden",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="预览" fit="cover" w="100%" h="100%" radius="sm" />
                ) : (
                  <Stack align="center" gap={4} c="dimmed">
                    <FiUploadCloud size={24} />
                    <Text fz={11}>点击上传立绘</Text>
                  </Stack>
                )}
              </Paper>

              <Box style={{ flex: 1 }}>
                <Text fz={13} fw={700} c="dark.7" mb={4}>角色肖像 / 头像立绘</Text>
                <Text fz={12} c="dimmed" mb="xs">支持 JPG, PNG 等本地图片上传，自动生成图片链接存储在角色档案中。</Text>
                <TextInput
                  placeholder="或直接输入在线图片 URL 链接..."
                  size="xs"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </Box>
            </Group>
          </Paper>

          {/* 性格侧写与外貌长相 */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Textarea
              label="性格侧写 / 心理动机 / 核心准则"
              placeholder="例如：极度冷静理智，重诺守信，有恩必报，对敌人绝不手软..."
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              minRows={3}
            />
            <Textarea
              label="外貌肖像 / 衣着长相描写"
              placeholder="例如：白衣如雪，长发束起，双眸深邃如古潭，腰佩墨黑古剑..."
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              minRows={3}
            />
          </SimpleGrid>

          {/* 拥有能力与重大经历 */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Textarea
              label="专属能力 / 功法武技 / 标志法宝"
              placeholder="例如：九霄御雷剑决、不灭金身、混沌至尊骨..."
              value={abilities}
              onChange={(e) => setAbilities(e.target.value)}
              minRows={3}
            />
            <Textarea
              label="人物生平经历 / 重大事件渊源"
              placeholder="例如：三岁被家族流放，十岁在断魂崖偶得古剑传承，历经三百年重返中州..."
              value={experiences}
              onChange={(e) => setExperiences(e.target.value)}
              minRows={3}
            />
          </SimpleGrid>

          <Textarea
            label="人物详细背景介绍与补充设定 (选填)"
            placeholder="记录关于该角色的任何细节或灵感备忘..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={3}
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button color="cyan" loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建角色"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
