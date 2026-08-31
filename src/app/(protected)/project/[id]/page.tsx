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

function ProjectDetailContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  return (
    <Box w="100%" h="100%">
      {tab === "outline" && <StoryOutline />}
      {tab === "chapters" && <ProjectChapters />}
      {tab !== "outline" && tab !== "chapters" && <ProjectOverview />}
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
