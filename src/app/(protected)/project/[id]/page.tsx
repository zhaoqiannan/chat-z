"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Box, LoadingOverlay } from "@mantine/core";

const ProjectOverview = dynamic(
  () => import("@/components/pages/project/overview"),
  { loading: () => <LoadingOverlay visible /> }
);

const StoryOutline = dynamic(
  () => import("@/components/pages/project/outline"),
  { loading: () => <LoadingOverlay visible /> }
);

const ProjectChapters = dynamic(
  () => import("@/components/pages/project/chapters"),
  { loading: () => <LoadingOverlay visible /> }
);

const WorldLore = dynamic(
  () => import("@/components/pages/project/world"),
  { loading: () => <LoadingOverlay visible /> }
);

const NotesPage = dynamic(
  () => import("@/components/pages/project/notes"),
  { loading: () => <LoadingOverlay visible /> }
);

const MaterialsPage = dynamic(
  () => import("@/components/pages/project/materials"),
  { loading: () => <LoadingOverlay visible /> }
);

const TimelinePage = dynamic(
  () => import("@/components/pages/project/timeline"),
  { loading: () => <LoadingOverlay visible /> }
);

const RelationGraphPage = dynamic(
  () => import("@/components/pages/project/relation-graph"),
  { loading: () => <LoadingOverlay visible /> }
);

const ProjectSettingsPage = dynamic(
  () => import("@/components/pages/project/settings"),
  { loading: () => <LoadingOverlay visible /> }
);

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
      {tab === "timeline" && <TimelinePage />}
      {tab === "relation_graph" && <RelationGraphPage />}
      {tab === "settings" && <ProjectSettingsPage />}
      {tab === "overview" && <ProjectOverview />}
      {![
        "outline",
        "chapters",
        "world",
        "notes",
        "materials",
        "timeline",
        "relation_graph",
        "settings",
        "overview",
      ].includes(tab) && <ProjectOverview />}
    </Box>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<LoadingOverlay visible />}>
      <ProjectDetailContent />
    </Suspense>
  );
}
