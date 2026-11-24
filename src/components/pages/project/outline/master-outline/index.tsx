"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Badge, Box, Button, Divider, Flex, Group, Modal, SegmentedControl, Select, Stack, Text, TextInput, Textarea, Tooltip } from "@mantine/core";
import { FiArrowDown, FiArrowUp, FiCpu, FiGitBranch, FiMaximize2, FiMinimize2, FiPlus, FiRefreshCw, FiSave, FiTable, FiTrash2, FiZoomIn, FiZoomOut } from "react-icons/fi";
import { MasterOutlineNode, MasterOutlineStatus, generateMasterOutlineAi, getMasterOutline, saveMasterOutline } from "@/rest/master-outline";
import LoadingMask from "@/components/common/loading-mask";
import { useAlert } from "@/hooks/useAlert";
import { showConfirm } from "@/hooks/useConfirm";
import MindMapView from "./mindmap-view";
import TableView from "./table-view";
import { ChildInsertPosition, SiblingInsertPosition, TAG_PRESETS, addChildNode, addSiblingNode, createNodeId, deleteNode, findNode, findSiblingMeta, moveNode, setAllCollapsed, updateNode } from "./tree-utils";
import styles from "./style.module.scss";

interface MasterOutlineWorkspaceProps {
  workId: string;
}

