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
} from "react-icons/fi";
import { OutlineNode, OutlineNodeType } from "@/rest/outline";
import styles from "../style.module.scss";

interface TreePanelProps {
  nodes: OutlineNode[];
  selectedNodeId: string | null;
  isOverviewSelected: boolean;
  onSelectNode: (node: OutlineNode) => void;
  onSelectOverview: () => void;
  onOpenCreateRoot: () => void;
}

export default function TreePanel({
  nodes,
  selectedNodeId,
  isOverviewSelected,
  onSelectNode,
  onSelectOverview,
  onOpenCreateRoot,
}: TreePanelProps) {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [inputValue, setInputValue] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [allExpanded, setAllExpanded] = useState(true);

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
   * 递归渲染大纲树节点
   */
  const renderTreeNodes = (list: OutlineNode[], depth = 0) => {
    return list.map((node) => {
      const isSelected = !isOverviewSelected && selectedNodeId === node.id;
      const isCollapsed = collapsedMap[node.id];
      const hasChildren = node.children && node.children.length > 0;

      return (
        <Box key={node.id}>
          <Flex justify={'space-between'} p={10} bdrs={8} bg={isSelected ? 'rgba(0, 201, 255, 0.1)' : '#fff'} onClick={() => onSelectNode(node)} >
            <Flex gap={10} align={'center'}>
              {getNodeTypeBadge(node)}
              <Text c={isSelected ? "#00c9ff" : "#334155"} >{node.title}</Text>
            </Flex>
            {hasChildren ? (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={(e) => toggleCollapse(node.id, e)}
                style={{ marginRight: 2 }}
              >
                {isCollapsed ? <FiChevronRight size={12} /> : <FiChevronDown size={12} />}
              </ActionIcon>
            ) : null}
          </Flex>
          {hasChildren && !isCollapsed && renderTreeNodes(node.children!, depth + 1)}
        </Box>
      );
    });
  };

  return (<Box h={'100%'} style={{ borderRight: '1px solid #f1f5f9' }}>
    <Box p={15} pb={0}>
      <Flex mb={15} justify="space-between" align="center">
        <Text fz={15} fw={700} c="#0f172a">
          大纲目录结构
        </Text>
        <Tooltip label="添加顶级大纲节点" withArrow position="bottom">
          <ActionIcon
            size="sm"
            variant="light"
            onClick={onOpenCreateRoot}
          >
            <FiPlus size={15} />
          </ActionIcon>
        </Tooltip>
      </Flex>
      <Flex justify={'space-between'} align={'center'} p={12} bd={'2px solid #f1f5f9'} bdrs={10} onClick={onSelectOverview}>
        <Flex align={'center'} gap={10}>
          <FiFileText size={15} color={isOverviewSelected ? "#0d9488" : "#64748b"} />
          <Text className={styles.overviewTitle}>全文大纲</Text>
        </Flex>
        <Badge size="xs" color="teal" variant="light">总览</Badge>
      </Flex>
    </Box>
    <Divider
      my="xs"
      variant="dashed"
      labelPosition="center"
      label={<Flex align={'center'} justify={'space-between'} py={10} gap={10}>
        <Text size="sm" c={'gray.6'}>细则</Text>
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
      </Flex>}
    />
    <Flex px={15} gap={20}>
      <TextInput
        placeholder="搜索大纲内容..."
        value={inputValue}
        onChange={(e) => setInputValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleTriggerSearch();
        }}
        leftSection={<FiSearch size={13} color="#94a3b8" />}
        rightSection={inputValue ? <ActionIcon size="xs" variant="transparent" color="gray" onClick={handleClearSearch}>
          <FiX size={12} />
        </ActionIcon> : <></>}
      />
      <Button onClick={handleTriggerSearch} size="xs">搜索</Button>
    </Flex>
    <Box p={15} >
      {displayedNodes.length === 0 ? (
        <Flex direction="column" align="center" justify="center" py={30} gap={6} c="#94a3b8">
          <Text fz={12}>
            {searchKeyword ? "未搜到匹配节点" : "暂无细则节点"}
          </Text>
        </Flex>
      ) : (
        renderTreeNodes(displayedNodes)
      )}
    </Box>
  </Box>);
}
