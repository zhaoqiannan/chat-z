// 组件：素材资料表格筛选区（多维类型与状态筛选栏、数据表格与快捷操作）
"use client";

import React from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Table, TextInput, Select, ScrollArea, Group } from "@mantine/core";
import { FiPlus, FiUploadCloud, FiSearch, FiFileText, FiImage, FiBarChart2, FiMusic, FiVideo, FiLink, FiTrash2 } from "react-icons/fi";
import { MaterialData } from "@/rest/project-extensions";

interface MaterialsTableProps {
  list: MaterialData[];
  selectedMaterialId: number | null;
  searchKey: string;
  typeFilter: string;
  statusFilter: string;
  onSearchChange: (val: string) => void;
  onTypeFilterChange: (val: string) => void;
  onStatusFilterChange: (val: string) => void;
  onSelectMaterial: (item: MaterialData) => void;
  onOpenCreateModal: () => void;
  onTriggerUpload: () => void;
  onDeleteMaterial: (id: number, e: React.MouseEvent) => void;
}

export default function MaterialsTable({
  list,
  selectedMaterialId,
  searchKey,
  typeFilter,
  statusFilter,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onSelectMaterial,
  onOpenCreateModal,
  onTriggerUpload,
  onDeleteMaterial,
}: MaterialsTableProps) {
  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <FiImage size={14} color="#10b981" />;
      case "data":
        return <FiBarChart2 size={14} color="#f59e0b" />;
      case "audio":
        return <FiMusic size={14} color="#8b5cf6" />;
      case "video":
        return <FiVideo size={14} color="#ec4899" />;
      case "link":
        return <FiLink size={14} color="#06b6d4" />;
      default:
        return <FiFileText size={14} color="#64748b" />;
    }
  };

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case "image":
        return "图片";
      case "data":
        return "数据";
      case "audio":
        return "音频";
      case "video":
        return "视频";
      case "link":
        return "链接";
      default:
        return "文档";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return <Badge size="xs" color="teal" variant="light">已处理</Badge>;
      case "processing":
        return <Badge size="xs" color="blue" variant="light">处理中</Badge>;
      case "failed":
        return <Badge size="xs" color="red" variant="light">失败</Badge>;
      default:
        return <Badge size="xs" color="gray" variant="light">待处理</Badge>;
    }
  };

  const formatRelativeTime = (time?: string | number) => {
    if (!time) return "刚刚";
    const now = Date.now();
    const past = new Date(time).getTime();
    const diffMs = now - past;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "刚刚";
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    return `${new Date(time).toLocaleDateString()}`;
  };

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px", overflow: "hidden" }}>
      <Flex justify="space-between" align="center" mb="md">
        <Text fz={18} fw={800} c="#0f172a">素材库</Text>
        <Group gap="xs">
          <Button size="xs" variant="default" leftSection={<FiPlus size={12} />} onClick={onOpenCreateModal}>
            + 新建
          </Button>
          <Button size="xs" color="cyan" leftSection={<FiUploadCloud size={13} />} onClick={onTriggerUpload}>
            上传素材
          </Button>
        </Group>
      </Flex>

      <Flex gap="sm" align="center" mb="md" wrap="wrap">
        <TextInput
          placeholder="搜索素材名称..."
          size="xs"
          leftSection={<FiSearch size={13} />}
          value={searchKey}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 220 }}
        />

        <Select
          size="xs"
          value={typeFilter}
          onChange={(val) => onTypeFilterChange(val || "all")}
          data={[
            { value: "all", label: "全部类型" },
            { value: "document", label: "文档" },
            { value: "image", label: "图片" },
            { value: "data", label: "数据" },
            { value: "audio", label: "音频" },
            { value: "video", label: "视频" },
            { value: "link", label: "链接" },
          ]}
          style={{ width: 110 }}
        />

        <Select
          size="xs"
          value={statusFilter}
          onChange={(val) => onStatusFilterChange(val || "all")}
          data={[
            { value: "all", label: "全部状态" },
            { value: "processed", label: "已处理" },
            { value: "processing", label: "处理中" },
            { value: "pending", label: "待处理" },
            { value: "failed", label: "失败" },
          ]}
          style={{ width: 110 }}
        />
      </Flex>

      <Box pos="relative" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ScrollArea style={{ flex: 1 }}>
          <Table highlightOnHover verticalSpacing="xs" fz={12.5}>
            <Table.Thead bg="#fafbfc">
              <Table.Tr>
                <Table.Th style={{ color: "#64748b", fontWeight: 600 }}>名称</Table.Th>
                <Table.Th style={{ color: "#64748b", fontWeight: 600, width: 80 }}>类型</Table.Th>
                <Table.Th style={{ color: "#64748b", fontWeight: 600, width: 90 }}>状态</Table.Th>
                <Table.Th style={{ color: "#64748b", fontWeight: 600, width: 120 }}>关联内容</Table.Th>
                <Table.Th style={{ color: "#64748b", fontWeight: 600, width: 130 }}>标签</Table.Th>
                <Table.Th style={{ color: "#64748b", fontWeight: 600, width: 90 }}>更新时间</Table.Th>
                <Table.Th style={{ color: "#64748b", fontWeight: 600, width: 60 }}>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {list.map((item) => {
                const isSelected = selectedMaterialId === item.id;
                return (
                  <Table.Tr
                    key={item.id}
                    onClick={() => onSelectMaterial(item)}
                    style={{
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#f0f9ff" : undefined,
                      borderLeft: isSelected ? "3px solid #0284c7" : "3px solid transparent",
                    }}
                  >
                    <Table.Td>
                      <Text fz={13} fw={isSelected ? 700 : 600} c={isSelected ? "#0284c7" : "#1e293b"}>
                        {item.title}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {getFileTypeIcon(item.fileType)}
                        <Text fz={12} c="#64748b">{getFileTypeLabel(item.fileType)}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(item.status)}</Table.Td>
                    <Table.Td>
                      <Text fz={12} c="#475569">{item.linkedTarget || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz={12} c="#64748b" truncate="end">{item.tags || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz={11.5} c="#94a3b8">{formatRelativeTime(item.updatedAt || item.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={(e) => onDeleteMaterial(item.id, e)}>
                        <FiTrash2 size={12} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}

              {list.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: "center", padding: "60px 0" }}>
                    <Text fz={13} c="#94a3b8">暂无素材资料，可点击右上角「+ 新建」或「上传素材」</Text>
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
