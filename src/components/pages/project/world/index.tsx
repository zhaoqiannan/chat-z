"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Box, ScrollArea } from "@mantine/core";
import CharactersTab from "./characters";
import LocationsTab from "./locations";
import FactionsTab from "./factions";
import ItemsTab from "./items";
import RulesTab from "./rules";

export default function WorldLorePage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const workId = String(params?.id || "");
  const subTab = searchParams.get("subTab") || "characters";

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <ScrollArea style={{ flex: 1 }} p={{ base: "md", md: "xl" }}>
        {subTab === "characters" && <CharactersTab workId={workId} />}
        {subTab === "locations" && <LocationsTab workId={workId} />}
        {subTab === "factions" && <FactionsTab workId={workId} />}
        {subTab === "items" && <ItemsTab workId={workId} />}
        {subTab === "rules" && <RulesTab workId={workId} />}
      </ScrollArea>
    </Box>
  );
}
