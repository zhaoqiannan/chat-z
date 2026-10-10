"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  TextInput,
  Stack,
  SimpleGrid,
  LoadingOverlay,
  Group,
  Modal,
  Badge,
  Collapse,
  UnstyledButton,
  Paper,
} from "@mantine/core";
import {
  FiPlus,
  FiSearch,
  FiUser,
  FiAlertTriangle,
  FiChevronRight,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { useAlert } from "@/hooks/useAlert";
import { CharacterItem, getCharacterList, deleteCharacter, togglePinCharacter } from "@/rest/world";
import CharacterCard from "./character-card";
import ModalCharacterForm from "./modal-character-form";
import ModalCharacterDetail from "./modal-character-detail";

interface CharactersTabProps {
  workId: string;
}

interface RoleLevelDef {
  key: string;
  name: string;
  defaultOpen: boolean;
}

const ROLE_LEVELS: RoleLevelDef[] = [
  { key: "protagonist", name: "主角", defaultOpen: true },
  { key: "major", name: "重要配角", defaultOpen: true },
  { key: "antagonist", name: "反派", defaultOpen: true },
  { key: "supporting", name: "配角", defaultOpen: true },
  { key: "mob", name: "龙套", defaultOpen: false },
];

export default function CharactersTab({ workId }: CharactersTabProps) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<CharacterItem[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [selectedTab, setSelectedTab] = useState<string>("all");

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ROLE_LEVELS.forEach((level) => {
      initial[level.key] = level.defaultOpen;
    });
    return initial;
  });

  const [detailModalOpened, setDetailModalOpened] = useState(false);
  const [detailItem, setDetailItem] = useState<CharacterItem | null>(null);

  const [formModalOpened, setFormModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<CharacterItem | null>(null);
  const [targetRoleType, setTargetRoleType] = useState<string>("major");

  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<CharacterItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    if (searchKey.trim()) {
      const keyword = searchKey.toLowerCase();
      const nextOpenState: Record<string, boolean> = {};

      ROLE_LEVELS.forEach((level) => {
        const hasMatch = list.some((item) => {
          const matchRole = (item.roleType || "mob") === level.key;
          if (!matchRole) return false;
          return (
            item.name?.toLowerCase().includes(keyword) ||
            item.alias?.toLowerCase().includes(keyword) ||
            item.identity?.toLowerCase().includes(keyword) ||
            item.faction?.toLowerCase().includes(keyword) ||
            item.tags?.toLowerCase().includes(keyword) ||
            item.personality?.toLowerCase().includes(keyword)
          );
        });
        nextOpenState[level.key] = hasMatch;
      });

      setOpenSections((prev) => ({ ...prev, ...nextOpenState }));
    }
  }, [searchKey, list]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExpandAll = () => {
    const allOpen: Record<string, boolean> = {};
    ROLE_LEVELS.forEach((level) => {
      allOpen[level.key] = true;
    });
    setOpenSections(allOpen);
  };

  const handleCollapseAll = () => {
    const allClosed: Record<string, boolean> = {};
    ROLE_LEVELS.forEach((level) => {
      allClosed[level.key] = false;
    });
    setOpenSections(allClosed);
  };

  const isAllExpanded = useMemo(() => {
    return ROLE_LEVELS.every((level) => !!openSections[level.key]);
  }, [openSections]);

  const handleOpenCreate = (prefillRole?: string) => {
    setEditingItem(null);
    setTargetRoleType(prefillRole || (selectedTab !== "all" ? selectedTab : "major"));
    setFormModalOpened(true);
  };

  const handleOpenEdit = (item: CharacterItem) => {
    setEditingItem(item);
    setTargetRoleType(item.roleType || "major");
    setFormModalOpened(true);
  };

  const handleOpenDetail = (item: CharacterItem) => {
    setDetailItem(item);
    setDetailModalOpened(true);
  };

  const handleTogglePin = async (item: CharacterItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPin = !item.isPinned;
    try {
      await togglePinCharacter(item.id, nextPin);
      setList((prev) =>
        prev
          .map((c) => (c.id === item.id ? { ...c, isPinned: nextPin ? 1 : 0, pinnedAt: nextPin ? new Date().toISOString() : null } : c))
          .sort((a, b) => Number(b.isPinned || 0) - Number(a.isPinned || 0))
      );
      useAlert.success(nextPin ? "角色已置顶" : "已取消置顶");
    } catch (err: any) {
      useAlert.error("置顶操作失败: " + (err?.message || "网络异常"));
    }
  };

  const handlePromptDelete = (item: CharacterItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteModalOpened(true);
  };

  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    try {
      setDeleting(true);
      await deleteCharacter(itemToDelete.id);
      setList((prev) => prev.filter((c) => c.id !== itemToDelete.id));
      if (detailItem?.id === itemToDelete.id) {
        setDetailModalOpened(false);
      }
      setDeleteModalOpened(false);
      setItemToDelete(null);
      useAlert.success("角色已成功删除");
    } catch (e: any) {
      useAlert.error("删除失败: " + (e?.message || "网络异常"));
    } finally {
      setDeleting(false);
    }
  };

  const filteredList = useMemo(() => {
    const keyword = searchKey.trim().toLowerCase();
    return list.filter((item) => {
      if (!keyword) return true;
      return (
        item.name?.toLowerCase().includes(keyword) ||
        item.alias?.toLowerCase().includes(keyword) ||
        item.identity?.toLowerCase().includes(keyword) ||
        item.faction?.toLowerCase().includes(keyword) ||
        item.tags?.toLowerCase().includes(keyword) ||
        item.personality?.toLowerCase().includes(keyword)
      );
    });
  }, [list, searchKey]);

  const groupedData = useMemo(() => {
    const groups: Record<string, CharacterItem[]> = {
      protagonist: [],
      major: [],
      antagonist: [],
      supporting: [],
      mob: [],
    };

    filteredList.forEach((item) => {
      const r = item.roleType || "mob";
      if (groups[r]) {
        groups[r].push(item);
      } else {
        groups.mob.push(item);
      }
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        if (Number(b.isPinned || 0) !== Number(a.isPinned || 0)) {
          return Number(b.isPinned || 0) - Number(a.isPinned || 0);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
    });

    return groups;
  }, [filteredList]);

  const totalCountByRole = useMemo(() => {
    const counts: Record<string, number> = {
      protagonist: 0,
      major: 0,
      antagonist: 0,
      supporting: 0,
      mob: 0,
    };
    list.forEach((item) => {
      const r = item.roleType || "mob";
      if (counts[r] !== undefined) {
        counts[r]++;
      } else {
        counts.mob++;
      }
    });
    return counts;
  }, [list]);

  const currentLevelDef = useMemo(() => {
    return ROLE_LEVELS.find((l) => l.key === selectedTab);
  }, [selectedTab]);

  const currentTabItems = useMemo(() => {
    if (selectedTab === "all") return filteredList;
    return groupedData[selectedTab] || [];
  }, [selectedTab, filteredList, groupedData]);

  return (
    <Box pos="relative" style={{ minHeight: "100%", backgroundColor: "#ffffff" }}>
      <LoadingOverlay visible={loading} />

      {/* 顶部主工具栏：标题与角色数 + 搜索输入框 + 新建角色主色调按钮 */}
      <Flex justify="space-between" align="center" gap="md" wrap="wrap" mb="xs">
        <Group gap={10} align="center">
          <Text fz={18} fw={800} c="#0f172a" style={{ letterSpacing: -0.2 }}>
            角色工作台
          </Text>
        </Group>

        <Group gap="sm">
          <TextInput
            placeholder="搜索姓名、尊号、身份、势力、标签..."
            leftSection={<FiSearch size={14} color="#94a3b8" />}
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            size="xs"
            radius="md"
            style={{ width: 270 }}
            styles={{
              input: {
                backgroundColor: "#f8fafc",
                borderColor: "#e2e8f0",
                "&:focus": {
                  borderColor: "#00c9ff",
                  backgroundColor: "#ffffff",
                },
              },
            }}
          />

          <Button
            size="xs"
            color="blue"
            radius="md"
            leftSection={<FiPlus size={14} />}
            onClick={() => handleOpenCreate()}
            styles={{
              root: {
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(0, 201, 255, 0.25)",
              },
            }}
          >
            新建角色
          </Button>
        </Group>
      </Flex>

      {/* 分类切换器标签栏：主色调高亮胶囊与全折叠控制 */}
      <Flex
        justify="space-between"
        align="center"
        gap="sm"
        wrap="wrap"
        py={10}
        mb="md"
        style={{ borderBottom: "1px solid #f1f5f9" }}
      >
        <Group gap={6} wrap="wrap">
          <Button
            size="xs"
            radius="md"
            variant={selectedTab === "all" ? "light" : "subtle"}
            color="blue"
            onClick={() => setSelectedTab("all")}
            styles={{
              root: {
                height: 30,
                padding: "0 12px",
                fontSize: 12.5,
                fontWeight: selectedTab === "all" ? 700 : 500,
                backgroundColor: selectedTab === "all" ? "#e0f7fc" : "transparent",
                color: selectedTab === "all" ? "#0096bd" : "#475569",
                border: selectedTab === "all" ? "1px solid #80e5fa" : "1px solid transparent",
                transition: "all 0.15s ease",
              },
            }}
          >
            全部 ({list.length})
          </Button>

          {ROLE_LEVELS.map((level) => {
            const count = totalCountByRole[level.key] || 0;
            const isCurrent = selectedTab === level.key;
            return (
              <Button
                key={level.key}
                size="xs"
                radius="md"
                variant={isCurrent ? "light" : "subtle"}
                color="blue"
                onClick={() => setSelectedTab(level.key)}
                styles={{
                  root: {
                    height: 30,
                    padding: "0 12px",
                    fontSize: 12.5,
                    fontWeight: isCurrent ? 700 : 500,
                    backgroundColor: isCurrent ? "#e0f7fc" : "transparent",
                    color: isCurrent ? "#0096bd" : "#475569",
                    border: isCurrent ? "1px solid #80e5fa" : "1px solid transparent",
                    transition: "all 0.15s ease",
                  },
                }}
              >
                {level.name} ({count})
              </Button>
            );
          })}
        </Group>

        {selectedTab === "all" && list.length > 0 && (
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={isAllExpanded ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
            onClick={isAllExpanded ? handleCollapseAll : handleExpandAll}
            styles={{ root: { fontSize: 12, color: "#64748b" } }}
          >
            {isAllExpanded ? "全部收起" : "全部展开"}
          </Button>
        )}
      </Flex>

      {/* 主展示区 */}
      {list.length === 0 && !loading ? (
        <Paper
          p={60}
          withBorder
          radius="md"
          style={{
            textAlign: "center",
            borderColor: "#e2e8f0",
            backgroundColor: "#ffffff",
          }}
        >
          <Box
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#e0f7fc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
              color: "#0096bd",
            }}
          >
            <FiUser size={28} strokeWidth={1.6} />
          </Box>
          <Text fz={16} fw={700} c="#0f172a" mb={6}>
            暂无角色档案
          </Text>
          <Text fz={13} c="#64748b" mb={20} maw={400} mx="auto">
            设定主角、重要配角、反派等核心人物，梳理人设、尊号与出场轨迹。
          </Text>
          <Button
            size="sm"
            color="blue"
            radius="md"
            leftSection={<FiPlus size={14} />}
            onClick={() => handleOpenCreate("protagonist")}
            styles={{
              root: {
                boxShadow: "0 2px 8px rgba(0, 201, 255, 0.25)",
              },
            }}
          >
            创建第一位角色
          </Button>
        </Paper>
      ) : searchKey.trim() && filteredList.length === 0 ? (
        <Paper p={48} withBorder radius="md" style={{ textAlign: "center", borderColor: "#e2e8f0" }}>
          <Text fz={14} fw={600} c="#334155" mb={6}>
            未搜索到匹配的角色档案
          </Text>
          <Text fz={12} c="#94a3b8" mb={14}>
            请尝试调整关键词或清空搜索条件
          </Text>
          <Button size="xs" variant="light" color="blue" onClick={() => setSearchKey("")}>
            清空搜索
          </Button>
        </Paper>
      ) : selectedTab !== "all" ? (
        /* 单分类直接平铺网格视图 */
        <Box>
          <Flex justify="space-between" align="center" mb="md" pb="xs" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <Group gap={8} align="center">
              <Box
                style={{
                  width: 3,
                  height: 16,
                  backgroundColor: "#00b2e0",
                  borderRadius: 2,
                }}
              />
              <Text fz={15.5} fw={700} c="#0f172a">
                {currentLevelDef?.name}
              </Text>
              <Badge size="xs" variant="light" color="blue">
                共 {currentTabItems.length} 位
              </Badge>
            </Group>

            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<FiPlus size={12} />}
              onClick={() => handleOpenCreate(selectedTab)}
            >
              添加{currentLevelDef?.name}
            </Button>
          </Flex>

          {currentTabItems.length === 0 ? (
            <Flex
              justify="center"
              align="center"
              direction="column"
              py={48}
              style={{
                border: "1px dashed #b3effc",
                borderRadius: 8,
                backgroundColor: "#fafdff",
              }}
            >
              <FiUser size={34} color="#0096bd" strokeWidth={1.5} style={{ marginBottom: 8 }} />
              <Text fz={13.5} fw={600} c="#1e293b" mb={4}>
                暂无「{currentLevelDef?.name}」角色
              </Text>
              <Text fz={12} c="#64748b" mb={12}>
                点击下方按钮录入首位角色档案
              </Text>
              <Button
                size="xs"
                color="blue"
                leftSection={<FiPlus size={12} />}
                onClick={() => handleOpenCreate(selectedTab)}
              >
                添加首位{currentLevelDef?.name}
              </Button>
            </Flex>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
              {currentTabItems.map((item) => (
                <CharacterCard
                  key={item.id}
                  item={item}
                  onViewDetail={handleOpenDetail}
                  onEdit={handleOpenEdit}
                  onTogglePin={handleTogglePin}
                  onDelete={handlePromptDelete}
                />
              ))}
            </SimpleGrid>
          )}
        </Box>
      ) : (
        /* 全部视图：各分类优雅折叠卡片 */
        <Stack gap="sm">
          {ROLE_LEVELS.map((level) => {
            const levelItems = groupedData[level.key] || [];
            const isOpen = !!openSections[level.key];
            const count = levelItems.length;

            if (searchKey.trim() && count === 0) {
              return null;
            }

            return (
              <Box
                key={level.key}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
                }}
              >
                <UnstyledButton
                  onClick={() => toggleSection(level.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 16px",
                    backgroundColor: isOpen ? "#fafdff" : "#ffffff",
                    borderBottom: isOpen ? "1px solid #edf2f7" : "none",
                    transition: "all 0.15s ease",
                  }}
                  styles={{
                    root: {
                      "&:hover": {
                        backgroundColor: "#f8fafc",
                      },
                    },
                  }}
                >
                  <Group gap={10} align="center">
                    <Box
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isOpen ? "#0096bd" : "#64748b",
                        transition: "transform 0.2s ease",
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    >
                      <FiChevronRight size={14} />
                    </Box>

                    <Box
                      style={{
                        width: 3,
                        height: 14,
                        backgroundColor: "#00b2e0",
                        borderRadius: 2,
                      }}
                    />

                    <Text fz={14} fw={700} c="#0f172a">
                      {level.name}
                    </Text>

                    <Badge
                      size="xs"
                      variant="light"
                      color="blue"
                      styles={{
                        root: {
                          fontWeight: 600,
                          fontSize: 11,
                          height: 18,
                          padding: "0 6px",
                        },
                      }}
                    >
                      {count}
                    </Badge>
                  </Group>

                  <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="blue"
                      leftSection={<FiPlus size={11} />}
                      onClick={() => handleOpenCreate(level.key)}
                      styles={{
                        root: {
                          fontSize: 11.5,
                          fontWeight: 500,
                          height: 24,
                          padding: "0 8px",
                        },
                      }}
                    >
                      添加{level.name}
                    </Button>
                  </Group>
                </UnstyledButton>

                <Collapse expanded={isOpen}>
                  <Box p="14px 16px" bg="#ffffff">
                    {count === 0 ? (
                      <Flex
                        justify="center"
                        align="center"
                        direction="column"
                        py={24}
                        style={{
                          border: "1px dashed #b3effc",
                          borderRadius: 6,
                          backgroundColor: "#fafdff",
                        }}
                      >
                        <Text fz={12.5} c="#64748b" mb={8}>
                          暂无「{level.name}」角色数据
                        </Text>
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="blue"
                          leftSection={<FiPlus size={11} />}
                          onClick={() => handleOpenCreate(level.key)}
                        >
                          添加首位{level.name}
                        </Button>
                      </Flex>
                    ) : (
                      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
                        {levelItems.map((item) => (
                          <CharacterCard
                            key={item.id}
                            item={item}
                            onViewDetail={handleOpenDetail}
                            onEdit={handleOpenEdit}
                            onTogglePin={handleTogglePin}
                            onDelete={handlePromptDelete}
                          />
                        ))}
                      </SimpleGrid>
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}

      <ModalCharacterDetail
        opened={detailModalOpened}
        onClose={() => setDetailModalOpened(false)}
        character={detailItem}
        onOpenEdit={handleOpenEdit}
      />

      <ModalCharacterForm
        opened={formModalOpened}
        onClose={() => setFormModalOpened(false)}
        workId={workId}
        editingItem={editingItem}
        defaultRoleType={targetRoleType}
        onSuccess={async () => {
          await fetchList();
          if (detailItem && editingItem && detailItem.id === editingItem.id) {
            const updated = list.find((c) => c.id === detailItem.id);
            if (updated) setDetailItem(updated);
          }
        }}
      />

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title={
          <Group gap={6} align="center">
            <FiAlertTriangle color="#ef4444" size={16} />
            <Text fw={600} fz={14}>确认删除角色档案</Text>
          </Group>
        }
        centered
        size="sm"
        radius="md"
      >
        <Stack gap="sm">
          <Text fz={13} c="#334155">
            确定要删除角色 <Text span fw={600} c="#0f172a">「{itemToDelete?.name}」</Text> 吗？
          </Text>
          <Text fz={12} c="#94a3b8">
            删除后该角色的全部人设资料、成长弧线及关联设定将无法恢复。
          </Text>
          <Group justify="flex-end" gap="xs" mt="md">
            <Button variant="default" size="xs" onClick={() => setDeleteModalOpened(false)}>
              取消
            </Button>
            <Button color="red" size="xs" loading={deleting} onClick={handleExecuteDelete}>
              确认删除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
