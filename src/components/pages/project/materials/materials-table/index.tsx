// 组件：素材资料表格区（名称大宽、智能摘要占位、标签、精确时间与快捷操作）
"use client";

import React from "react";
import { Box, Flex, Text, Button, Badge, ActionIcon, Table, TextInput, ScrollArea, Group, Tooltip } from "@mantine/core";
import { FiPlus, FiSearch, FiFileText, FiImage, FiBarChart2, FiMusic, FiVideo, FiLink, FiZap, FiEye, FiTrash2, FiDownloadCloud } from "react-icons/fi";
import dayjs from "dayjs";
import { MaterialData } from "@/rest/project-extensions";

interface MaterialsTableProps {
  list: MaterialData[];
  searchKey: string;
  onSearchChange: (val: string) => void;
  onOpenCreateModal: () => void;
  onOpenSummaryModal: (item: MaterialData) => void;
  onOpenPreviewModal: (item: MaterialData) => void;
  onDeleteMaterial: (id: number, e: React.MouseEvent) => void;
}

export default function MaterialsTable({
  list,
  searchKey,
  onSearchChange,
  onOpenCreateModal,
  onOpenSummaryModal,
  onOpenPreviewModal,
  onDeleteMaterial,
}: MaterialsTableProps) {
  const handleDownload = (item: MaterialData, e: React.MouseEvent) => {
    e.stopPropagation();
    const filename = item.fileName || `${item.title || "素材"}.txt`;
    const contentText = item.content || item.extractedLore || "";
    const targetUrl = item.sourceUrl || item.fileUrl || "";

    if (item.fileUrl && !item.fileUrl.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = item.fileUrl;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (contentText) {
      const blob = new Blob([contentText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".txt") || filename.endsWith(".md") ? filename : `${filename}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (targetUrl) {
      window.open(targetUrl, "_blank");
    } else {
      alert("暂无可供下载的附件或正文内容");
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
    if (!time) return "—";
    try {
      return dayjs(time).format("YYYY-MM-DD HH:mm:ss");
    } catch (_) {
      return "—";
    }
  };

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 24px", overflow: "hidden" }}>
      {/* 顶部标题与新建按钮 */}
      <Flex justify="space-between" align="center" mb="md">
        <Box>
          <Text fz={20} fw={800} c="#0f172a">
            素材库
          </Text>
          <Text fz={12} c="#94a3b8" mt={2}>
            沉淀小说世界观硬核资料、科学设定、参考文档与 AI 写作知识源
          </Text>
        </Box>
        <Button size="xs" leftSection={<FiPlus size={14} />} onClick={onOpenCreateModal}>
          + 新建素材
        </Button>
      </Flex>

      {/* 顶部搜索框（已精简移除类型和状态下拉） */}
      <Flex gap="sm" align="center" mb="md">
        <TextInput
          placeholder="搜索素材名称、摘要或标签..."
          size="xs"
          leftSection={<FiSearch size={14} />}
          value={searchKey}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 320 }}
        />
      </Flex>

      {/* 表格区 */}
      <Box pos="relative" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ScrollArea style={{ flex: 1 }}>
          <Table highlightOnHover verticalSpacing="sm" fz={13}>
            <Table.Thead bg="#f8fafc">
              <Table.Tr>
                <Table.Th style={{ color: "#475569", fontWeight: 700, minWidth: 260 }}>名称</Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, minWidth: 320 }}>智能摘要</Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: 160 }}>标签</Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: 180 }}>更新时间</Table.Th>
                <Table.Th style={{ color: "#475569", fontWeight: 700, width: 180, textAlign: "right" }}>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {list.map((item) => {
                return (
                  <Table.Tr key={item.id} style={{ transition: "background-color 0.15s ease" }}>
                    {/* 名称（宽度大，支持点击直接打开查看） */}
                    <Table.Td style={{ cursor: "pointer" }} onClick={() => onOpenPreviewModal(item)}>
                      <Flex align="center" gap={8}>
                        <Box style={{ flexShrink: 0 }}>
                          {getFileTypeIcon(item.fileType)}
                        </Box>
                        <Box>
                          <Text fz={13.5} fw={700} c="#1e293b" style={{ lineHeight: 1.4 }}>
                            {item.title}
                          </Text>
                          {item.fileSize && (
                            <Text fz={11} c="#94a3b8">
                              {item.fileSize}
                            </Text>
                          )}
                        </Box>
                      </Flex>
                    </Table.Td>

                    {/* 智能摘要（没有点击生成过显示占位符） */}
                    <Table.Td>
                      {item.aiSummary ? (
                        <Text
                          fz={12.5}
                          c="#334155"
                          lineClamp={2}
                          title={item.aiSummary}
                          style={{ lineHeight: 1.5 }}
                        >
                          {item.aiSummary}
                        </Text>
                      ) : (
                        <Text
                          fz={12}
                          c="#94a3b8"
                          style={{ fontStyle: "italic", cursor: "pointer" }}
                          onClick={() => onOpenSummaryModal(item)}
                        >
                          [未生成智能摘要，点击生成]
                        </Text>
                      )}
                    </Table.Td>

                    {/* 标签 */}
                    <Table.Td>
                      {item.tags ? (
                        <Group gap={4} wrap="wrap">
                          {item.tags.split(/[,，\s]+/).filter(Boolean).map((t, idx) => (
                            <Badge key={idx} size="xs" variant="light" color="blue">
                              {t}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Text fz={12} c="#cbd5e1">—</Text>
                      )}
                    </Table.Td>

                    {/* 更新时间（年月日时分秒） */}
                    <Table.Td>
                      <Text fz={12} c="#64748b" style={{ fontFamily: "monospace" }}>
                        {formatDateTime(item.updatedAt || item.createdAt)}
                      </Text>
                    </Table.Td>

                    {/* 操作（智能摘要、查看、下载、删除） */}
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={6} justify="flex-end" wrap="nowrap">
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="blue"
                          leftSection={<FiZap size={11} />}
                          onClick={() => onOpenSummaryModal(item)}
                        >
                          智能摘要
                        </Button>
                        <Button
                          size="compact-xs"
                          variant="default"
                          leftSection={<FiEye size={11} />}
                          onClick={() => onOpenPreviewModal(item)}
                        >
                          查看
                        </Button>
                        <Tooltip label="下载附件或正文" position="top">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="indigo"
                            onClick={(e) => handleDownload(item, e)}
                          >
                            <FiDownloadCloud size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="删除素材" position="top">
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
                    <Button size="xs" variant="light" onClick={onOpenCreateModal}>
                      + 立即新建或上传素材
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
