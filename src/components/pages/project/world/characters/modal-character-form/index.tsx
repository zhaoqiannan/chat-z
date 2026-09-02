// 组件：角色档案新建与编辑弹窗（70vw宽度、固定88vh限高、body流畅滚动、粘性底部操作栏、精简label与10行Textarea）
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Flex, Text, Button, Modal, TextInput, Textarea, Select, Stack, SimpleGrid, Group, Avatar } from "@mantine/core";
import { FiUploadCloud, FiZap } from "react-icons/fi";
import { CharacterItem, createCharacter, updateCharacter, uploadImageFile } from "@/rest/world";
import NameGeneratorModal from "@/components/common/name-generator";

interface ModalCharacterFormProps {
  opened: boolean;
  onClose: () => void;
  workId: string;
  editingItem: CharacterItem | null;
  onSuccess: () => Promise<void>;
}

export default function ModalCharacterForm({
  opened,
  onClose,
  workId,
  editingItem,
  onSuccess,
}: ModalCharacterFormProps) {
  const [formLoading, setFormLoading] = useState(false);
  const [nameGenOpened, setNameGenOpened] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [gender, setGender] = useState("男");
  const [age, setAge] = useState("");
  const [identity, setIdentity] = useState("");
  const [faction, setFaction] = useState("");
  const [roleType, setRoleType] = useState("major");
  const [appearance, setAppearance] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tags, setTags] = useState("");
  const [appearanceChapters, setAppearanceChapters] = useState("");
  const [characterArc, setCharacterArc] = useState("");

  const [personalIntro, setPersonalIntro] = useState("");
  const [personality, setPersonality] = useState("");
  const [abilities, setAbilities] = useState("");
  const [inspirationFragments, setInspirationFragments] = useState("");
  const [background, setBackground] = useState("");

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || "");
      setAlias(editingItem.alias || "");
      setGender(editingItem.gender || "男");
      setAge(editingItem.age || "");
      setIdentity(editingItem.identity || "");
      setFaction(editingItem.faction || "");
      setRoleType(editingItem.roleType || "major");
      setAppearance(editingItem.appearance || "");
      setAvatarUrl(editingItem.avatarUrl || "");
      setTags(editingItem.tags || "");
      setAppearanceChapters(editingItem.appearanceChapters || "");
      setCharacterArc(editingItem.characterArc || "");
      setPersonalIntro(editingItem.personalIntro || editingItem.description || "");
      setPersonality(editingItem.personality || "");
      setAbilities(editingItem.abilities || "");
      setInspirationFragments(editingItem.inspirationFragments || (editingItem.extra?.inspirationFragments as string) || "");
      setBackground(editingItem.background || editingItem.experiences || "");
    } else {
      setName("");
      setAlias("");
      setGender("男");
      setAge("");
      setIdentity("");
      setFaction("");
      setRoleType("major");
      setAppearance("");
      setAvatarUrl("");
      setTags("");
      setAppearanceChapters("");
      setCharacterArc("");
      setPersonalIntro("");
      setPersonality("");
      setAbilities("");
      setInspirationFragments("");
      setBackground("");
    }
  }, [editingItem, opened]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("角色姓名不能为空");
      return;
    }

    try {
      setFormLoading(true);
      const payload = {
        name: name.trim(),
        alias: alias.trim() || undefined,
        gender,
        age: age.trim() || undefined,
        identity: identity.trim() || undefined,
        faction: faction.trim() || undefined,
        roleType,
        appearance: appearance || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        tags: tags.trim() || undefined,
        appearanceChapters: appearanceChapters.trim() || undefined,
        characterArc: characterArc || undefined,
        personalIntro: personalIntro || undefined,
        description: personalIntro || undefined,
        personality: personality || undefined,
        abilities: abilities || undefined,
        inspirationFragments: inspirationFragments || undefined,
        background: background || undefined,
        experiences: background || undefined,
      };

      if (editingItem) {
        await updateCharacter({ id: editingItem.id, ...payload });
      } else {
        await createCharacter({ workId: Number(workId), ...payload });
      }

      onClose();
      await onSuccess();
    } catch (e: any) {
      alert("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFormLoading(true);
      const res = await uploadImageFile(file);
      if (res && res.success && res.url) {
        setAvatarUrl(res.url);
      } else {
        alert("上传失败: " + (res?.message || "未知错误"));
      }
    } catch (err: any) {
      alert("上传图片异常: " + (err?.message || "网络错误"));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} fz={15} c="#0f172a">{editingItem ? "编辑角色档案" : "新建角色档案"}</Text>}
      size="70vw"
      centered
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
              <Text fz={12} fw={500} c="#475569">角色姓名 *</Text>
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
            label="尊号"
            placeholder="请输入"
            size="xs"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
          <Select
            label="定位"
            size="xs"
            value={roleType}
            onChange={(val) => setRoleType(val || "major")}
            data={[
              { value: "protagonist", label: "主角" },
              { value: "major", label: "重要配角" },
              { value: "antagonist", label: "反派" },
              { value: "supporting", label: "普通配角" },
              { value: "mob", label: "龙套" },
            ]}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
          <Select
            label="性别"
            size="xs"
            value={gender}
            onChange={(val) => setGender(val || "男")}
            data={["男", "女", "未知", "其他"]}
          />
          <TextInput
            label="年龄"
            placeholder="请输入"
            size="xs"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <TextInput
            label="身份"
            placeholder="请输入"
            size="xs"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
          />
          <TextInput
            label="所属势力"
            placeholder="请输入"
            size="xs"
            value={faction}
            onChange={(e) => setFaction(e.target.value)}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="人物标签"
            placeholder="请输入"
            size="xs"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <TextInput
            label="出场章节"
            placeholder="请输入"
            size="xs"
            value={appearanceChapters}
            onChange={(e) => setAppearanceChapters(e.target.value)}
          />
        </SimpleGrid>

        <Box p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 4, backgroundColor: "#fafbfc" }}>
          <Group gap="md" align="center">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              onChange={handleUploadImage}
            />
            <Avatar
              src={avatarUrl || undefined}
              radius="xl"
              size={40}
              style={{ cursor: "pointer", border: "1px solid #e2e8f0" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <FiUploadCloud size={16} color="#94a3b8" />
            </Avatar>

            <Box style={{ flex: 1 }}>
              <Text fz={11.5} fw={600} c="#475569" mb={2}>角色肖像</Text>
              <TextInput
                placeholder="请输入图片链接或点击左侧上传"
                size="xs"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </Box>
          </Group>
        </Box>

        <Textarea
          label="个人介绍"
          placeholder="请输入"
          size="xs"
          value={personalIntro}
          onChange={(e) => setPersonalIntro(e.target.value)}
          minRows={10}
          autosize
        />

        <Textarea
          label="性格侧写"
          placeholder="请输入"
          size="xs"
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          minRows={10}
          autosize
        />

        <Textarea
          label="技能点"
          placeholder="请输入"
          size="xs"
          value={abilities}
          onChange={(e) => setAbilities(e.target.value)}
          minRows={10}
          autosize
        />

        <Textarea
          label="灵感片段"
          placeholder="请输入"
          size="xs"
          value={inspirationFragments}
          onChange={(e) => setInspirationFragments(e.target.value)}
          minRows={10}
          autosize
        />

        <Textarea
          label="人物背景"
          placeholder="请输入"
          size="xs"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          minRows={10}
          autosize
        />

        <Textarea
          label="外貌肖像"
          placeholder="请输入"
          size="xs"
          value={appearance}
          onChange={(e) => setAppearance(e.target.value)}
          minRows={10}
          autosize
        />

        <Textarea
          label="人物成长弧线"
          placeholder="请输入"
          size="xs"
          value={characterArc}
          onChange={(e) => setCharacterArc(e.target.value)}
          minRows={10}
          autosize
        />
      </Stack>

      <Flex justify="flex-end" gap="xs" mt="md" pt={12} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -12, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
        <Button variant="default" size="xs" onClick={onClose}>
          取消
        </Button>
        <Button color="cyan" size="xs" loading={formLoading} onClick={handleSave}>
          保存角色档案
        </Button>
      </Flex>

      <NameGeneratorModal
        opened={nameGenOpened}
        onClose={() => setNameGenOpened(false)}
        onSelectName={(chosenName) => setName(chosenName)}
      />
    </Modal>
  );
}
