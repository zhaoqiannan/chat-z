import { MasterOutlineNode, MasterOutlineStatus } from "@/rest/master-outline";

export const STATUS_CONFIG: Record<MasterOutlineStatus, { label: string; color: string }> = {
  planned: { label: "规划中", color: "gray" },
  in_progress: { label: "进行中", color: "cyan" },
  completed: { label: "已完成", color: "green" },
};

export const TAG_PRESETS = ["总纲", "卷", "主线", "支线", "高潮", "伏笔", "副本", "转折"];

export function createNodeId(): string {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function findNode(root: MasterOutlineNode, id: string): MasterOutlineNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function updateNode(
  root: MasterOutlineNode,
  id: string,
  patch: Partial<Omit<MasterOutlineNode, "id" | "children">>
): MasterOutlineNode {
  if (root.id === id) {
    return { ...root, ...patch };
  }
  return {
    ...root,
    children: root.children.map((c) => updateNode(c, id, patch)),
  };
}

export type SiblingInsertPosition = "before" | "after";
export type ChildInsertPosition = "start" | "end";

export function addChildNode(
  root: MasterOutlineNode,
  parentId: string,
  newNode: MasterOutlineNode,
  position: ChildInsertPosition = "end"
): MasterOutlineNode {
  if (root.id === parentId) {
    return {
      ...root,
      collapsed: false,
      children: position === "start" ? [newNode, ...root.children] : [...root.children, newNode],
    };
  }
  return {
    ...root,
    children: root.children.map((c) => addChildNode(c, parentId, newNode, position)),
  };
}

export function addSiblingNode(
  root: MasterOutlineNode,
  targetId: string,
  newNode: MasterOutlineNode,
  position: SiblingInsertPosition = "after"
): MasterOutlineNode {
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const nextChildren = [...root.children];
    const insertIdx = position === "before" ? idx : idx + 1;
    nextChildren.splice(insertIdx, 0, newNode);
    return { ...root, children: nextChildren };
  }
  return {
    ...root,
    children: root.children.map((c) => addSiblingNode(c, targetId, newNode, position)),
  };
}

export function findSiblingMeta(
  root: MasterOutlineNode,
  targetId: string
): { index: number; count: number; parentId: string } | null {
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    return { index: idx, count: root.children.length, parentId: root.id };
  }
  for (const child of root.children) {
    const found = findSiblingMeta(child, targetId);
    if (found) return found;
  }
  return null;
}

export function deleteNode(root: MasterOutlineNode, targetId: string): MasterOutlineNode {
  if (root.id === targetId) return root;
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== targetId)
      .map((c) => deleteNode(c, targetId)),
  };
}

export function moveNode(
  root: MasterOutlineNode,
  targetId: string,
  direction: "up" | "down"
): MasterOutlineNode {
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= root.children.length) return root;
    const nextChildren = [...root.children];
    const tmp = nextChildren[idx];
    nextChildren[idx] = nextChildren[swapIdx];
    nextChildren[swapIdx] = tmp;
    return { ...root, children: nextChildren };
  }
  return {
    ...root,
    children: root.children.map((c) => moveNode(c, targetId, direction)),
  };
}

export function setAllCollapsed(root: MasterOutlineNode, collapsed: boolean): MasterOutlineNode {
  return {
    ...root,
    collapsed: root.id === "root" ? false : collapsed,
    children: root.children.map((c) => setAllCollapsed(c, collapsed)),
  };
}

export interface FlatTreeRow {
  node: MasterOutlineNode;
  depth: number;
  parentId: string | null;
  siblingIndex: number;
  siblingCount: number;
}

export function flattenVisibleTree(
  root: MasterOutlineNode,
  depth = 0,
  parentId: string | null = null,
  siblingIndex = 0,
  siblingCount = 1
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [{ node: root, depth, parentId, siblingIndex, siblingCount }];
  if (!root.collapsed && root.children.length > 0) {
    root.children.forEach((child, idx) => {
      rows.push(...flattenVisibleTree(child, depth + 1, root.id, idx, root.children.length));
    });
  }
  return rows;
}
