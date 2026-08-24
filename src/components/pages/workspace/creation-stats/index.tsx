"use client";

import React from "react";
import { Box, Flex, Text, SimpleGrid, Paper } from "@mantine/core";
import NoData from "@/components/common/no-data";

export interface StatItem {
  id: string | number;
  label: string;
  value: string | number;
  unit: string;
  color?: string;
}

interface CreationStatsProps {
  stats?: StatItem[];
}

export default function CreationStats({ stats }: CreationStatsProps) {
  return (
    <Box>
      <Box mb={14}>
        <Text fz={16} fw={700} c="#1e293b">
          创作统计
        </Text>
      </Box>

      {stats && stats.length > 0 ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={16}>
          {stats.map((stat) => (
            <Paper
              key={stat.id}
              p="18px 20px"
              bg="#ffffff"
              bd="1px solid #e2e8f0"
              radius="md"
            >
              <Text fz={13} c="#94a3b8" mb={8}>
                {stat.label}
              </Text>
              <Flex
                align="baseline"
                gap={4}
                fz={24}
                fw={700}
                c={stat.color || "#00c9ff"}
              >
                {stat.value}
                <Text component="span" fz={13} fw={500} c="inherit">
                  {stat.unit}
                </Text>
              </Flex>
            </Paper>
          ))}
        </SimpleGrid>
      ) : (
        <NoData title="暂无统计数据" />
      )}
    </Box>
  );
}
