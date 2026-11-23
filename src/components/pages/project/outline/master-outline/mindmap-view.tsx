"use client";

import React, { useMemo, useState, useRef } from "react";
import { Badge, Box, Flex, Text } from "@mantine/core";
import { MasterOutlineNode } from "@/rest/master-outline";
import { STATUS_CONFIG } from "./tree-utils";
import styles from "./style.module.scss";

interface LayoutNode {
  node: MasterOutlineNode;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
}

interface LayoutEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  key: string;
}

const NODE_WIDTH = 210;
const NODE_HEIGHT = 64;
const H_GAP = 64;
const V_GAP = 18;
const PADDING = 48;

function computeMindMapLayout(root: MasterOutlineNode): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  canvasWidth: number;
  canvasHeight: number;
} {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let cursorY = PADDING;

  function place(node: MasterOutlineNode, depth: number, parentId: string | null): LayoutNode {
    const x = PADDING + depth * (NODE_WIDTH + H_GAP);
    const visibleChildren = node.collapsed ? [] : node.children;

    if (visibleChildren.length === 0) {
      const y = cursorY;
      cursorY += NODE_HEIGHT + V_GAP;
      const placed: LayoutNode = { node, depth, x, y, width: NODE_WIDTH, height: NODE_HEIGHT, parentId };
      nodes.push(placed);
      return placed;
    }

    const placedChildren = visibleChildren.map((child) => place(child, depth + 1, node.id));
    const firstChild = placedChildren[0];
    const lastChild = placedChildren[placedChildren.length - 1];
    const y = (firstChild.y + lastChild.y) / 2;

    const placed: LayoutNode = { node, depth, x, y, width: NODE_WIDTH, height: NODE_HEIGHT, parentId };
    nodes.push(placed);

    for (const child of placedChildren) {
      edges.push({
        key: `${node.id}->${child.node.id}`,
        fromX: placed.x + placed.width,
        fromY: placed.y + placed.height / 2,
        toX: child.x,
        toY: child.y + child.height / 2,
      });
    }

    return placed;
  }

  place(root, 0, null);

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  return {
    nodes,
    edges,
    canvasWidth: Math.max(960, maxX + PADDING * 2),
    canvasHeight: Math.max(540, maxY + PADDING * 2),
  };
}

interface MindMapViewProps {
  tree: MasterOutlineNode;
  selectedId: string;
  zoom: number;
  offset: { x: number; y: number };
  onOffsetChange: (next: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onInlineRename: (id: string, title: string) => void;
}

export default function MindMapView({
  tree,
  selectedId,
  zoom,
  offset,
  onOffsetChange,
  onSelect,
  onToggleCollapse,
  onInlineRename,
}: MindMapViewProps) {
  const layout = useMemo(() => computeMindMapLayout(tree), [tree]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-mindmap-node='true']")) return;
    draggingRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingRef.current.active) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    onOffsetChange({ x: draggingRef.current.origX + dx, y: draggingRef.current.origY + dy });
  };

  const handleMouseUp = () => {
    draggingRef.current.active = false;
  };

  const commitInlineEdit = () => {
    if (editingId && editingTitle.trim()) {
      onInlineRename(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <Box
      className={styles.mindmapViewport}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Box
        className={styles.mindmapCanvas}
        w={layout.canvasWidth}
        h={layout.canvasHeight}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
      >
        <svg
          width={layout.canvasWidth}
          height={layout.canvasHeight}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        >
          {layout.edges.map((edge) => {
            const midX = (edge.fromX + edge.toX) / 2;
            const d = `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;
            return <path key={edge.key} d={d} fill="none" stroke="#cbd5e1" strokeWidth={1.6} />;
          })}
        </svg>

        {layout.nodes.map((item) => {
          const isRoot = item.depth === 0;
          const isSelected = item.node.id === selectedId;
          const statusMeta = STATUS_CONFIG[item.node.status || "planned"];
          const hasChildren = item.node.children.length > 0;
          const isEditing = editingId === item.node.id;

          return (
            <div
              key={item.node.id}
              data-mindmap-node="true"
              className={`${styles.nodeCard} ${isRoot ? styles.nodeRoot : ""} ${isSelected ? styles.nodeSelected : ""}`}
              style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.node.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingId(item.node.id);
                setEditingTitle(item.node.title);
              }}
            >
              <Flex align="center" justify="space-between" gap={4} mb={2}>
                <Flex align="center" gap={4} miw={0}>
                  {item.node.tag ? (
                    <Badge size="xs" variant="light" color={isRoot ? "cyan" : "gray"} radius="sm">
                      {item.node.tag}
                    </Badge>
                  ) : null}
                  {item.node.chapterRange ? (
                    <Text fz={10} c="#64748b" truncate>
                      第{item.node.chapterRange}章
                    </Text>
                  ) : null}
                </Flex>
                {!isRoot ? (
                  <Badge size="xs" variant="dot" color={statusMeta.color}>
                    {statusMeta.label}
                  </Badge>
                ) : null}
              </Flex>

              {isEditing ? (
                <input
                  autoFocus
                  value={editingTitle}
                  className={styles.inlineInput}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={commitInlineEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitInlineEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <Text fz={13} fw={isRoot ? 700 : 600} c="#0f172a" truncate title={item.node.title}>
                  {item.node.title}
                </Text>
              )}

              {hasChildren ? (
                <div
                  className={styles.collapseDot}
                  title={item.node.collapsed ? "展开分支" : "收起分支"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(item.node.id);
                  }}
                >
                  {item.node.collapsed ? item.node.children.length : "−"}
                </div>
              ) : null}
            </div>
          );
        })}
      </Box>
    </Box>
  );
}
