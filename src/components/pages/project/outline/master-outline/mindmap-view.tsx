"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Flex, Text, Tooltip } from "@mantine/core";
import { FiArrowDown, FiArrowUp, FiCornerDownRight, FiEdit2, FiFileText, FiMaximize2, FiMinimize2, FiPlus, FiTrash2 } from "react-icons/fi";
import { MasterOutlineNode } from "@/rest/master-outline";
import { ChildInsertPosition, STATUS_CONFIG, SiblingInsertPosition, findNode, findSiblingMeta } from "./tree-utils";
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

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

type EditingTarget = { id: string; field: "title" | "note" } | null;

const NODE_WIDTH = 256;
const H_GAP = 84;
const V_GAP = 30;
const PADDING = 48;

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  return text.split("\n").reduce((sum, line) => {
    const weightedLen = Array.from(line).reduce((acc, ch) => acc + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0);
    return sum + Math.max(1, Math.ceil(weightedLen / charsPerLine));
  }, 0);
}

function estimateNodeHeight(node: MasterOutlineNode): number {
  const titleLines = estimateWrappedLines(node.title || "", 17);
  const noteLines = estimateWrappedLines(node.note?.trim() || "点击添加要点说明...", 20);
  // 元数据行(20) + 标题行(19*n) + 分割与要点行(10 + 16.5*m) + 上下内边距(24)
  return Math.max(78, Math.ceil(20 + titleLines * 19 + 10 + noteLines * 16.5 + 24));
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
} {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let cursorY = PADDING;

  function place(node: MasterOutlineNode, depth: number, parentId: string | null): LayoutNode {
    const x = PADDING + depth * (NODE_WIDTH + H_GAP);
    const nodeHeight = measuredHeights[node.id] ?? estimateNodeHeight(node);
    const visibleChildren = node.collapsed ? [] : node.children;

    if (visibleChildren.length === 0) {
      const y = cursorY;
      cursorY += nodeHeight + V_GAP;
      const placed: LayoutNode = { node, depth, x, y, width: NODE_WIDTH, height: nodeHeight, parentId };
      nodes.push(placed);
      return placed;
    }

    const startY = cursorY;
    const placedChildren = visibleChildren.map((child) => place(child, depth + 1, node.id));
    const firstChild = placedChildren[0];
    const lastChild = placedChildren[placedChildren.length - 1];
    const childrenMidY = (firstChild.y + firstChild.height / 2 + lastChild.y + lastChild.height / 2) / 2;
    const y = Math.max(startY, childrenMidY - nodeHeight / 2);
    cursorY = Math.max(cursorY, y + nodeHeight + V_GAP);

    const placed: LayoutNode = { node, depth, x, y, width: NODE_WIDTH, height: nodeHeight, parentId };
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
  autoEditNodeId?: string | null;
  onAutoEditHandled?: () => void;
  zoom: number;
  offset: { x: number; y: number };
  onOffsetChange: (next: { x: number; y: number }) => void;
  onTransformChange: (nextZoom: number, nextOffset: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onInlineUpdate: (id: string, patch: { title?: string; note?: string }) => void;
  onAddChild: (parentId: string, position?: ChildInsertPosition) => void;
  onAddSibling: (targetId: string, position: SiblingInsertPosition) => void;
  onMoveNode: (id: string, dir: "up" | "down") => void;
  onDeleteNode: (id: string) => void;
}

export default function MindMapView({
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
}: MindMapViewProps) {
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const layout = useMemo(() => computeMindMapLayout(tree, measuredHeights), [tree, measuredHeights]);
  const [editing, setEditing] = useState<EditingTarget>(null);
  const [editingValue, setEditingValue] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const nodeElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<ResizeObserver | null>(null);
  const transformRef = useRef({ zoom, offset });
  const onTransformChangeRef = useRef(onTransformChange);
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  // 监听节点卡片实际高度变化，动态重排树布局防止折行与完整要点说明重叠
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

  const setNodeRef = useCallback((id: string, el: HTMLDivElement | null) => {
    const prevEl = nodeElsRef.current.get(id);
    if (prevEl && prevEl !== el) {
      observerRef.current?.unobserve(prevEl);
      nodeElsRef.current.delete(id);
    }
    if (el) {
      nodeElsRef.current.set(id, el);
      observerRef.current?.observe(el);
    }
  }, []);

  useEffect(() => {
    transformRef.current = { zoom, offset };
  }, [zoom, offset]);

  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

  // 鼠标滚轮以指针为中心平滑缩放画布
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setContextMenu(null);
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

  // 点击空白或按 Escape 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest("[data-mindmap-menu='true']")) return;
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const activeEditing: EditingTarget = editing ?? (autoEditNodeId ? { id: autoEditNodeId, field: "title" } : null);
  const activeEditingValue = useMemo(() => {
    if (editing) return editingValue;
    if (autoEditNodeId) return findNode(tree, autoEditNodeId)?.title ?? "";
    return "";
  }, [editing, editingValue, autoEditNodeId, tree]);

  const startEditing = useCallback(
    (id: string, field: "title" | "note", initialVal: string) => {
      setContextMenu(null);
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
      } else {
        onInlineUpdate(activeEditing.id, { note: activeEditingValue });
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
    if ((e.target as HTMLElement).closest("[data-mindmap-node='true']")) return;
    if ((e.target as HTMLElement).closest("[data-mindmap-menu='true']")) return;
    setContextMenu(null);
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

  return (
    <Box
      ref={viewportRef}
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
          const isEditingTitle = activeEditing?.id === item.node.id && activeEditing.field === "title";
          const isEditingNote = activeEditing?.id === item.node.id && activeEditing.field === "note";
          const hasNote = Boolean(item.node.note?.trim());

          return (
            <div
              key={item.node.id}
              ref={(el) => setNodeRef(item.node.id, el)}
              data-node-id={item.node.id}
              data-mindmap-node="true"
              className={`${styles.nodeCard} ${isRoot ? styles.nodeRoot : ""} ${isSelected ? styles.nodeSelected : ""}`}
              style={{ left: item.x, top: item.y, width: item.width }}
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu(null);
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
                onSelect(item.node.id);
                const menuW = 200;
                const menuH = 320;
                const x = Math.max(8, Math.min(e.clientX, window.innerWidth - menuW - 8));
                const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuH - 8));
                setContextMenu({ x, y, nodeId: item.node.id });
              }}
            >
              {/* 上方插入同级节点锚点（非根节点） */}
              {!isRoot ? (
                <Tooltip label="上方插入同级节点 (Shift+Enter)" position="top" openDelay={250}>
                  <button
                    type="button"
                    aria-label="上方插入同级节点"
                    className={`${styles.quickAddBtn} ${styles.quickAddTop}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      onAddSibling(item.node.id, "before");
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              ) : null}

              {/* 下方插入同级节点锚点（非根节点） */}
              {!isRoot ? (
                <Tooltip label="下方插入同级节点 (Enter)" position="bottom" openDelay={250}>
                  <button
                    type="button"
                    aria-label="下方插入同级节点"
                    className={`${styles.quickAddBtn} ${styles.quickAddBottom}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(null);
                      onAddSibling(item.node.id, "after");
                    }}
                  >
                    <FiPlus size={12} />
                  </button>
                </Tooltip>
              ) : null}

              {/* 右侧添加子节点锚点 */}
              <Tooltip label="添加子节点 (Tab)" position="right" openDelay={250}>
                <button
                  type="button"
                  aria-label="添加子节点"
                  className={`${styles.quickAddBtn} ${hasChildren ? styles.quickAddRightOffset : styles.quickAddRight}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu(null);
                    onAddChild(item.node.id, "end");
                  }}
                >
                  <FiPlus size={12} />
                </button>
              </Tooltip>

              <Flex align="center" justify="space-between" gap={4}>
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
                  className={styles.collapseDot}
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
            </div>
          );
        })}
      </Box>

      {/* 节点右键上下文菜单 */}
      {contextMenu && contextNode ? (
        <Box data-mindmap-menu="true" className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
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

          {contextNode.id !== "root" ? (
            <>
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
          ) : null}

          <div className={styles.contextMenuDivider} />

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
            </>
          ) : null}

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

          {contextNode.id !== "root" ? (
            <>
              <div className={styles.contextMenuDivider} />
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
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
