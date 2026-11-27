"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActionIcon, Box, Flex, Text, Tooltip } from "@mantine/core";
import { FiArrowDown, FiArrowUp, FiCornerDownLeft, FiCornerDownRight, FiEdit2, FiFileText, FiGitMerge, FiMaximize2, FiMinimize2, FiPlus, FiRefreshCw, FiShield, FiTrash2, FiZap, FiZoomIn, FiZoomOut } from "react-icons/fi";
import { MasterOutlineNode, MasterOutlineSide, MasterOutlineStatus } from "@/rest/master-outline";
import { ChildInsertPosition, STATUS_CONFIG, SiblingInsertPosition, TAG_PRESETS, findNode, findSiblingMeta, getChapterRangeProgress } from "./tree-utils";
import styles from "./style.module.scss";

type LayoutSide = "center" | "left" | "right";

interface LayoutNode {
  node: MasterOutlineNode;
  depth: number;
  side: LayoutSide;
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

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

interface MetaPopoverState {
  type: "tag" | "status";
  nodeId: string;
  x: number;
  y: number;
}

type EditingTarget = { id: string; field: "title" | "note" | "chapterRange" } | null;

export interface MindMapViewHandle {
  enterFullscreen: () => void;
  centerOnRoot: () => void;
}

const NODE_WIDTH = 256;
const MIN_NODE_WIDTH = 180;
const MAX_NODE_WIDTH = 640;
const MIN_NODE_HEIGHT = 72;
const MAX_NODE_HEIGHT = 640;
const H_GAP = 84;
const V_GAP = 30;
const PADDING = 64;

const STATUS_DOT_COLOR: Record<MasterOutlineStatus, string> = {
  planned: "#94a3b8",
  in_progress: "#00c9ff",
  completed: "#22c55e",
};

function getNodeWidth(node: MasterOutlineNode): number {
  if (typeof node.width === "number" && !isNaN(node.width) && node.width > 0) {
    return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.round(node.width)));
  }
  return NODE_WIDTH;
}

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  return text.split("\n").reduce((sum, line) => {
    const weightedLen = Array.from(line).reduce((acc, ch) => acc + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0);
    return sum + Math.max(1, Math.ceil(weightedLen / Math.max(8, charsPerLine)));
  }, 0);
}

function estimateNodeHeight(node: MasterOutlineNode): number {
  const width = getNodeWidth(node);
  const titleChars = Math.max(10, Math.floor((width - 28) / 13.5));
  const noteChars = Math.max(12, Math.floor((width - 28) / 11.5));
  const titleLines = estimateWrappedLines(node.title || "", titleChars);
  const noteLines = estimateWrappedLines(node.note?.trim() || "点击添加要点说明...", noteChars);
  const estimated = Math.max(82, Math.ceil(22 + titleLines * 19 + 10 + noteLines * 16.5 + 24));
  if (typeof node.height === "number" && !isNaN(node.height) && node.height > 0) {
    return Math.max(estimated, Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(node.height))));
  }
  return estimated;
}

