"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Box, Tabs, Flex, Text, Badge } from "@mantine/core";
import {
  FiUsers,
  FiMap,
  FiShield,
  FiBox,
  FiLayers,
  FiDatabase,
} from "react-icons/fi";
import CharactersTab from "./characters";
import LocationsTab from "./locations";
import FactionsTab from "./factions";
import ItemsTab from "./items";
import RulesTab from "./rules";
import styles from "./style.module.scss";

export default function WorldLorePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const workId = String(params?.id || "");
  const subTabFromQuery = searchParams.get("subTab") || "characters";

  const [activeTab, setActiveTab] = useState<string>(subTabFromQuery);

  useEffect(() => {
    if (subTabFromQuery) {
      setActiveTab(subTabFromQuery);
    }
  }, [subTabFromQuery]);

  const handleTabChange = (val: string | null) => {
    if (val) {
      setActiveTab(val);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", "world");
      nextParams.set("subTab", val);
      router.replace(`?${nextParams.toString()}`);
    }
  };

  return (
    <Box className={styles.container}>
      {/* 顶部世界观导航栏 */}
      <header className={styles.header}>
        <Flex align="center" gap={10}>
          <FiDatabase size={20} color="#00c9ff" />
          <Text fw={700} fz={18} c="#1e293b">
            世界观与知识库
          </Text>
          <Badge color="cyan" variant="light">
            作品 ID: {workId}
          </Badge>
        </Flex>

        <Tabs value={activeTab} onChange={handleTabChange} color="cyan">
          <Tabs.List>
            <Tabs.Tab value="characters" leftSection={<FiUsers size={14} />}>
              角色卡片
            </Tabs.Tab>
            <Tabs.Tab value="locations" leftSection={<FiMap size={14} />}>
              地点与地图
            </Tabs.Tab>
            <Tabs.Tab value="factions" leftSection={<FiShield size={14} />}>
              阵营势力
            </Tabs.Tab>
            <Tabs.Tab value="items" leftSection={<FiBox size={14} />}>
              物品法宝
            </Tabs.Tab>
            <Tabs.Tab value="rules" leftSection={<FiLayers size={14} />}>
              规则与境界
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </header>

      {/* 主体内容工作区 */}
      <main className={styles.contentArea}>
        {activeTab === "characters" && <CharactersTab workId={workId} />}
        {activeTab === "locations" && <LocationsTab workId={workId} />}
        {activeTab === "factions" && <FactionsTab workId={workId} />}
        {activeTab === "items" && <ItemsTab workId={workId} />}
        {activeTab === "rules" && <RulesTab workId={workId} />}
      </main>
    </Box>
  );
}
