// 组件：素材资料表格区（自适应宽度、无横向滚动、Tooltip打开源文件与简化操作）
"use client";

import React from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  ActionIcon,
  Table,
  TextInput,
  ScrollArea,
  Group,
  Tooltip,
} from "@mantine/core";
import {
  FiPlus,
  FiSearch,
  FiFileText,
  FiImage,
  FiBarChart2,
  FiMusic,
  FiVideo,
  FiLink,
  FiEdit,
  FiTrash2,
} from "react-icons/fi";
import { BsPinAngle, BsPinFill } from "react-icons/bs";
import dayjs from "dayjs";
import { MaterialData } from "@/rest/project-extensions";

interface MaterialsTableProps {
  list: MaterialData[];
  searchKey: string;
  onSearchChange: (val: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (item: MaterialData) => void;
  onOpenPreviewModal: (item: MaterialData) => void;
  onTogglePin: (item: MaterialData, e: React.MouseEvent) => void;
  onDeleteMaterial: (id: number, e: React.MouseEvent) => void;
}

export default function MaterialsTable({
  list,
  searchKey,
  onSearchChange,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenPreviewModal,
  onTogglePin,
  onDeleteMaterial,
}: MaterialsTableProps) {
  const handleOpenFileUrl = (item: MaterialData, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = item.fileUrl || item.sourceUrl;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <FiImage size={15} color="#10b981" />;
      case "data":
        return <FiBarChart2 size={15} color="#f59e0b" />;
      case "audio":
        return <FiMusic size={15} color="#8b5cf6" />;
      case "video":
        return <FiVideo size={15} color="#ec4899" />;
      case "link":
        return <FiLink size={15} color="#06b6d4" />;
      default:
        return <FiFileText size={15} color="#0284c7" />;
    }
  };

  const formatDateTime = (time?: string | number) => {
    if (!time) return "";
    try {
      return dayjs(time).format("YYYY-MM-DD HH:mm:ss");
    } catch (_) {
      return "";
    }
  };

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", overflow: "hidden" }}>
      {/* 顶部标题与操作 */}
      <Flex justify="space-between" align="center" mb="md">
        <Box>
          <Flex align="center" gap={8}>
            <Text fz={20} fw={800} c="#0f172a">
              素材资料库
            </Text>
            <Badge size="sm" variant="light" color="blue">
              共 {list.length} 条素材
            </Badge>
          </Flex>
          <Text fz={12} c="#94a3b8" mt={2}>
            文件上传与独立查阅、AI 结合指令智能提取、独立素材沉淀笔记与小说设定库
          </Text>
        </Box>
        <Button size="xs" color="blue" leftSection={<FiPlus size={14} />} onClick={onOpenCreateModal}>
          上传/新建素材
        </Button>
      </Flex>

