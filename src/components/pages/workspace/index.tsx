"use client";

import React from "react";
import { Box, Flex, Text } from "@mantine/core";
import { workspaceMockData } from "./mock.js";
import RecentChapterCard from "./RecentChapterCard";
import WorksSection from "./WorksSection";
import CreationStats from "./CreationStats";
import AiSuggestions from "./AiSuggestions";
import RecentActivities from "./RecentActivities";

export default function WorkspacePage() {
  const {
    welcome,
    recentChapter,
    worksList,
    creationStats,
    aiSuggestions,
    recentActivities,
  } = workspaceMockData;

  return (
    <Box
      mih="calc(100vh - 60px)"
      bg="#f8fafc"
      p="24px 32px 48px"
      maw={1440}
      mx="auto"
    >
      <Box mb={24}>
        <Text fz={24} fw={700} c="#1e293b" lh={1.3}>
          {welcome.title}
        </Text>
        <Text fz={13} c="#94a3b8" mt={6}>
          {welcome.subtitle}
        </Text>
      </Box>

      <Flex
        gap={24}
        align="flex-start"
        direction={{ base: "column", md: "row" }}
      >
        <Flex direction="column" gap={24} style={{ flex: 1, minWidth: 0 }} w="100%">
          <RecentChapterCard data={recentChapter} />
          <WorksSection works={worksList} />
          <CreationStats stats={creationStats} />
        </Flex>

        <Flex
          direction="column"
          gap={20}
          w={{ base: "100%", md: 340 }}
          style={{ flexShrink: 0 }}
        >
          <AiSuggestions suggestions={aiSuggestions} />
          <RecentActivities activities={recentActivities} />
        </Flex>
      </Flex>
    </Box>
  );
}
