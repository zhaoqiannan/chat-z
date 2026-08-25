"use client";

import React from "react";
import { Box, Flex, Text, Button, ActionIcon, Tooltip } from "@mantine/core";
import {
  FiPlus,
  FiChevronRight,
  FiChevronDown,
  FiTrash2,
  FiZap,
  FiFolder,
  FiFileText,
  FiCompass,
  FiActivity,
} from "react-icons/fi";
import { OutlineNode } from "@/rest/outline";
import styles from "../style.module.scss";

interface TreePanelProps {
  nodes: OutlineNode[];
  selectedNodeId: string | null;
  onSelectNode: (node: OutlineNode) => void;
  onOpenCreate: (parentId?: string | null) => void;
  onDeleteNode: (id: string) => void;
  onOpenAiPlan: () => void;
  loading?: boolean;
}

export default function TreePanel({
  nodes,
  selectedNodeId,
  onSelectNode,
  onOpenCreate,
  onDeleteNode,
  onOpenAiPlan,
  loading,
}: TreePanelProps) {
  const [expandedIds, setExpandedIds] = React.useState<Record<string, boolean>>({});

  // 默认全部展开
  React.useEffect(() => {
    const initExp: Record<string, boolean> = {};
    const expandAll = (list: OutlineNode[]) => {
      list.forEach((item) => {
        initExp[item.id] = true;
        if (item.children) expandAll(item.children);
      });
    };
    expandAll(nodes);
    setExpandedIds(initExp);
  }, [nodes]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "volume":
        return <FiFolder size={15} color="#4338ca" />;
      case "act":
        return <FiCompass size={15} color="#b45309" />;
      case "scene":
        return <FiFileText size={15} color="#15803d" />;
      case "event":
        return <FiActivity size={15} color="#be185d" />;
      default:
        return <FiFileText size={15} />;
    }
  };

  const getNodeTypeLabel = (type: string) => {
    switch (type) {
      case "volume":
        return "卷";
      case "act":
        return "幕";
      case "scene":
        return "情景";
      case "event":
        return "事件";
      default:
        return type;
    }
  };

  const renderTreeNodes = (list: OutlineNode[], depth = 0) => {
    return list.map((node) => {
      const isExpanded = expandedIds[node.id];
      const hasChildren = node.children && node.children.length > 0;
      const isSelected = selectedNodeId === node.id;

      return (
        <React.Fragment key={node.id}>
          <Box
            className={`${styles.nodeItem} ${isSelected ? styles.active : ""}`}
            style={{ paddingLeft: `${depth * 18 + 10}px` }}
            onClick={() => onSelectNode(node)}
          >
            {hasChildren ? (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={(e) => toggleExpand(node.id, e)}
                style={{ marginRight: 2 }}
              >
                {isExpanded ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}
              </ActionIcon>
            ) : (
              <Box style={{ width: 18 }} />
            )}

            <span style={{ display: "flex", alignItems: "center", marginRight: 4 }}>
              {getNodeIcon(node.type)}
            </span>

            <span className={`${styles.nodeBadge} ${styles[node.type] || ""}`}>
              {getNodeTypeLabel(node.type)}
            </span>

            <span className={styles.nodeTitle} title={node.title}>
              {node.title}
            </span>

            <div className={styles.nodeActions}>
              <Tooltip label="添加子节点" withArrow position="top">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCreate(node.id);
                  }}
                >
                  <FiPlus size={13} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="删除节点" withArrow position="top">
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(node.id);
                  }}
                >
                  <FiTrash2 size={13} />
                </ActionIcon>
              </Tooltip>
            </div>
          </Box>

          {hasChildren && isExpanded && (
            <div>{renderTreeNodes(node.children!, depth + 1)}</div>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <aside className={styles.treePanel}>
      <div className={styles.treeHeader}>
        <Flex align="center" gap={6}>
          <Text fw={700} fz={15} c="#1e293b">
            大纲架构树
          </Text>
          <Text fz={12} c="#94a3b8">
            ({nodes.length} 个根节点)
          </Text>
        </Flex>

        <Flex gap={6}>
          <Tooltip label="AI 智能大纲规划" withArrow position="bottom">
            <Button
              size="xs"
              variant="light"
              color="violet"
              leftSection={<FiZap size={13} />}
              onClick={onOpenAiPlan}
            >
              AI 规划
            </Button>
          </Tooltip>

          <Button
            size="xs"
            leftSection={<FiPlus size={13} />}
            onClick={() => onOpenCreate(null)}
          >
            新建
          </Button>
        </Flex>
      </div>

      <div className={styles.treeContent}>
        {nodes.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            py={40}
            gap={10}
            c="#94a3b8"
          >
            <FiFolder size={36} strokeWidth={1.5} />
            <Text fz={13}>暂无大纲节点</Text>
            <Button
              size="xs"
              variant="outline"
              color="blue"
              onClick={() => onOpenCreate(null)}
            >
              创建首个大纲节点
            </Button>
          </Flex>
        ) : (
          renderTreeNodes(nodes)
        )}
      </div>
    </aside>
  );
}