function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function computeMindMapLayout(
  root: MasterOutlineNode,
  measuredHeights: Record<string, number>
): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  canvasWidth: number;
  canvasHeight: number;
  rootNode: LayoutNode;
} {
  const leftRoots = root.collapsed ? [] : root.children.filter((c) => c.side === "left");
  const rightRoots = root.collapsed ? [] : root.children.filter((c) => c.side !== "left");

  interface TempNode {
    node: MasterOutlineNode;
    depth: number;
    side: "left" | "right";
    relX: number;
    y: number;
    width: number;
    height: number;
    parentId: string;
    children: TempNode[];
  }

  const rootWidth = getNodeWidth(root);

  function layoutSubtreeList(
    roots: MasterOutlineNode[],
    side: "left" | "right"
  ): { items: TempNode[]; flat: TempNode[]; totalHeight: number; minRelX: number } {
    let cursorY = 0;
    let minRelX = 0;
    const flat: TempNode[] = [];

    function place(node: MasterOutlineNode, depth: number, parentId: string, parentRelX: number, parentWidth: number): TempNode {
      const width = getNodeWidth(node);
      const relX = side === "left" ? parentRelX - H_GAP - width : parentRelX + parentWidth + H_GAP;
      if (relX < minRelX) minRelX = relX;

      const measured = measuredHeights[node.id];
      const baseHeight = measured ?? estimateNodeHeight(node);
      const customHeight = typeof node.height === "number" && node.height > 0 ? Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(node.height))) : 0;
      const height = Math.max(baseHeight, customHeight);
      const visibleChildren = node.collapsed ? [] : node.children;

      if (visibleChildren.length === 0) {
        const y = cursorY;
        cursorY += height + V_GAP;
        const placed: TempNode = { node, depth, side, relX, y, width, height, parentId, children: [] };
        flat.push(placed);
        return placed;
      }

      const startY = cursorY;
      const placedChildren = visibleChildren.map((child) => place(child, depth + 1, node.id, relX, width));
      const firstChild = placedChildren[0];
      const lastChild = placedChildren[placedChildren.length - 1];
      const childrenMidY = (firstChild.y + firstChild.height / 2 + lastChild.y + lastChild.height / 2) / 2;
      const y = Math.max(startY, childrenMidY - height / 2);
      cursorY = Math.max(cursorY, y + height + V_GAP);

      const placed: TempNode = { node, depth, side, relX, y, width, height, parentId, children: placedChildren };
      flat.push(placed);
      return placed;
    }

    const items = roots.map((child) => place(child, 1, root.id, 0, rootWidth));
    const totalHeight = items.length > 0 ? Math.max(0, cursorY - V_GAP) : 0;
    return { items, flat, totalHeight, minRelX };
  }

  const leftLayout = layoutSubtreeList(leftRoots, "left");
  const rightLayout = layoutSubtreeList(rightRoots, "right");
  const rootCustomH = typeof root.height === "number" && root.height > 0 ? Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.round(root.height))) : 0;
  const rootHeight = Math.max(measuredHeights[root.id] ?? estimateNodeHeight(root), rootCustomH);
  const contentHeight = Math.max(leftLayout.totalHeight, rightLayout.totalHeight, rootHeight);

  const rootX = leftLayout.minRelX < 0 ? PADDING - leftLayout.minRelX : PADDING + 40;
  const rootY = PADDING + (contentHeight - rootHeight) / 2;

  const rootNode: LayoutNode = {
    node: root,
    depth: 0,
    side: "center",
    x: rootX,
    y: rootY,
    width: rootWidth,
    height: rootHeight,
    parentId: null,
  };

  const nodes: LayoutNode[] = [rootNode];
  const edges: LayoutEdge[] = [];

  const leftOffsetY = PADDING + (contentHeight - leftLayout.totalHeight) / 2;
  const rightOffsetY = PADDING + (contentHeight - rightLayout.totalHeight) / 2;

  const nodeMap = new Map<string, LayoutNode>();
  nodeMap.set(root.id, rootNode);

  for (const item of leftLayout.flat) {
    const placed: LayoutNode = {
      node: item.node,
      depth: item.depth,
      side: "left",
      x: rootX + item.relX,
      y: item.y + leftOffsetY,
      width: item.width,
      height: item.height,
      parentId: item.parentId,
    };
    nodes.push(placed);
    nodeMap.set(placed.node.id, placed);
  }

  for (const item of rightLayout.flat) {
    const placed: LayoutNode = {
      node: item.node,
      depth: item.depth,
      side: "right",
      x: rootX + item.relX,
      y: item.y + rightOffsetY,
      width: item.width,
      height: item.height,
      parentId: item.parentId,
    };
    nodes.push(placed);
    nodeMap.set(placed.node.id, placed);
  }

  for (const placed of nodes) {
    if (!placed.parentId) continue;
    const parent = nodeMap.get(placed.parentId);
    if (!parent) continue;
    if (placed.side === "left") {
      edges.push({
        key: `${parent.node.id}->${placed.node.id}`,
        fromX: parent.x,
        fromY: parent.y + parent.height / 2,
        toX: placed.x + placed.width,
        toY: placed.y + placed.height / 2,
      });
    } else {
      edges.push({
        key: `${parent.node.id}->${placed.node.id}`,
        fromX: parent.x + parent.width,
        fromY: parent.y + parent.height / 2,
        toX: placed.x,
        toY: placed.y + placed.height / 2,
      });
    }
  }

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
    rootNode,
  };
}

