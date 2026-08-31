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
  Image,
  Paper,
  Divider,
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
import styles from "../style.module.scss";

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
    setName(item.name || "");
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
      const res = await uploadImageFile(file);
      if (res && res.success && res.url) {
        setAvatarUrl(res.url);
      } else {
        alert(res?.message || "上传图片失败");
      }
    } catch (err: any) {
      alert("上传图片异常: " + (err?.message || "网络错误"));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("角色姓名不能为空");
      return;
    }

    try {
      setFormLoading(true);
      if (editingItem) {
        await updateCharacter({
          id: editingItem.id,
          name: name.trim(),
          alias,
          gender,
          age,
          identity,
          faction,
          roleType,
          appearance,
          avatarUrl,
          personality,
          description,
          experiences,
          organizations,
          abilities,
        });
      } else {
        await createCharacter({
          workId: Number(workId),
          name: name.trim(),
          alias,
          gender,
          age,
          identity,
          faction,
          roleType,
          appearance,
          avatarUrl,
          personality,
          description,
          experiences,
          organizations,
          abilities,
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
        return <Badge color="cyan" variant="filled">主角</Badge>;
      case "antagonist":
        return <Badge color="red" variant="filled">反派 Boss</Badge>;
      case "major":
        return <Badge color="indigo" variant="light">重要配角</Badge>;
      case "supporting":
        return <Badge color="teal" variant="light">配角</Badge>;
      default:
        return <Badge color="gray" variant="light">龙套</Badge>;
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
      <Flex justify="space-between" align="center" mb={20} gap={12} wrap="wrap">
        <Flex gap={12} align="center" style={{ flex: 1, maxWidth: 500 }}>
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
        </Flex>

        <Button leftSection={<FiPlus size={14} />} onClick={handleOpenCreate}>
          新建角色卡
        </Button>
      </Flex>

      {/* 角色卡片网格 */}
      <Box pos="relative" style={{ minHeight: 300 }}>
        <LoadingOverlay visible={loading} />

        {filteredList.length === 0 && !loading ? (
          <Flex direction="column" align="center" justify="center" p={60} c="#94a3b8" gap={8}>
            <FiUsers size={40} strokeWidth={1.2} />
            <Text fz={15} fw={600}>暂无匹配的角色数据</Text>
            <Text fz={13}>点击右上角「新建角色卡」添加小说世界人物设定</Text>
          </Flex>
        ) : (
          <div className={styles.cardGrid}>
            {filteredList.map((item) => (
              <div key={item.id} className={styles.entityCard}>
                <Flex gap={14} align="flex-start" mb={12}>
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt={item.name} className={styles.cardAvatar} />
                  ) : (
                    <Flex
                      className={styles.cardAvatar}
                      align="center"
                      justify="center"
                      c="#94a3b8"
                      bg="#f8fafc"
                    >
                      <FiUser size={28} />
                    </Flex>
                  )}

                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" justify="space-between" gap={6}>
                      <Text fz={16} fw={700} c="#1e293b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.name} {item.alias ? `(${item.alias})` : ""}
                      </Text>
                      {getRoleBadge(item.roleType)}
                    </Flex>

                    <Flex gap={8} mt={4} fz={12} c="#64748b" wrap="wrap">
                      <span>性别：{item.gender || "未知"}</span>
                      {item.age && <span>· 年龄：{item.age}</span>}
                    </Flex>

                    {item.identity && (
                      <Text fz={12} c="#0369a1" mt={2} fw={600}>
                        身份：{item.identity}
                      </Text>
                    )}
                  </Box>
                </Flex>

                {item.faction && (
                  <Flex align="center" gap={6} mb={8} fz={12} c="#475569">
                    <FiTag size={12} color="#00c9ff" />
                    <span>所属阵营：<b>{item.faction}</b></span>
                  </Flex>
                )}

                {item.personality && (
                  <Box mb={8} p="8px 12px" bg="#f8fafc" style={{ borderRadius: 8 }}>
                    <Text fz={11} fw={700} c="#64748b" mb={2}>性格侧写</Text>
                    <Text fz={12} c="#334155" lineClamp={2} style={{ lineHeight: 1.5 }}>
                      {item.personality}
                    </Text>
                  </Box>
                )}

                {item.abilities && (
                  <Text fz={12} c="#059669" mb={8} lineClamp={1}>
                    ⚡ 能力功法：{item.abilities}
                  </Text>
                )}

                <Flex justify="flex-end" gap={6} mt="auto" pt={10} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => handleOpenEdit(item)}>
                    <FiEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(item.id)}>
                    <FiTrash2 size={14} />
                  </ActionIcon>
                </Flex>
              </div>
            ))}
          </div>
        )}
      </Box>

      {/* 70vw 宽屏舒适创建/编辑角色 Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Flex align="center" gap={8}>
            <FiUser color="#00c9ff" size={18} />
            <Text fw={700} fz={16}>
              {editingItem ? `编辑角色设定 - ${editingItem.name}` : "新建角色卡片"}
            </Text>
          </Flex>
        }
        centered
        size="70vw"
        radius="md"
      >
        <Stack gap="16px">
          {/* 基本信息 */}
          <SimpleGrid cols={3}>
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

          <SimpleGrid cols={4}>
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
          <Paper p="14px" withBorder bg="#f8fafc" radius="md">
            <Flex gap={16} align="center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
              <div
                className={styles.imageUploadPreview}
                style={{ width: 120, height: 120, flexShrink: 0 }}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Flex direction="column" align="center" gap={4} c="#94a3b8">
                    <FiUploadCloud size={24} />
                    <Text fz={11}>点击上传立绘</Text>
                  </Flex>
                )}
              </div>

              <Box style={{ flex: 1 }}>
                <Text fz={13} fw={700} c="#1e293b" mb={4}>角色肖像 / 头像立绘</Text>
                <Text fz={12} c="#64748b" mb={8}>支持 JPG, PNG 等本地图片上传，自动生成高速图片链接存储在角色档案中。</Text>
                <TextInput
                  placeholder="或直接输入在线图片 URL 链接..."
                  size="xs"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </Box>
            </Flex>
          </Paper>

          {/* 性格侧写与外貌长相 */}
          <SimpleGrid cols={2}>
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
          <SimpleGrid cols={2}>
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

          <Flex justify="flex-end" gap={10} mt={10}>
            <Button variant="outline" color="gray" onClick={() => setModalOpened(false)}>
              取消
            </Button>
            <Button loading={formLoading} onClick={handleSubmit}>
              {editingItem ? "保存修改" : "确认创建角色"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
