// 组件：故事大纲工作台（局部 OutlineContext 协调多 Tab，按需请求各 Tab 最新数据）
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Box, Flex, Tabs } from "@mantine/core";
import { FiBookOpen, FiEdit3, FiGitBranch, FiZap } from "react-icons/fi";
import { createOutlineNode, updateOutlineNode } from "@/rest/outline";
import ModalNodeEditor from "./modal-node-editor";
import OutlineCategoryPanel from "./category-panel";
import { OutlineProvider, OutlineTabKey, useOutlineContext } from "./context/OutlineContext";

const MasterOutlineWorkspace = dynamic(() => import("./master-outline"), { ssr: false });
const PlotDeductionWorkspace = dynamic(() => import("./plot-deduction-workspace"), { ssr: false });
const DrawerPlotDeduction = dynamic(() => import("./drawer-plot-deduction"), { ssr: false });
const DrawerPlotDeductionHistory = dynamic(() => import("./drawer-plot-deduction/drawer-plot-deduction-history"), { ssr: false });
const DrawerThoughtOrganizer = dynamic(() => import("./drawer-thought-organizer"), { ssr: false });

function StoryOutlineContent() {
  const {
    workId,
    activeTab,
    setActiveTab,
    showLegacyDeductionList,
    setShowLegacyDeductionList,
    deductionTargetMasterNodeId,
    jumpToPlotDeduction,
    jumpToQualityAudit,
    tabCounts,
    activeCategoryNodes,
    triggerRefresh,
    editorModalOpened,
    editingNode,
    parentForNewChild,
    editorCategory,
    closeEditorModal,
    deductionDrawerOpened,
    loadedDeductionRecord,
    openDeductionDrawer,
    closeDeductionDrawer,
    historyDrawerOpened,
    closeHistoryDrawer,
    thoughtDrawerOpened,
    closeThoughtDrawer,
  } = useOutlineContext();

  return (
    <Flex direction="column" h="calc(100vh - 64px)" bg="#ffffff" pos="relative" style={{ overflow: "hidden" }}>
      {/* 四大 Tab 切换栏（切入对应 Tab 时由子面板独立拉取最新数据） */}
      <Box px="md" pt={0} style={{ borderBottom: "1px solid #f1f5f9" }}>
        <Tabs
          value={activeTab}
          onChange={(val) => {
            if (val) setActiveTab(val as OutlineTabKey);
          }}
          styles={{ tab: { paddingTop: 6, paddingBottom: 7 } }}
        >
          <Tabs.List>
            <Tabs.Tab value="master" leftSection={<FiGitBranch size={15} color="#00c9ff" />}>
              1. 项目总纲
            </Tabs.Tab>
            <Tabs.Tab value="deduction" leftSection={<FiZap size={15} color="#2563eb" />}>
              2. 章节规划与起草
            </Tabs.Tab>
            <Tabs.Tab value="chapter" leftSection={<FiBookOpen size={15} color="#00c9ff" />}>
              3. 章节大纲{tabCounts.chapter !== undefined ? ` (${tabCounts.chapter})` : ""}
            </Tabs.Tab>
            <Tabs.Tab value="memo" leftSection={<FiEdit3 size={15} color="#64748b" />}>
              4. 灵感卡片{tabCounts.memo !== undefined ? ` (${tabCounts.memo})` : ""}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Box>

      {activeTab === "master" ? (
        <Box flex={1} mih={0} style={{ overflow: "hidden" }}>
          <MasterOutlineWorkspace workId={workId} onJumpToPlotDeduction={jumpToPlotDeduction} />
        </Box>
      ) : null}

      {activeTab === "deduction" && !showLegacyDeductionList ? (
        <Box flex={1} mih={0} style={{ overflow: "hidden" }}>
          <PlotDeductionWorkspace
            workId={workId}
            initialNodeId={deductionTargetMasterNodeId}
            legacyCardCount={tabCounts.deduction ?? 0}
            onShowLegacyCards={() => setShowLegacyDeductionList(true)}
            onJumpToQualityAudit={jumpToQualityAudit}
          />
        </Box>
      ) : null}

      {activeTab === "deduction" && showLegacyDeductionList ? (
        <OutlineCategoryPanel key="deduction" category="deduction" />
      ) : null}

      {activeTab === "chapter" ? <OutlineCategoryPanel key="chapter" category="chapter" /> : null}

      {activeTab === "memo" ? <OutlineCategoryPanel key="memo" category="memo" /> : null}

      {/* 大纲卡片编辑/创建弹窗 */}
      <ModalNodeEditor
        opened={editorModalOpened}
        onClose={closeEditorModal}
        workId={workId}
        category={editorCategory}
        editingNode={editingNode}
        onSaved={triggerRefresh}
        onSubmitCreate={(payload) => {
          if (parentForNewChild) {
            return createOutlineNode({
              ...payload,
              parentId: parentForNewChild.id,
              level: 2,
            });
          }
          return createOutlineNode(payload);
        }}
        onSubmitUpdate={updateOutlineNode}
      />

      {/* A➔B 跨度推演工作台抽屉 */}
      <DrawerPlotDeduction
        opened={deductionDrawerOpened}
        onClose={closeDeductionDrawer}
        workId={workId}
        outlineNodes={activeCategoryNodes}
        onOutlineUpdated={triggerRefresh}
        loadedRecord={loadedDeductionRecord}
      />

      {/* 独立剧情推演历史抽屉 */}
      <DrawerPlotDeductionHistory
        opened={historyDrawerOpened}
        onClose={closeHistoryDrawer}
        workId={workId}
        onOutlineUpdated={triggerRefresh}
        onLoadToDeduct={(rec) => openDeductionDrawer(rec)}
      />

      {/* AI 思路整理抽屉 */}
      <DrawerThoughtOrganizer
        opened={thoughtDrawerOpened}
        onClose={closeThoughtDrawer}
        workId={workId}
        onOutlineUpdated={triggerRefresh}
      />
    </Flex>
  );
}

export default function StoryOutlinePage() {
  const params = useParams();
  const workId = String(params?.id || "");

  return (
    <OutlineProvider workId={workId}>
      <StoryOutlineContent />
    </OutlineProvider>
  );
}
