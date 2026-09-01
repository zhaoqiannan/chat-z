"use client";

import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  ActionIcon,
  Tooltip,
  Badge,
  TextInput,
  Divider,
  Button,
  Collapse,
} from "@mantine/core";
import {
  FiChevronDown,
  FiChevronRight,
  FiPlus,
  FiSearch,
  FiFileText,
  FiMinimize2,
  FiMaximize2,
  FiX,
  FiClock,
} from "react-icons/fi";
import { OutlineNode, OutlineNodeType } from "@/rest/outline";

interface TreePanelProps {
  nodes: OutlineNode[];
  selectedNodeId: string | null;
  isOverviewSelected: boolean;
  onSelectNode: (node: OutlineNode) => void;
  onSelectOverview: () => void;
  onOpenCreateRoot: () => void;
  onOpenCreateChild?: (parentId: string) => void;
  onOpenHistory?: () => void;
}

export default function TreePanel({
  nodes,
  selectedNodeId,
  isOverviewSelected,
  onSelectNode,
  onSelectOverview,
  onOpenCreateRoot,
  onOpenCreateChild,
  onOpenHistory,
}: TreePanelProps) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [allExpanded, setAllExpanded] = useState(true);

  const INDENT_SIZE = 22;

  /**
   * 切换单个节点的展开/折叠状态
   */
  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /**
   * 一键全部展开或全部折叠
   */
  const handleToggleExpandAll = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const newMap: Record<string, boolean> = {};
    const traverse = (list: OutlineNode[]) => {
      list.forEach((n) => {
        if (!nextState) {
          newMap[n.id] = true;
        }
        if (n.children && n.children.length > 0) {
          traverse(n.children);
        }
      });
    };
    traverse(nodes);
    setCollapsedMap(newMap);
  };

  /**
   * 触发搜索过滤
   */
  const handleTriggerSearch = () => {
    setSearchKeyword(inputValue.trim());
  };

  /**
   * 清除搜索条件
   */
  const handleClearSearch = () => {
    setInputValue("");
    setSearchKeyword("");
  };

  /**
   * 获取节点类型徽章展示
   */
  const getNodeTypeBadge = (node: OutlineNode) => {
    switch (node.type) {
      case "story":
        return <Badge size="xs" color="violet" variant="filled">主线</Badge>;
      case "volume":
        return <Badge size="xs" color="indigo" variant="light">卷</Badge>;
      case "act":
        return <Badge size="xs" color="blue" variant="light">幕</Badge>;
      case "branch":
        return <Badge size="xs" color="orange" variant="light">支线</Badge>;
      case "scene":
      default:
        if (node.pointType === "climax") return <Badge size="xs" color="red" variant="light">高潮</Badge>;
        if (node.pointType === "twist") return <Badge size="xs" color="violet" variant="light">转折</Badge>;
        if (node.pointType === "foreshadow") return <Badge size="xs" color="teal" variant="light">伏笔</Badge>;
        if (node.pointType === "conflict") return <Badge size="xs" color="orange" variant="light">冲突</Badge>;
        return <Badge size="xs" color="gray" variant="light">情节</Badge>;
    }
  };

  /**
   * 树节点递归搜索过滤
   */
  const filterTree = (list: OutlineNode[]): OutlineNode[] => {
    if (!searchKeyword) return list;
    const q = searchKeyword.toLowerCase();

    return list
      .map((node) => {
        const matchesSelf =
          node.title.toLowerCase().includes(q) ||
          node.goal.toLowerCase().includes(q) ||
          (node.conflict && node.conflict.toLowerCase().includes(q));

        const filteredChildren = node.children ? filterTree(node.children) : [];
        if (matchesSelf || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as OutlineNode[];
  };

  const displayedNodes = filterTree(nodes);

  /**
   * 递归渲染大纲树节点 (参考 aura-frontend 层级与引导线)
   */
  const renderTreeNodes = (list: OutlineNode[], level = 0) => {
    return list.map((node) => {
      const isSelected = !isOverviewSelected && selectedNodeId === node.id;
      const isCollapsed = !!collapsedMap[node.id];
      const hasChildren = node.children && node.children.length > 0;
      const isHovered = hoveredNodeId === node.id;

      return (
        <Box key={node.id} pos="relative">
          {/* 单个节点行 */}
          <Flex
            pos="relative"
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => onSelectNode(node)}
            py={6}
            px={8}
            my={2}
            bdrs={6}
            align="center"
            justify="space-between"
            bg={
              isSelected
                ? "rgba(0, 201, 255, 0.12)"
                : isHovered
                  ? "rgba(0, 201, 255, 0.04)"
                  : "transparent"
            }
            style={{
              paddingLeft: `${level * INDENT_SIZE + 8}px`,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
          >
            <Flex align="center" gap={8} style={{ flex: 1, minWidth: 0 }}>
              {/* 折叠/展开控制按钮 */}
              {hasChildren ? (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={(e) => toggleCollapse(node.id, e)}
                  style={{ flexShrink: 0 }}
                >
                  {isCollapsed ? <FiChevronRight size={12} /> : <FiChevronDown size={12} />}
                </ActionIcon>
              ) : (
                <span style={{ width: 18, display: "inline-block", flexShrink: 0 }} />
              )}

              {/* 类型徽章 */}
              <Box style={{ flexShrink: 0 }}>{getNodeTypeBadge(node)}</Box>

              {/* 标题 */}
              <Text
                size="sm"
                fw={isSelected ? 600 : node.type === "story" || node.type === "volume" ? 600 : 400}
                c={isSelected ? "#0096bd" : "#334155"}
                truncate
                style={{ flex: 1 }}
              >
                {node.title}
              </Text>
            </Flex>

            {/* 悬浮快捷添加子节点按钮 */}
            {onOpenCreateChild && (
              <Flex
                align="center"
                style={{
                  opacity: isHovered || isSelected ? 1 : 0,
                  visibility: isHovered || isSelected ? "visible" : "hidden",
                  transition: "opacity 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <Tooltip label="在此节点下添加子节点" withArrow position="top">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateChild(node.id);
                    }}
                  >
                    <FiPlus size={12} />
                  </ActionIcon>
                </Tooltip>
              </Flex>
            )}
          </Flex>

          {/* 子节点折叠层 */}
          {hasChildren && !isCollapsed && (
            <Box pos="relative">
              {renderTreeNodes(node.children!, level + 1)}
            </Box>
          )}

          {/* 垂直层级导引线 */}
          {level > 0 && (
            <Box
              pos="absolute"
              left={`${(level - 1) * INDENT_SIZE + 16}px`}
              top={0}
              bottom={0}
              w={1}
              bg="#f1f5f9"
              style={{ pointerEvents: "none", zIndex: 0 }}
            />
          )}
        </Box>
      );
    });
  };

  return (
    <Box h="100%" style={{ borderRight: "1px solid #f1f5f9" }}>
      <Box p={15} pb={0}>
        <Flex mb={15} justify="space-between" align="center">
          <Text fz={15} fw={700} c="#0f172a">
            大纲目录结构
          </Text>
          <Flex align="center" gap={6}>
            {onOpenHistory && (
              <Tooltip label="AI 推演历史版本库" withArrow position="bottom">
                <ActionIcon size="sm" variant="subtle" color="blue" onClick={onOpenHistory}>
                  <FiClock size={15} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="添加顶级大纲节点" withArrow position="bottom">
              <ActionIcon size="sm" variant="light" onClick={onOpenCreateRoot}>
                <FiPlus size={15} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        </Flex>

        <Flex
          justify="space-between"
          align="center"
          p={12}
          bd="2px solid #f1f5f9"
          bdrs={10}
          bg={isOverviewSelected ? "rgba(0, 201, 255, 0.08)" : "#fff"}
          onClick={onSelectOverview}
          style={{ cursor: "pointer", transition: "all 0.15s ease" }}
        >
          <Flex align="center" gap={10}>
            <FiFileText size={15} color={isOverviewSelected ? "#0096bd" : "#64748b"} />
            <Text fz={13} fw={isOverviewSelected ? 600 : 500} c={isOverviewSelected ? "cyan.8" : "dark.6"} style={{ flex: 1 }}>
              全文大纲
            </Text>
          </Flex>
          <Badge variant="light">
            总览
          </Badge>
        </Flex>
      </Box>

      <Divider
        my="xs"
        variant="dashed"
        labelPosition="center"
        label={
          <Flex align="center" justify="space-between" py={10} gap={10}>
            <Text size="sm" c="gray.6">
              细则
            </Text>
            <Tooltip label={allExpanded ? "全部收起" : "全部展开"} withArrow position="top">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray.6"
                onClick={handleToggleExpandAll}
              >
                {allExpanded ? <FiMinimize2 size={12} /> : <FiMaximize2 size={12} />}
              </ActionIcon>
            </Tooltip>
          </Flex>
        }
      />

      <Flex px={15} gap={10} mb={10}>
        <TextInput
          placeholder="搜索大纲内容..."
          value={inputValue}
          style={{ flex: 1 }}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTriggerSearch();
          }}
          leftSection={<FiSearch size={13} color="#94a3b8" />}
          rightSection={
            inputValue ? (
              <ActionIcon size="xs" variant="transparent" color="gray" onClick={handleClearSearch}>
                <FiX size={12} />
              </ActionIcon>
            ) : null
          }
        />
        <Button onClick={handleTriggerSearch}>
          搜索
        </Button>
      </Flex>

      <Box p={15} pt={0} style={{ overflowY: "auto", maxHeight: "calc(100vh - 270px)" }}>
        {displayedNodes.length === 0 ? (
          <Flex direction="column" align="center" justify="center" py={30} gap={6} c="#94a3b8">
            <Text fz={12}>{searchKeyword ? "未搜到匹配节点" : "暂无细则节点"}</Text>
          </Flex>
        ) : (
          renderTreeNodes(displayedNodes)
        )}
      </Box>
    </Box>
  );
}
