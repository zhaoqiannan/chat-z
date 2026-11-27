// 组件：故事大纲工作台（局部 OutlineContext 协调 4 大创作 Tab，按需请求最新数据）
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
const DrawerThoughtOrganizer = dynamic(() => import("./drawer-thought-organizer"), { ssr: false });

function StoryOutlineContent() {
  const {
    workId,
    activeTab,
    setActiveTab,
    deductionTargetMasterNodeId,
    jumpToPlotDeduction,
    jumpToQualityAudit,
    tabCounts,
    triggerRefresh,
    editorModalOpened,
    editingNode,
    parentForNewChild,
    editorCategory,
    closeEditorModal,
    thoughtDrawerOpened,
    closeThoughtDrawer,
  } = useOutlineContext();

  return (
    <Flex direction="column" h="calc(100vh - 64px)" bg="#ffffff" pos="relative" style={{ overflow: "hidden" }}>
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

      {activeTab === "deduction" ? (
        <Box flex={1} mih={0} style={{ overflow: "hidden" }}>
          <PlotDeductionWorkspace
            workId={workId}
            initialNodeId={deductionTargetMasterNodeId}
            onJumpToQualityAudit={jumpToQualityAudit}
          />
        </Box>
      ) : null}

      {activeTab === "chapter" ? <OutlineCategoryPanel key="chapter" category="chapter" /> : null}

      {activeTab === "memo" ? <OutlineCategoryPanel key="memo" category="memo" /> : null}

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
