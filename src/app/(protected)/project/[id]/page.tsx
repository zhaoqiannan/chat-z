"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Box } from "@mantine/core";
import Loading from "@/components/common/loading";

const PageLoader = () => <Loading loading h="60vh">{null}</Loading>;

const ProjectOverview = dynamic(() => import("@/components/pages/project/overview"), { loading: PageLoader });
const StoryOutline = dynamic(() => import("@/components/pages/project/outline"), { loading: PageLoader });
const ProjectChapters = dynamic(() => import("@/components/pages/project/chapters"), { loading: PageLoader });
const WorldLore = dynamic(() => import("@/components/pages/project/world"), { loading: PageLoader });
const NotesPage = dynamic(() => import("@/components/pages/project/notes"), { loading: PageLoader });
const MaterialsPage = dynamic(() => import("@/components/pages/project/materials"), { loading: PageLoader });
const AiAnalysisPage = dynamic(() => import("@/components/pages/project/ai-analysis"), { loading: PageLoader });
const TimelinePage = dynamic(() => import("@/components/pages/project/timeline"), { loading: PageLoader });
const RelationGraphPage = dynamic(() => import("@/components/pages/project/relation-graph"), { loading: PageLoader });
const ProjectSettingsPage = dynamic(() => import("@/components/pages/project/settings"), { loading: PageLoader });

const VALID_TABS = ["outline", "chapters", "world", "notes", "materials", "ai_analysis", "timeline", "relation_graph", "settings", "overview"];

function ProjectDetailContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  return (
    <Box w="100%" h="100%">
      {tab === "outline" && <StoryOutline />}
      {tab === "chapters" && <ProjectChapters />}
      {tab === "world" && <WorldLore />}
      {tab === "notes" && <NotesPage />}
      {tab === "materials" && <MaterialsPage />}
      {tab === "ai_analysis" && <AiAnalysisPage />}
      {tab === "timeline" && <TimelinePage />}
      {tab === "relation_graph" && <RelationGraphPage />}
      {tab === "settings" && <ProjectSettingsPage />}
      {tab === "overview" && <ProjectOverview />}
      {!VALID_TABS.includes(tab) && <ProjectOverview />}
    </Box>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProjectDetailContent />
    </Suspense>
  );
}
