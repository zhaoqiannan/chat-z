"use client";

import React from "react";
import { Box, Flex, Text, Button, Badge, Modal, Stack, SimpleGrid, Group, Avatar } from "@mantine/core";
import { FiEdit2, FiShield, FiBookOpen, FiTrendingUp } from "react-icons/fi";
import { CharacterItem } from "@/rest/world";

interface ModalCharacterDetailProps {
  opened: boolean;
  onClose: () => void;
  character: CharacterItem | null;
  onOpenEdit: (character: CharacterItem) => void;
}

const ROLE_NAME_MAP: Record<string, string> = {
  protagonist: "主角",
  major: "重要配角",
  antagonist: "反派",
  supporting: "配角",
  mob: "龙套",
};

export default function ModalCharacterDetail({
  opened,
  onClose,
  character,
  onOpenEdit,
}: ModalCharacterDetailProps) {
  if (!character) return null;

  const getRoleBadge = (role: string) => {
    const label = ROLE_NAME_MAP[role] || "配角";
    return (
      <Badge
        size="xs"
        variant="light"
        color="blue"
        styles={{ root: { fontWeight: 600, padding: "0 6px" } }}
      >
        {label}
      </Badge>
    );
  };

  const formatTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const introText = character.personalIntro || character.description;
  const bgText = character.background || character.experiences;
  const inspText = character.inspirationFragments || (character.extra?.inspirationFragments as string);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={8} align="center">
          <Box style={{ width: 3, height: 16, backgroundColor: "#00b2e0", borderRadius: 2 }} />
          <Text fw={700} fz={15} c="#0f172a">角色档案详情</Text>
        </Group>
      }
      size="70vw"
      centered
      radius="md"
      styles={{
        content: { maxHeight: "88vh", display: "flex", flexDirection: "column" },
        header: { borderBottom: "1px solid #f1f5f9", padding: "14px 20px", flexShrink: 0 },
        body: { flex: 1, overflowY: "auto", minHeight: 0, padding: "18px 20px 14px 20px" },
      }}
    >
      <Stack gap="md">
        <Flex gap="md" align="center" pb="xs" style={{ borderBottom: "1px solid #f8fafc" }}>
          <Avatar
            src={character.avatarUrl || undefined}
            radius="xl"
            size={52}
            styles={{
              root: {
                border: "1.5px solid #b3effc",
                backgroundColor: "#e0f7fc",
              },
              placeholder: {
                fontSize: 18,
                fontWeight: 700,
                color: "#0096bd",
              },
            }}
          >
            {character.name ? character.name.slice(0, 1) : "?"}
          </Avatar>

          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={8} align="center" mb={3}>
              <Text fz={17} fw={800} c="#0f172a">
                {character.name}
              </Text>
              {getRoleBadge(character.roleType)}
              {character.isPinned ? (
                <Badge
                  size="xs"
                  variant="outline"
                  color="blue"
                  styles={{ root: { borderColor: "#80e5fa", color: "#0096bd", fontWeight: 600 } }}
                >
                  已置顶
                </Badge>
              ) : null}
            </Group>

            <Text fz={12} c="#64748b">
              {character.alias ? `尊号：${character.alias} · ` : ""}
              性别：{character.gender || "未知"} {character.age ? `· 年龄：${character.age}` : ""}
            </Text>
          </Box>
        </Flex>

        {character.tags && (
          <Group gap={6} wrap="wrap">
            {character.tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
              <Badge key={idx} size="xs" variant="outline" color="gray" styles={{ root: { borderColor: "#e2e8f0", color: "#475569", fontSize: 10.5 } }}>
                #{t}
              </Badge>
            ))}
          </Group>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <Box p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
            <Group gap={6} fz={11} c="#94a3b8" mb={2}>
              <FiShield size={11} color="#0096bd" />
              <Text fz={11}>身份</Text>
            </Group>
            <Text fz={12.5} fw={600} c="#1e293b">
              {character.identity || "暂无"} {character.faction ? `(${character.faction})` : ""}
            </Text>
          </Box>

          <Box p="8px 12px" style={{ border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
            <Group gap={6} fz={11} c="#94a3b8" mb={2}>
              <FiBookOpen size={11} color="#0096bd" />
              <Text fz={11}>出场章节</Text>
            </Group>
            <Text fz={12.5} fw={600} c="#0096bd">
              {character.appearanceChapters || "全书贯穿"}
            </Text>
          </Box>
        </SimpleGrid>

        {introText && (
          <Box>
            <Text fz={12} fw={600} c="#64748b" mb={3}>个人介绍</Text>
            <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
              {introText}
            </Text>
          </Box>
        )}

        {character.personality && (
          <Box>
            <Text fz={12} fw={600} c="#64748b" mb={3}>性格侧写</Text>
            <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
              {character.personality}
            </Text>
          </Box>
        )}

        {character.abilities && (
          <Box>
            <Text fz={12} fw={600} c="#64748b" mb={3}>技能点与武力</Text>
            <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
              {character.abilities}
            </Text>
          </Box>
        )}

        {inspText && (
          <Box>
            <Text fz={12} fw={600} c="#64748b" mb={3}>灵感片段</Text>
            <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
              {inspText}
            </Text>
          </Box>
        )}

        {bgText && (
          <Box>
            <Text fz={12} fw={600} c="#64748b" mb={3}>人物背景</Text>
            <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
              {bgText}
            </Text>
          </Box>
        )}

        {character.appearance && (
          <Box>
            <Text fz={12} fw={600} c="#64748b" mb={3}>外貌肖像</Text>
            <Text fz={12.5} c="#334155" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: 6, backgroundColor: "#fafbfc" }}>
              {character.appearance}
            </Text>
          </Box>
        )}

        {character.characterArc && (
          <Box p="10px 12px" style={{ border: "1px solid #b3effc", borderRadius: 6, backgroundColor: "#fafdff" }}>
            <Group gap={6} fz={11.5} c="#0096bd" mb={4}>
              <FiTrendingUp size={12} />
              <Text fz={12} fw={700}>人物成长弧线</Text>
            </Group>
            <Text fz={12.5} c="#006c87" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {character.characterArc}
            </Text>
          </Box>
        )}

        <Text fz={10.5} c="#cbd5e1" ta="right">
          最后更新于 {formatTime(character.updatedAt || character.createdAt)}
        </Text>
      </Stack>

      <Flex justify="flex-end" gap="xs" mt="md" pt={12} style={{ borderTop: "1px solid #f1f5f9", position: "sticky", bottom: -14, backgroundColor: "#ffffff", zIndex: 10, paddingBottom: 4 }}>
        <Button variant="default" size="xs" onClick={onClose}>
          关闭
        </Button>
        <Button
          size="xs"
          color="blue"
          leftSection={<FiEdit2 size={11} />}
          onClick={() => {
            onClose();
            onOpenEdit(character);
          }}
        >
          编辑档案
        </Button>
      </Flex>
    </Modal>
  );
}
