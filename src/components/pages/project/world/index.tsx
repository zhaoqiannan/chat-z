"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Box } from "@mantine/core";
import CharactersTab from "./characters";
import LocationsTab from "./locations";
import FactionsTab from "./factions";
import ItemsTab from "./items";
import RulesTab from "./rules";
import styles from "./style.module.scss";

export default function WorldLorePage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const workId = String(params?.id || "");
  const subTab = searchParams.get("subTab") || "characters";

  return (
    <Box className={styles.container}>
      <main className={styles.contentArea}>
        {subTab === "characters" && <CharactersTab workId={workId} />}
        {subTab === "locations" && <LocationsTab workId={workId} />}
        {subTab === "factions" && <FactionsTab workId={workId} />}
        {subTab === "items" && <ItemsTab workId={workId} />}
        {subTab === "rules" && <RulesTab workId={workId} />}
      </main>
    </Box>
  );
}