interface MindMapViewProps {
  tree: MasterOutlineNode;
  selectedId: string;
  autoEditNodeId?: string | null;
  onAutoEditHandled?: () => void;
  zoom: number;
  offset: { x: number; y: number };
  onOffsetChange: (next: { x: number; y: number }) => void;
  onTransformChange: (nextZoom: number, nextOffset: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onInlineUpdate: (id: string, patch: Partial<Omit<MasterOutlineNode, "id" | "children">>) => void;
  onAddChild: (parentId: string, position?: ChildInsertPosition, side?: MasterOutlineSide) => void;
  onAddSibling: (targetId: string, position: SiblingInsertPosition) => void;
  onMoveNode: (id: string, dir: "up" | "down") => void;
  onDeleteNode: (id: string) => void;
  onJumpToAiAnalysis: (chapterRange: string, title: string) => void;
  onOpenLogicDeduction: (nodeId: string) => void;
  onJumpToPlotDeduction?: (nodeId: string) => void;
  writtenChapterSet?: Set<number>;
}

const MindMapView = forwardRef<MindMapViewHandle, MindMapViewProps>(function MindMapView(
  {
    tree,
    selectedId,
    autoEditNodeId,
    onAutoEditHandled,
    zoom,
    offset,
    onOffsetChange,
    onTransformChange,
    onSelect,
    onToggleCollapse,
    onInlineUpdate,
    onAddChild,
    onAddSibling,
    onMoveNode,
    onDeleteNode,
    onJumpToAiAnalysis,
    onOpenLogicDeduction,
    onJumpToPlotDeduction,
    writtenChapterSet,
  },
  ref
) {
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const layout = useMemo(() => computeMindMapLayout(tree, measuredHeights), [tree, measuredHeights]);
  const [editing, setEditing] = useState<EditingTarget>(null);
  const [editingValue, setEditingValue] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [metaPopover, setMetaPopover] = useState<MetaPopoverState | null>(null);
  const [customTagInput, setCustomTagInput] = useState("");
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const nodeElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<ResizeObserver | null>(null);
  const hasAutoCenteredRef = useRef(false);
  const transformRef = useRef({ zoom, offset });
  const onTransformChangeRef = useRef(onTransformChange);
  const onInlineUpdateRef = useRef(onInlineUpdate);
  const layoutRootRef = useRef(layout.rootNode);
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const isFullscreen = isNativeFullscreen || isFallbackFullscreen;

  useEffect(() => {
    transformRef.current = { zoom, offset };
  }, [zoom, offset]);

  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

  useEffect(() => {
    onInlineUpdateRef.current = onInlineUpdate;
  }, [onInlineUpdate]);

  useEffect(() => {
    layoutRootRef.current = layout.rootNode;
  }, [layout.rootNode]);

  // 监听原生全屏状态变化
  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === viewportRef.current));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // 降级全屏时支持 Esc 退出
  useEffect(() => {
    if (!isFallbackFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFallbackFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFallbackFullscreen]);

  const enterFullscreen = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setIsFallbackFullscreen(true));
    } else {
      setIsFallbackFullscreen(true);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFallbackFullscreen(false);
  }, []);

  const centerOnRoot = useCallback(() => {
    const el = viewportRef.current;
    const rn = layoutRootRef.current;
    if (!el || !rn) {
      onTransformChangeRef.current(1, { x: 24, y: 24 });
      return;
    }
    const rect = el.getBoundingClientRect();
    const targetX = rect.width / 2 - (rn.x + rn.width / 2);
    const targetY = rect.height / 2 - (rn.y + rn.height / 2) - 16;
    onTransformChangeRef.current(1, { x: Math.round(targetX), y: Math.round(targetY) });
  }, []);

  // 首次进入画布时自动以总纲根节点为中心显示
  useEffect(() => {
    if (hasAutoCenteredRef.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = viewportRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          centerOnRoot();
          hasAutoCenteredRef.current = true;
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [centerOnRoot, layout.rootNode.x, layout.rootNode.y]);

  const startNodeResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, node: MasterOutlineNode, mode: "right" | "bottom" | "corner") => {
      e.stopPropagation();
      e.preventDefault();
      setContextMenu(null);
      setMetaPopover(null);
      onSelect(node.id);
      setResizingNodeId(node.id);

      const el = nodeElsRef.current.get(node.id);
      const startX = e.clientX;
      const startY = e.clientY;
      const origWidth = el?.offsetWidth || getNodeWidth(node);
      const origHeight = el?.offsetHeight || estimateNodeHeight(node);

      const handleMove = (ev: MouseEvent) => {
        const curZoom = transformRef.current.zoom || 1;
        const dx = (ev.clientX - startX) / curZoom;
        const dy = (ev.clientY - startY) / curZoom;
        const patch: Partial<Omit<MasterOutlineNode, "id" | "children">> = {};

        if (mode === "right" || mode === "corner") {
          patch.width = Math.round(Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, origWidth + dx)));
        }
        if (mode === "bottom" || mode === "corner") {
          patch.height = Math.round(Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, origHeight + dy)));
        }
        onInlineUpdateRef.current(node.id, patch);
      };

      const handleUp = () => {
        setResizingNodeId(null);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [onSelect]
  );

  useImperativeHandle(ref, () => ({ enterFullscreen, centerOnRoot }), [enterFullscreen, centerOnRoot]);

  // 监听节点卡片实际高度变化，动态重排树布局防止重叠
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setMeasuredHeights((prev) => {
        let changed = false;
        let next = prev;
        for (const entry of entries) {
          const el = entry.target as HTMLDivElement;
          const id = el.dataset.nodeId;
          if (!id) continue;
          const h = Math.ceil(el.offsetHeight);
          if (h > 0 && Math.abs((prev[id] ?? 0) - h) > 1) {
            if (!changed) {
              next = { ...prev };
              changed = true;
            }
            next[id] = h;
          }
        }
        return changed ? next : prev;
      });
    });
    observerRef.current = observer;
    nodeElsRef.current.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const nodeRefCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());

  const setNodeRef = useCallback((id: string, el: HTMLDivElement | null) => {
    const prevEl = nodeElsRef.current.get(id);
    if (prevEl === el) return;
    if (prevEl) {
      observerRef.current?.unobserve(prevEl);
      nodeElsRef.current.delete(id);
    }
    if (el) {
      nodeElsRef.current.set(id, el);
      observerRef.current?.observe(el);
    }
  }, []);

  const getNodeRefCallback = useCallback(
    (id: string) => {
      let cb = nodeRefCallbacksRef.current.get(id);
      if (!cb) {
        cb = (el: HTMLDivElement | null) => setNodeRef(id, el);
        nodeRefCallbacksRef.current.set(id, cb);
      }
      return cb;
    },
    [setNodeRef]
  );

  // 鼠标滚轮以指针为中心平滑缩放画布
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setContextMenu(null);
      setMetaPopover(null);
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { zoom: curZoom, offset: curOffset } = transformRef.current;

      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const nextZoom = Math.min(2, Math.max(0.4, Number((curZoom * factor).toFixed(2))));
      if (nextZoom === curZoom) return;

      const worldX = (mouseX - curOffset.x) / curZoom;
      const worldY = (mouseY - curOffset.y) / curZoom;
      onTransformChangeRef.current(nextZoom, {
        x: Math.round(mouseX - worldX * nextZoom),
        y: Math.round(mouseY - worldY * nextZoom),
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // 点击空白或按 Escape 关闭右键菜单与元数据浮层
  useEffect(() => {
    if (!contextMenu && !metaPopover) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest("[data-mindmap-menu='true']") || target?.closest("[data-mindmap-popover='true']")) return;
      setContextMenu(null);
      setMetaPopover(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setMetaPopover(null);
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu, metaPopover]);

  const activeEditing = useMemo<EditingTarget>(
    () => editing ?? (autoEditNodeId ? { id: autoEditNodeId, field: "title" } : null),
    [editing, autoEditNodeId]
  );

  const activeEditingValue = useMemo(() => {
    if (editing) return editingValue;
    if (autoEditNodeId) return findNode(tree, autoEditNodeId)?.title ?? "";
    return "";
  }, [editing, editingValue, autoEditNodeId, tree]);

  const startEditing = useCallback(
    (id: string, field: "title" | "note" | "chapterRange", initialVal: string) => {
      setContextMenu(null);
      setMetaPopover(null);
      onAutoEditHandled?.();
      setEditing({ id, field });
      setEditingValue(initialVal);
    },
    [onAutoEditHandled]
  );

  const commitInlineEdit = useCallback(() => {
    if (activeEditing) {
      if (activeEditing.field === "title") {
        if (activeEditingValue.trim()) {
          onInlineUpdate(activeEditing.id, { title: activeEditingValue.trim() });
        }
      } else if (activeEditing.field === "note") {
        onInlineUpdate(activeEditing.id, { note: activeEditingValue });
      } else {
        onInlineUpdate(activeEditing.id, { chapterRange: activeEditingValue.trim() });
      }
    }
    setEditing(null);
    onAutoEditHandled?.();
  }, [activeEditing, activeEditingValue, onInlineUpdate, onAutoEditHandled]);

  const cancelInlineEdit = useCallback(() => {
    setEditing(null);
    onAutoEditHandled?.();
  }, [onAutoEditHandled]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-mindmap-node='true']")) return;
    if (target.closest("[data-mindmap-menu='true']")) return;
    if (target.closest("[data-mindmap-popover='true']")) return;
    if (target.closest("[data-mindmap-controls='true']")) return;
    setContextMenu(null);
    setMetaPopover(null);
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

  const contextNode = useMemo(() => (contextMenu ? findNode(tree, contextMenu.nodeId) : null), [contextMenu, tree]);
  const contextSiblingMeta = useMemo(
    () => (contextMenu && contextMenu.nodeId !== "root" ? findSiblingMeta(tree, contextMenu.nodeId) : null),
    [contextMenu, tree]
  );
  const popoverNode = useMemo(() => (metaPopover ? findNode(tree, metaPopover.nodeId) : null), [metaPopover, tree]);

  const openMetaPopover = (e: React.MouseEvent<HTMLElement>, type: "tag" | "status", node: MasterOutlineNode) => {
    e.stopPropagation();
    setContextMenu(null);
    onSelect(node.id);
    const rect = e.currentTarget.getBoundingClientRect();
    const popW = type === "tag" ? 216 : 132;
    const popH = type === "tag" ? 152 : 112;
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - popW - 8));
    const y = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - popH - 8));
    if (type === "tag") setCustomTagInput(node.tag || "");
    setMetaPopover({ type, nodeId: node.id, x, y });
  };

  return (
    <Box
      ref={viewportRef}
      className={`${styles.mindmapViewport} ${isFallbackFullscreen ? styles.mindmapViewportFullscreen : ""}`}
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
          const isLeftBranch = item.side === "left";
          const isSelected = item.node.id === selectedId;
          const statusKey: MasterOutlineStatus = item.node.status || "planned";
          const statusMeta = STATUS_CONFIG[statusKey];
          const hasChildren = item.node.children.length > 0;
          const isEditingTitle = activeEditing?.id === item.node.id && activeEditing.field === "title";
          const isEditingNote = activeEditing?.id === item.node.id && activeEditing.field === "note";
          const isEditingChapter = activeEditing?.id === item.node.id && activeEditing.field === "chapterRange";
          const hasNote = Boolean(item.node.note?.trim());

          return (
            <div
              key={item.node.id}
              ref={getNodeRefCallback(item.node.id)}
              data-node-id={item.node.id}
              data-mindmap-node="true"
              className={`${styles.nodeCard} ${isRoot ? styles.nodeRoot : ""} ${isSelected ? styles.nodeSelected : ""} ${resizingNodeId === item.node.id ? styles.nodeResizing : ""}`}
              style={{ left: item.x, top: item.y, width: item.width, minHeight: item.node.height || undefined }}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
                setMetaPopover(null);
                onSelect(item.node.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onSelect(item.node.id);
                startEditing(item.node.id, "title", item.node.title);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMetaPopover(null);
                onSelect(item.node.id);
                const menuW = 204;
                const menuH = 340;
                const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuW - 8));
                const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuH - 8));
                setContextMenu({ x, y, nodeId: item.node.id });
              }}
            >
              {/* 上方插入同级节点锚点（非根节点） */}
              {!isRoot ? (
                <Tooltip label="上方插入同级节点 (Shift+Enter)" position="top" openDelay={250} withinPortal={false}>
                  <button
                    type="button"
                    aria-label="上方插入同级节点"
                    className={`${styles.quickAddBtn} ${styles.quickAddTop}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      setMetaPopover(null);
                      onAddSibling(item.node.id, "before");
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              ) : null}

              {/* 下方插入同级节点锚点（非根节点） */}
              {!isRoot ? (
                <Tooltip label="下方插入同级节点 (Enter)" position="bottom" openDelay={250} withinPortal={false}>
                  <button
                    type="button"
                    aria-label="下方插入同级节点"
                    className={`${styles.quickAddBtn} ${styles.quickAddBottom}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      setMetaPopover(null);
                      onAddSibling(item.node.id, "after");
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              ) : null}

              {/* 仅总纲节点（Root）左侧添加子节点锚点 */}
              {isRoot ? (
                <Tooltip label="左侧添加子节点" position="left" openDelay={250} withinPortal={false}>
                  <button
                    type="button"
                    aria-label="左侧添加子节点"
                    className={`${styles.quickAddBtn} ${styles.quickAddLeft}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      setMetaPopover(null);
                      onAddChild("root", "end", "left");
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              ) : null}

              {/* 子节点添加锚点：右侧分支与根节点在右侧，左侧分支镜像在左侧 */}
              {isLeftBranch ? (
                <Tooltip label="添加子节点 (Tab)" position="left" openDelay={250} withinPortal={false}>
                  <button
                    type="button"
                    aria-label="添加子节点"
                    className={`${styles.quickAddBtn} ${hasChildren ? styles.quickAddLeftOffset : styles.quickAddLeft}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      setMetaPopover(null);
                      onAddChild(item.node.id, "end");
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              ) : (
                <Tooltip label={isRoot ? "右侧添加子节点 (Tab)" : "添加子节点 (Tab)"} position="right" openDelay={250} withinPortal={false}>
                  <button
                    type="button"
                    aria-label="添加子节点"
                    className={`${styles.quickAddBtn} ${hasChildren ? styles.quickAddRightOffset : styles.quickAddRight}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      setMetaPopover(null);
                      onAddChild(item.node.id, "end", isRoot ? "right" : undefined);
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              )}

              {/* 卡片顶部元数据行：标签 / 章节 / AI诊断 / 状态 全部卡片内直接点击修改 */}
              <Flex align="center" justify="space-between" gap={4}>
                <Flex align="center" gap={4} miw={0} wrap="wrap">
                  <button
                    type="button"
                    title="点击切换或编辑标签"
                    className={`${styles.metaPill} ${isRoot ? styles.metaPillRoot : ""} ${!item.node.tag ? styles.metaPillPlaceholder : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => openMetaPopover(e, "tag", item.node)}
                  >
                    {item.node.tag || "+ 标签"}
                  </button>

                  {!isRoot ? (
                    isEditingChapter ? (
                      <input
                        autoFocus
                        value={activeEditingValue}
                        placeholder="如 1-20"
                        className={styles.metaChapterInput}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={commitInlineEdit}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitInlineEdit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInlineEdit();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        title="点击设置关联章节范围"
                        className={`${styles.metaPill} ${!item.node.chapterRange ? styles.metaPillPlaceholder : ""}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(item.node.id);
                          startEditing(item.node.id, "chapterRange", item.node.chapterRange || "");
                        }}
                      >
                        {item.node.chapterRange
                          ? (() => {
                              const prog = getChapterRangeProgress(item.node.chapterRange, writtenChapterSet);
                              return prog ? `第${item.node.chapterRange}章 · ${prog.writtenCount}/${prog.total}` : `第${item.node.chapterRange}章`;
                            })()
                          : "+ 章节"}
                      </button>
                    )
                  ) : null}
                </Flex>

                {!isRoot ? (
                  <button
                    type="button"
                    title="点击切换推进状态"
                    className={styles.statusPill}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => openMetaPopover(e, "status", item.node)}
                  >
                    <span className={styles.statusDot} style={{ backgroundColor: STATUS_DOT_COLOR[statusKey] }} />
                    <span>{statusMeta.label}</span>
                  </button>
                ) : null}
              </Flex>

              {/* 节点名称：正常折行，支持点击（已选中时）或双击直接编辑 */}
              {isEditingTitle ? (
                <textarea
                  autoFocus
                  rows={1}
                  value={activeEditingValue}
                  className={styles.cardTitleTextarea}
                  onFocus={(e) => {
                    autoResizeTextarea(e.currentTarget);
                    e.currentTarget.select();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    if (!editing && autoEditNodeId) {
                      setEditing({ id: autoEditNodeId, field: "title" });
                      onAutoEditHandled?.();
                    }
                    setEditingValue(e.target.value);
                    autoResizeTextarea(e.currentTarget);
                  }}
                  onBlur={commitInlineEdit}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitInlineEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelInlineEdit();
                    }
                  }}
                />
              ) : (
                <Box
                  className={`${styles.cardTitle} ${isRoot ? styles.cardTitleRoot : ""}`}
                  onClick={(e) => {
                    if (isSelected) {
                      e.stopPropagation();
                      startEditing(item.node.id, "title", item.node.title);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.node.id);
                    startEditing(item.node.id, "title", item.node.title);
                  }}
                >
                  {item.node.title}
                </Box>
              )}

              {/* 要点说明：完整展示（较小字号），点击即可直接在卡片上编辑 */}
              {isEditingNote ? (
                <textarea
                  autoFocus
                  rows={1}
                  value={activeEditingValue}
                  placeholder="填写核心冲突、推进目标或伏笔要点..."
                  className={styles.cardNoteTextarea}
                  onFocus={(e) => {
                    autoResizeTextarea(e.currentTarget);
                    const len = e.currentTarget.value.length;
                    e.currentTarget.setSelectionRange(len, len);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setEditingValue(e.target.value);
                    autoResizeTextarea(e.currentTarget);
                  }}
                  onBlur={commitInlineEdit}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitInlineEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelInlineEdit();
                    }
                  }}
                />
              ) : (
                <Box
                  className={`${styles.cardNote} ${!hasNote ? styles.cardNoteEmpty : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.node.id);
                    startEditing(item.node.id, "note", item.node.note || "");
                  }}
                >
                  {hasNote ? item.node.note : "点击添加要点说明..."}
                </Box>
              )}

              {hasChildren ? (
                <div
                  className={`${styles.collapseDot} ${isLeftBranch ? styles.collapseDotLeft : ""}`}
                  title={item.node.collapsed ? "展开分支" : "收起分支"}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(item.node.id);
                  }}
                >
                  {item.node.collapsed ? item.node.children.length : "−"}
                </div>
              ) : null}

              {isSelected && (hasChildren || (!isRoot && Boolean(item.node.chapterRange?.trim()))) ? (() => {
                const rangeProg = !isRoot ? getChapterRangeProgress(item.node.chapterRange, writtenChapterSet) : null;
                const hasWritten = Boolean(rangeProg?.hasWritten);
                return (
                  <div
                    className={styles.nodeFlowBar}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        className={`${styles.nodeFlowBtn} ${item.node.logicDeduction ? styles.nodeFlowBtnDone : ""}`}
                        title={item.node.logicDeduction ? "① 逻辑校验（已校验 · 点击查看或重新校验）" : "① 逻辑校验（检查当前节点与子节点逻辑是否合理）"}
                        onClick={() => onOpenLogicDeduction(item.node.id)}
                      >
                        <FiGitMerge size={11} />
                        <span>① 逻辑校验</span>
                        {item.node.logicDeduction ? <span className={styles.nodeFlowDot} /> : null}
                      </button>
                    ) : null}

                    {!isRoot && item.node.chapterRange?.trim() && onJumpToPlotDeduction ? (
                      <button
                        type="button"
                        className={`${styles.nodeFlowBtn} ${styles.nodeFlowBtnPrimary}`}
                        title={
                          rangeProg
                            ? `② 规划并写章（已写 ${rangeProg.writtenCount}/${rangeProg.total} 章 · 前往规划走向并生成正文）`
                            : "② 规划并写章（前往章节规划与起草生成正文）"
                        }
                        onClick={() => onJumpToPlotDeduction(item.node.id)}
                      >
                        <FiZap size={11} />
                        <span>② 规划并写章</span>
                      </button>
                    ) : null}

                    {!isRoot && item.node.chapterRange?.trim() ? (
                      <button
                        type="button"
                        disabled={!hasWritten}
                        className={`${styles.nodeFlowBtn} ${!hasWritten ? styles.nodeFlowBtnDisabled : ""}`}
                        title={
                          hasWritten
                            ? `③ 章节质检（已写 ${rangeProg!.writtenCount}/${rangeProg!.total} 章 · 诊断本阶段正文质量）`
                            : "该区间暂无已写正文，请先完成②规划并写章后再质检"
                        }
                        onClick={() => hasWritten && onJumpToAiAnalysis(item.node.chapterRange || "", item.node.title)}
                      >
                        <FiShield size={11} />
                        <span>③ 章节质检</span>
                      </button>
                    ) : null}
                  </div>
                );
              })() : null}

              {/* 拖拽调整节点卡片宽高度手柄 */}
              <div
                data-mindmap-resize="true"
                className={styles.resizeHandleRight}
                title="拖拽调整宽度"
                onMouseDown={(e) => startNodeResize(e, item.node, "right")}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                data-mindmap-resize="true"
                className={styles.resizeHandleBottom}
                title="拖拽调整高度"
                onMouseDown={(e) => startNodeResize(e, item.node, "bottom")}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                data-mindmap-resize="true"
                className={styles.resizeHandleCorner}
                title="拖拽调整宽高"
                onMouseDown={(e) => startNodeResize(e, item.node, "corner")}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </Box>

      {/* 全屏纯画布模式下的极简半透明控制胶囊（不含保存与属性栏） */}
      {isFullscreen ? (
        <Box data-mindmap-controls="true" className={styles.fullscreenControls} onMouseDown={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size={26} radius="xl" title="缩小" onClick={() => onTransformChange(Math.max(0.4, Number((zoom - 0.1).toFixed(2))), offset)}>
            <FiZoomOut size={13} />
          </ActionIcon>
          <Text fz={11} fw={600} c="#475569" w={38} ta="center">{Math.round(zoom * 100)}%</Text>
          <ActionIcon variant="subtle" color="gray" size={26} radius="xl" title="放大" onClick={() => onTransformChange(Math.min(2, Number((zoom + 0.1).toFixed(2))), offset)}>
            <FiZoomIn size={13} />
          </ActionIcon>
          <Box className={styles.dockDivider} />
          <ActionIcon variant="subtle" color="gray" size={26} radius="xl" title="居中复位" onClick={centerOnRoot}>
            <FiRefreshCw size={12} />
          </ActionIcon>
          <ActionIcon variant="light" size={26} radius="xl" title="退出全屏 (Esc)" onClick={exitFullscreen}>
            <FiMinimize2 size={13} />
          </ActionIcon>
        </Box>
      ) : null}

      {/* 卡片元数据微浮层（标签 / 状态，渲染在画布视口内，全屏下同样可用） */}
      {metaPopover && popoverNode ? (
        <Box
          data-mindmap-popover="true"
          className={styles.metaPopover}
          style={{ left: metaPopover.x, top: metaPopover.y, width: metaPopover.type === "status" ? 132 : 216 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {metaPopover.type === "tag" ? (
            <Flex direction="column" gap={8}>
              <input
                autoFocus
                value={customTagInput}
                placeholder="输入自定义标签后回车"
                className={styles.metaPopoverInput}
                onChange={(e) => {
                  setCustomTagInput(e.target.value);
                  onInlineUpdate(popoverNode.id, { tag: e.target.value });
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" || e.key === "Escape") setMetaPopover(null);
                }}
              />
              <Flex gap={4} wrap="wrap">
                {TAG_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.metaPresetChip} ${popoverNode.tag === t ? styles.metaPresetChipActive : ""}`}
                    onClick={() => {
                      onInlineUpdate(popoverNode.id, { tag: t });
                      setMetaPopover(null);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </Flex>
            </Flex>
          ) : (
            <Flex direction="column" gap={2}>
              {(["planned", "in_progress", "completed"] as MasterOutlineStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={styles.contextMenuItem}
                  onClick={() => {
                    onInlineUpdate(popoverNode.id, { status: st });
                    setMetaPopover(null);
                  }}
                >
                  <Flex align="center" gap={6}>
                    <span className={styles.statusDot} style={{ backgroundColor: STATUS_DOT_COLOR[st] }} />
                    <span>{STATUS_CONFIG[st].label}</span>
                  </Flex>
                  {(popoverNode.status || "planned") === st ? <Text fz={11} fw={700} c="#00c9ff">✓</Text> : null}
                </button>
              ))}
            </Flex>
          )}
        </Box>
      ) : null}

      {/* 节点右键上下文菜单（渲染在画布视口内，全屏下同样可用） */}
      {contextMenu && contextNode ? (
        <Box data-mindmap-menu="true" className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
          {/* 1. 核心三步创作流程：固定顺序 ① 逻辑校验 -> ② 规划并写章 -> ③ 章节质检 */}
          {contextNode.children.length > 0 ? (
            <button
              type="button"
              className={styles.contextMenuItem}
              onClick={() => {
                onOpenLogicDeduction(contextNode.id);
                setContextMenu(null);
              }}
            >
              <Flex align="center" gap={8}><FiGitMerge size={13} color="#00a8d6" /><span>① 逻辑校验</span></Flex>
              {contextNode.logicDeduction ? <span className={styles.contextMenuShortcut}>已校验</span> : null}
            </button>
          ) : null}

          {contextNode.id !== "root" && contextNode.chapterRange?.trim() && onJumpToPlotDeduction ? (() => {
            const prog = getChapterRangeProgress(contextNode.chapterRange, writtenChapterSet);
            return (
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={() => {
                  onJumpToPlotDeduction(contextNode.id);
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiZap size={13} color="#2563eb" /><span>② 规划并写章</span></Flex>
                {prog ? <span className={styles.contextMenuShortcut}>{prog.writtenCount}/{prog.total}章</span> : null}
              </button>
            );
          })() : null}

          {contextNode.id !== "root" && contextNode.chapterRange?.trim() ? (() => {
            const prog = getChapterRangeProgress(contextNode.chapterRange, writtenChapterSet);
            const hasWritten = Boolean(prog?.hasWritten);
            return (
              <button
                type="button"
                disabled={!hasWritten}
                title={hasWritten ? "诊断本阶段已写章节内容质量" : "该区间暂无已写正文，请先完成②规划并写章后再质检"}
                className={`${styles.contextMenuItem} ${!hasWritten ? styles.contextMenuItemDisabled : ""}`}
                onClick={() => {
                  if (!hasWritten) return;
                  onJumpToAiAnalysis(contextNode.chapterRange || "", contextNode.title);
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiShield size={13} color={hasWritten ? "#7c3aed" : "#94a3b8"} /><span>③ 章节质检</span></Flex>
                {!hasWritten ? <span className={styles.contextMenuShortcut}>暂无正文</span> : null}
              </button>
            );
          })() : null}

          {(contextNode.children.length > 0 || (contextNode.id !== "root" && contextNode.chapterRange?.trim())) ? (
            <div className={styles.contextMenuDivider} />
          ) : null}

          {/* 2. 删除此节点 */}
          {contextNode.id !== "root" ? (
            <>
              <button
                type="button"
                className={`${styles.contextMenuItem} ${styles.contextMenuDanger}`}
                onClick={() => {
                  onDeleteNode(contextNode.id);
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiTrash2 size={13} /><span>删除此节点</span></Flex>
              </button>
              <div className={styles.contextMenuDivider} />
            </>
          ) : null}

          {/* 3. 上移 / 下移节点 */}
          {contextNode.id !== "root" && contextSiblingMeta ? (
            <>
              <button
                type="button"
                className={styles.contextMenuItem}
                disabled={contextSiblingMeta.index === 0}
                onClick={() => {
                  onMoveNode(contextNode.id, "up");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiArrowUp size={13} /><span>上移节点</span></Flex>
              </button>
              <button
                type="button"
                className={styles.contextMenuItem}
                disabled={contextSiblingMeta.index === contextSiblingMeta.count - 1}
                onClick={() => {
                  onMoveNode(contextNode.id, "down");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiArrowDown size={13} /><span>下移节点</span></Flex>
              </button>
              <div className={styles.contextMenuDivider} />
            </>
          ) : null}

          {/* 4. 添加子节点 / 插入同级节点 */}
          {contextNode.id === "root" ? (
            <>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={() => {
                  onAddChild("root", "end", "right");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiCornerDownRight size={13} /><span>右侧添加子节点</span></Flex>
                <span className={styles.contextMenuShortcut}>Tab</span>
              </button>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={() => {
                  onAddChild("root", "end", "left");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiCornerDownLeft size={13} /><span>左侧添加子节点</span></Flex>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={() => {
                  onAddChild(contextNode.id, "end");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiCornerDownRight size={13} /><span>添加子节点</span></Flex>
                <span className={styles.contextMenuShortcut}>Tab</span>
              </button>
              {contextNode.children.length > 0 ? (
                <button
                  type="button"
                  className={styles.contextMenuItem}
                  onClick={() => {
                    onAddChild(contextNode.id, "start");
                    setContextMenu(null);
                  }}
                >
                  <Flex align="center" gap={8}><FiPlus size={13} /><span>顶部添加子节点</span></Flex>
                </button>
              ) : null}
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={() => {
                  onAddSibling(contextNode.id, "before");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiArrowUp size={13} /><span>上方插入同级节点</span></Flex>
                <span className={styles.contextMenuShortcut}>⇧↵</span>
              </button>
              <button
                type="button"
                className={styles.contextMenuItem}
                onClick={() => {
                  onAddSibling(contextNode.id, "after");
                  setContextMenu(null);
                }}
              >
                <Flex align="center" gap={8}><FiArrowDown size={13} /><span>下方插入同级节点</span></Flex>
                <span className={styles.contextMenuShortcut}>↵</span>
              </button>
            </>
          )}

          <div className={styles.contextMenuDivider} />

          {/* 5. 编辑与折叠操作 */}
          <button
            type="button"
            className={styles.contextMenuItem}
            onClick={() => startEditing(contextNode.id, "title", contextNode.title)}
          >
            <Flex align="center" gap={8}><FiEdit2 size={13} /><span>编辑节点名称</span></Flex>
          </button>

          <button
            type="button"
            className={styles.contextMenuItem}
            onClick={() => startEditing(contextNode.id, "note", contextNode.note || "")}
          >
            <Flex align="center" gap={8}><FiFileText size={13} /><span>编辑要点说明</span></Flex>
          </button>

          {contextNode.children.length > 0 ? (
            <button
              type="button"
              className={styles.contextMenuItem}
              onClick={() => {
                onToggleCollapse(contextNode.id);
                setContextMenu(null);
              }}
            >
              <Flex align="center" gap={8}>
                {contextNode.collapsed ? <FiMaximize2 size={13} /> : <FiMinimize2 size={13} />}
                <span>{contextNode.collapsed ? "展开分支" : "收起分支"}</span>
              </Flex>
            </button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
});

export default MindMapView;
