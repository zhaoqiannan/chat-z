"use client";

import React from "react";
import { Box, Flex, Text, Paper } from "@mantine/core";
import NoData from "@/components/common/no-data";

export interface ActivityItem {
  id: string | number;
  title: string;
  time: string;
  description: string;
}

interface RecentActivitiesProps {
  activities?: ActivityItem[];
}

export default function RecentActivities({
  activities,
}: RecentActivitiesProps) {
  return (
    <Paper p={20} bg="#ffffff" bd="1px solid #e2e8f0" radius="md">
      <Box mb={14}>
        <Text fz={15} fw={700} c="#1e293b">
          近期动态
        </Text>
      </Box>

      {activities && activities.length > 0 ? (
        <Flex direction="column">
          {activities.map((activity, index) => (
            <Box
              key={activity.id}
              py={12}
              style={{
                borderBottom:
                  index < activities.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
            >
              <Flex justify="space-between" align="baseline" gap={8}>
                <Text fz={13} fw={600} c="#1e293b" lh={1.4}>
                  {activity.title}
                </Text>
                <Text
                  fz={12}
                  c="#94a3b8"
                  style={{ whiteSpace: "nowrap" }}
                >
                  {activity.time}
                </Text>
              </Flex>
              <Text fz={12} c="#64748b" lh={1.5} mt={4}>
                {activity.description}
              </Text>
            </Box>
          ))}
        </Flex>
      ) : (
        <NoData title="暂无近期动态" height={160} />
      )}
    </Paper>
  );
}