export default function MasterOutlineWorkspace({ workId }: MasterOutlineWorkspaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [viewMode, setViewMode] = useState<"mindmap" | "table">("mindmap");
  const [tree, setTree] = useState<MasterOutlineNode | null>(null);
  const [selectedId, setSelectedId] = useState<string>("root");
  const [autoEditNodeId, setAutoEditNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 24, y: 24 });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aiModalOpened, setAiModalOpened] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const fetchTree = useCallback(async () => {
    if (!workId) return;
    try {
      setLoading(true);
      const res = await getMasterOutline(workId);
      if (res && res.success && res.result?.tree) {
        setTree(res.result.tree);
        setSelectedId(res.result.tree.id || "root");
        setDirty(false);
      }
    } catch (e: any) {
      useAlert.error("获取项目总纲失败: " + (e?.message || "网络异常"));
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const mutateTree = useCallback((updater: (prev: MasterOutlineNode) => MasterOutlineNode) => {
    setTree((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!tree || !workId) return;
    try {
      setSaving(true);
      const res = await saveMasterOutline({ workId, tree });
      if (res && res.success) {
        setDirty(false);
        useAlert.success("项目总纲已保存");
      } else {
        useAlert.error(res?.message || "保存失败");
      }
    } catch (e: any) {
      useAlert.error("保存失败: " + (e?.message || "网络异常"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = useCallback((parentId: string, position: ChildInsertPosition = "end", autoEdit = false) => {
    const newId = createNodeId();
    const newNode: MasterOutlineNode = {
      id: newId,
      title: "新剧情节点",
      tag: "主线",
      note: "",
      chapterRange: "",
      status: "planned",
      children: [],
    };
    mutateTree((prev) => addChildNode(prev, parentId, newNode, position));
    setSelectedId(newId);
    if (autoEdit) setAutoEditNodeId(newId);
  }, [mutateTree]);

  const handleAddSibling = useCallback((targetId: string, position: SiblingInsertPosition = "after", autoEdit = false) => {
    if (targetId === "root") {
      handleAddChild("root", position === "before" ? "start" : "end", autoEdit);
      return;
    }
    const newId = createNodeId();
    const newNode: MasterOutlineNode = {
      id: newId,
      title: "同级节点",
      tag: "主线",
      note: "",
      chapterRange: "",
      status: "planned",
      children: [],
    };
    mutateTree((prev) => addSiblingNode(prev, targetId, newNode, position));
    setSelectedId(newId);
    if (autoEdit) setAutoEditNodeId(newId);
  }, [handleAddChild, mutateTree]);

  const handleTransformChange = useCallback((nextZoom: number, nextOffset: { x: number; y: number }) => {
    setZoom(nextZoom);
    setOffset(nextOffset);
  }, []);

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditNodeId(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (id === "root") return;
    const confirmed = await showConfirm({
      title: "删除总纲节点",
      message: "确定删除该节点及其下属所有子节点吗？",
      confirmLabel: "删除",
      confirmColor: "red",
    });
    if (!confirmed) return;
    mutateTree((prev) => deleteNode(prev, id));
    if (selectedId === id) setSelectedId("root");
  }, [mutateTree, selectedId]);

  const handleToggleCollapse = useCallback((id: string) => {
    setTree((prev) => {
      if (!prev) return prev;
      const target = findNode(prev, id);
      if (!target) return prev;
      return updateNode(prev, id, { collapsed: !target.collapsed });
    });
  }, []);

  const handleAiGenerate = async () => {
    if (!workId) return;
    try {
      setAiLoading(true);
      const res = await generateMasterOutlineAi({ workId, prompt: aiPrompt.trim() || undefined });
      if (res && res.success && res.result?.tree) {
        setTree(res.result.tree);
        setSelectedId(res.result.tree.id || "root");
        setDirty(true);
        setAiModalOpened(false);
        setAiPrompt("");
        useAlert.success("AI 已生成项目总纲，确认无误后请点击「保存总纲」");
      } else {
        useAlert.error(res?.message || "AI 生成总纲失败");
      }
    } catch (e: any) {
      useAlert.error("AI 生成失败: " + (e?.message || "网络异常"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleJumpToAiAnalysis = (chapterRange: string, nodeTitle: string) => {
    const query = new URLSearchParams({
      tab: "ai_analysis",
      mode: "range",
      range: chapterRange,
      goal: nodeTitle,
    });
    router.push(`/project/${workId}?${query.toString()}`);
  };

  // 导图模式快捷键：Tab 添加子节点，Enter 下方插入同级，Shift+Enter 上方插入同级
  useEffect(() => {
    if (viewMode !== "mindmap") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Tab" && selectedId) {
        e.preventDefault();
        handleAddChild(selectedId, "end", true);
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        handleAddSibling(selectedId, e.shiftKey ? "before" : "after", true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewMode, selectedId, handleAddChild, handleAddSibling]);

  const selectedNode = useMemo(() => (tree ? findNode(tree, selectedId) : null), [tree, selectedId]);
  const selectedSiblingMeta = useMemo(
    () => (tree && selectedId !== "root" ? findSiblingMeta(tree, selectedId) : null),
    [tree, selectedId]
  );

  return (
    <Box className={styles.container}>
      <LoadingMask visible={loading && !tree} label="正在加载项目总纲..." />

      {/* 顶部极简工具栏 */}
      <Flex align="center" justify="space-between" px="md" py={8} gap={12} wrap="wrap" className={styles.toolbar}>
        <Group gap={10}>
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(val) => setViewMode(val as "mindmap" | "table")}
            data={[
              {
                value: "mindmap",
                label: (
                  <Flex align="center" gap={6}>
                    <FiGitBranch size={13} />
                    <span>思维导图</span>
                  </Flex>
                ),
              },
              {
                value: "table",
                label: (
                  <Flex align="center" gap={6}>
                    <FiTable size={13} />
                    <span>表格视图</span>
                  </Flex>
                ),
              },
            ]}
          />

          {viewMode === "mindmap" ? (
            <Group gap={4}>
              <Tooltip label="缩小">
                <ActionIcon variant="default" size={26} onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}>
                  <FiZoomOut size={13} />
                </ActionIcon>
              </Tooltip>
              <Text fz={12} c="#64748b" w={42} ta="center">{Math.round(zoom * 100)}%</Text>
              <Tooltip label="放大">
                <ActionIcon variant="default" size={26} onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}>
                  <FiZoomIn size={13} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="重置画布视图">
                <ActionIcon variant="default" size={26} onClick={() => { setZoom(1); setOffset({ x: 24, y: 24 }); }}>
                  <FiRefreshCw size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : (
            <Group gap={6}>
              <Select
                size="xs"
                w={110}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v || "all")}
                data={[
                  { value: "all", label: "全部状态" },
                  { value: "planned", label: "规划中" },
                  { value: "in_progress", label: "进行中" },
                  { value: "completed", label: "已完成" },
                ]}
              />
              <Button size="xs" variant="default" leftSection={<FiMaximize2 size={12} />} onClick={() => tree && setTree(setAllCollapsed(tree, false))}>
                全部展开
              </Button>
              <Button size="xs" variant="default" leftSection={<FiMinimize2 size={12} />} onClick={() => tree && setTree(setAllCollapsed(tree, true))}>
                全部收起
              </Button>
            </Group>
          )}
        </Group>

        <Group gap={8}>
          <Button size="xs" variant="default" leftSection={<FiPlus size={13} />} onClick={() => handleAddChild(selectedId || "root", "end", viewMode === "mindmap")}>
            添加子节点
          </Button>
          <Button size="xs" variant="light" leftSection={<FiCpu size={13} />} onClick={() => setAiModalOpened(true)}>
            AI 生成/反推总纲
          </Button>
          <Button size="xs" leftSection={<FiSave size={13} />} loading={saving} onClick={handleSave}>
            {dirty ? "保存总纲 *" : "保存总纲"}
          </Button>
        </Group>
      </Flex>

      {/* 主工作区 */}
      {tree ? (
        viewMode === "mindmap" ? (
          <Flex flex={1} mih={0} style={{ overflow: "hidden" }}>
            <MindMapView
              tree={tree}
              selectedId={selectedId}
              autoEditNodeId={autoEditNodeId}
              onAutoEditHandled={handleAutoEditHandled}
              zoom={zoom}
              offset={offset}
              onOffsetChange={setOffset}
              onTransformChange={handleTransformChange}
              onSelect={setSelectedId}
              onToggleCollapse={handleToggleCollapse}
              onInlineUpdate={(id, patch) => mutateTree((prev) => updateNode(prev, id, patch))}
              onAddChild={(parentId, position) => handleAddChild(parentId, position, true)}
              onAddSibling={(targetId, position) => handleAddSibling(targetId, position, true)}
              onMoveNode={(id, dir) => mutateTree((prev) => moveNode(prev, id, dir))}
              onDeleteNode={handleDelete}
            />

            {/* 右侧极简节点属性面板 */}
            <Box p={16} className={styles.inspector}>
              {selectedNode ? (
                <Stack gap={12}>
                  <Flex align="center" justify="space-between">
                    <Text fz={13} fw={700} c="#0f172a">节点属性</Text>
                    <Badge size="xs" variant="light">{selectedNode.id === "root" ? "根节点" : "分支节点"}</Badge>
                  </Flex>

                  <TextInput
                    size="xs"
                    label="节点名称"
                    value={selectedNode.title}
                    onChange={(e) => mutateTree((prev) => updateNode(prev, selectedNode.id, { title: e.target.value }))}
                  />

                  <TextInput
                    size="xs"
                    label="标签分类"
                    placeholder="如：卷 / 主线 / 支线 / 高潮 / 伏笔"
                    value={selectedNode.tag || ""}
                    onChange={(e) => mutateTree((prev) => updateNode(prev, selectedNode.id, { tag: e.target.value }))}
                  />

                  <Flex gap={4} wrap="wrap">
                    {TAG_PRESETS.map((t) => (
                      <Badge
                        key={t}
                        size="xs"
                        variant={selectedNode.tag === t ? "filled" : "light"}
                        style={{ cursor: "pointer" }}
                        onClick={() => mutateTree((prev) => updateNode(prev, selectedNode.id, { tag: t }))}
                      >
                        {t}
                      </Badge>
                    ))}
                  </Flex>

                  <Textarea
                    size="xs"
                    label="要点说明"
                    placeholder="核心冲突、推进目标、关键伏笔..."
                    minRows={4}
                    autosize
                    value={selectedNode.note || ""}
                    onChange={(e) => mutateTree((prev) => updateNode(prev, selectedNode.id, { note: e.target.value }))}
                  />

                  {selectedNode.id !== "root" ? (
                    <>
                      <TextInput
                        size="xs"
                        label="关联章节范围（选填）"
                        placeholder="如：1-20"
                        value={selectedNode.chapterRange || ""}
                        onChange={(e) => mutateTree((prev) => updateNode(prev, selectedNode.id, { chapterRange: e.target.value }))}
                      />

                      <Select
                        size="xs"
                        label="推进状态"
                        value={selectedNode.status || "planned"}
                        data={[
                          { value: "planned", label: "规划中" },
                          { value: "in_progress", label: "进行中" },
                          { value: "completed", label: "已完成" },
                        ]}
                        onChange={(val) =>
                          mutateTree((prev) => updateNode(prev, selectedNode.id, { status: (val || "planned") as MasterOutlineStatus }))
                        }
                      />
                    </>
                  ) : null}

                  <Divider color="#f1f5f9" />

                  <Stack gap={6}>
                    <Button size="xs" variant="light" leftSection={<FiPlus size={13} />} onClick={() => handleAddChild(selectedNode.id, "end", true)}>
                      添加子节点 (Tab)
                    </Button>
                    {selectedNode.id !== "root" ? (
                      <>
                        <Group grow gap={6}>
                          <Button size="xs" variant="default" leftSection={<FiArrowUp size={12} />} onClick={() => handleAddSibling(selectedNode.id, "before", true)}>
                            上方加同级
                          </Button>
                          <Button size="xs" variant="default" leftSection={<FiArrowDown size={12} />} onClick={() => handleAddSibling(selectedNode.id, "after", true)}>
                            下方加同级
                          </Button>
                        </Group>
                        {selectedSiblingMeta ? (
                          <Group grow gap={6}>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="gray"
                              leftSection={<FiArrowUp size={12} />}
                              disabled={selectedSiblingMeta.index === 0}
                              onClick={() => mutateTree((prev) => moveNode(prev, selectedNode.id, "up"))}
                            >
                              上移
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="gray"
                              leftSection={<FiArrowDown size={12} />}
                              disabled={selectedSiblingMeta.index === selectedSiblingMeta.count - 1}
                              onClick={() => mutateTree((prev) => moveNode(prev, selectedNode.id, "down"))}
                            >
                              下移
                            </Button>
                          </Group>
                        ) : null}
                      </>
                    ) : null}
                    {selectedNode.chapterRange?.trim() ? (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<FiCpu size={13} />}
                        onClick={() => handleJumpToAiAnalysis(selectedNode.chapterRange || "", selectedNode.title)}
                      >
                        AI 诊断此阶段 (第{selectedNode.chapterRange}章)
                      </Button>
                    ) : null}
                    {selectedNode.id !== "root" ? (
                      <Button size="xs" variant="subtle" color="red" leftSection={<FiTrash2 size={13} />} onClick={() => handleDelete(selectedNode.id)}>
                        删除此节点
                      </Button>
                    ) : null}
                  </Stack>

                  <Text fz={11} c="#94a3b8" lh={1.5}>
                    提示：滚轮缩放画布，拖动画布平移，点击卡片名称/要点即可直接编辑，悬浮/选中节点可点四周 + 号或右键菜单，Tab 加子节点，Shift+Enter / Enter 上/下方加同级。
                  </Text>
                </Stack>
              ) : null}
            </Box>
          </Flex>
        ) : (
          <TableView
            tree={tree}
            statusFilter={statusFilter}
            onUpdateNode={(id, patch) => mutateTree((prev) => updateNode(prev, id, patch))}
            onAddChild={handleAddChild}
            onDeleteNode={handleDelete}
            onMoveNode={(id, dir) => mutateTree((prev) => moveNode(prev, id, dir))}
            onToggleCollapse={handleToggleCollapse}
            onJumpToAiAnalysis={handleJumpToAiAnalysis}
          />
        )
      ) : null}

      {/* AI 生成/反推总纲弹窗 */}
      <Modal opened={aiModalOpened} onClose={() => setAiModalOpened(false)} title="AI 一键生成 / 反推项目总纲" centered size="md">
        <Stack gap={12}>
          <Text fz={12} c="#64748b" lh={1.6}>
            AI 将自动读取作品简介、角色档案、世界观规则以及已写章节大纲，生成一棵可直接编辑的总纲树。
          </Text>
          <Textarea
            size="xs"
            label="补充构想或风格要求（选填）"
            placeholder="例如：按四卷结构规划，主线围绕寻找失落古玉展开，末尾反转..."
            minRows={3}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <Flex justify="flex-end" gap={8}>
            <Button size="xs" variant="default" onClick={() => setAiModalOpened(false)}>取消</Button>
            <Button size="xs" leftSection={<FiCpu size={13} />} loading={aiLoading} onClick={handleAiGenerate}>
              开始生成
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </Box>
  );
}