      {/* 顶部搜索框 */}
      <Flex gap="sm" align="center" mb="md">
        <TextInput
          placeholder="搜索素材名称、文件名、笔记或标签..."
          size="xs"
          leftSection={<FiSearch size={14} />}
          value={searchKey}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 320 }}
        />
      </Flex>

      {/* 表格区：自适应 100% 宽度，无横向滚动条 */}
      <Box
        pos="relative"
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          backgroundColor: "#ffffff",
        }}
      >
        <ScrollArea style={{ flex: 1 }} scrollbars="y">
          <Table
            highlightOnHover
            verticalSpacing="sm"
            fz={13}
            style={{ width: "100%", tableLayout: "fixed" }}
          >
            <Table.Thead bg="#f8fafc" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <Table.Tr>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: "26%" }}>
                  素材名称 / 源文件
                </Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: "42%" }}>
                  素材笔记
                </Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: "14%" }}>
                  标签
                </Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: 160, whiteSpace: "nowrap" }}>
                  更新时间
                </Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: 90, textAlign: "right" }}>
                  操作
                </Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {list.map((item) => {
                const isPinned = item.isPinned === 1 || item.isPinned === true;
                const notePlain = (item.content || "").replace(/<[^>]+>/g, "").trim();
                const targetUrl = item.fileUrl || item.sourceUrl;

                return (
                  <Table.Tr
                    key={item.id}
                    style={{
                      transition: "background-color 0.15s ease",
                      backgroundColor: isPinned ? "#f8fafc" : undefined,
                    }}
                  >
                    {/* 1. 素材名称 / 源文件（不显示大小，划入文件 Tooltip 提示打开源文件） */}
                    <Table.Td style={{ overflow: "hidden" }}>
                      <Flex align="flex-start" gap={8}>
                        <Box style={{ flexShrink: 0, marginTop: 2 }}>
                          {getFileTypeIcon(item.fileType)}
                        </Box>
                        <Box style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                          <Flex align="center" gap={6}>
                            {isPinned && (
                              <Badge size="xs" color="yellow" variant="filled" style={{ padding: "1px 5px", fontSize: 10, flexShrink: 0 }}>
                                置顶
                              </Badge>
                            )}
                            <Text
                              fz={13.5}
                              fw={700}
                              c="#1e293b"
                              truncate
                              style={{ lineHeight: 1.4, cursor: "pointer" }}
                              onClick={() => onOpenEditModal(item)}
                              title="点击编辑素材"
                            >
                              {item.title}
                            </Text>
                          </Flex>

                          {/* 文件名区域：Tooltip 提示打开源文件 */}
                          {(item.fileName || targetUrl) && (
                            <Box mt={2}>
                              {targetUrl ? (
                                <Tooltip label="打开源文件" position="top" withArrow>
                                  <Text
                                    fz={11.5}
                                    c="#0284c7"
                                    truncate
                                    style={{
                                      cursor: "pointer",
                                      display: "inline-block",
                                      maxWidth: "100%",
                                    }}
                                    onClick={(e) => handleOpenFileUrl(item, e)}
                                  >
                                    {item.fileName || item.title} ↗
                                  </Text>
                                </Tooltip>
                              ) : (
                                <Text fz={11.5} c="#94a3b8" truncate style={{ maxWidth: "100%" }}>
                                  {item.fileName}
                                </Text>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Flex>
                    </Table.Td>

                    {/* 2. 素材笔记（最多显示三行，点击查看完整笔记） */}
                    <Table.Td
                      style={{ cursor: "pointer", overflow: "hidden" }}
                      onClick={() => onOpenPreviewModal(item)}
                    >
                      {notePlain ? (
                        <Tooltip label="点击查看完整笔记" position="top" multiline w={280}>
                          <Text
                            fz={12.5}
                            c="#334155"
                            lineClamp={3}
                            style={{ lineHeight: 1.55 }}
                          >
                            {notePlain}
                          </Text>
                        </Tooltip>
                      ) : (
                        <Text
                          fz={12}
                          c="#cbd5e1"
                          style={{ fontStyle: "italic" }}
                        >
                          + 暂无笔记，点击查看或编写
                        </Text>
                      )}
                    </Table.Td>

                    {/* 3. 标签（自适应宽度，没有值不显示） */}
                    <Table.Td style={{ overflow: "hidden" }}>
                      {item.tags ? (
                        <Group gap={4} wrap="wrap">
                          {item.tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
                            <Badge key={idx} size="xs" variant="light" color="blue" radius="sm">
                              {t}
                            </Badge>
                          ))}
                        </Group>
                      ) : null}
                    </Table.Td>

                    {/* 4. 更新时间（固定宽度且严格不折行） */}
                    <Table.Td style={{ width: 160, whiteSpace: "nowrap" }}>
                      <Text fz={12} c="#64748b" style={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {formatDateTime(item.updatedAt || item.createdAt)}
                      </Text>
                    </Table.Td>

                    {/* 5. 操作栏（置顶/取消置顶、编辑、删除） */}
                    <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Group gap={2} justify="flex-end" wrap="nowrap">
                        {/* 置顶/取消置顶 */}
                        <Tooltip label={isPinned ? "取消置顶" : "置顶素材"} position="top">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color={isPinned ? "yellow" : "gray"}
                            onClick={(e) => onTogglePin(item, e)}
                          >
                            {isPinned ? <BsPinFill size={14} color="#eab308" /> : <BsPinAngle size={14} />}
                          </ActionIcon>
                        </Tooltip>

                        {/* 编辑 (同新增弹窗逻辑) */}
                        <Tooltip label="编辑" position="top">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="blue"
                            onClick={() => onOpenEditModal(item)}
                          >
                            <FiEdit size={14} />
                          </ActionIcon>
                        </Tooltip>

                        {/* 删除 */}
                        <Tooltip label="删除" position="top">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={(e) => onDeleteMaterial(item.id, e)}
                          >
                            <FiTrash2 size={13} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}

              {list.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5} style={{ textAlign: "center", padding: "80px 0" }}>
                    <Text fz={13.5} c="#94a3b8" mb="xs">
                      暂无素材资料
                    </Text>
                    <Button size="xs" variant="light" color="blue" onClick={onOpenCreateModal}>
                      + 立即上传或新建素材
                    </Button>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Box>
    </Box>
  );
}
