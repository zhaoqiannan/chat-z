"use client";

import React from "react";
import { Flex, Text, Box } from "@mantine/core";
import { FiInbox } from "react-icons/fi";
import styles from "./style.module.scss";

interface NoDataProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  height?: number | string;
}

export default function NoData({
  title = "暂无数据",
  description,
  icon,
  height = 160,
}: NoDataProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      h={height}
      className={styles.noDataContainer}
    >
      <Box className={styles.iconWrapper}>
        {icon || <FiInbox size={32} color="#94a3b8" />}
      </Box>
      <Text size="sm" fw={500} c="#64748b" mt={8}>
        {title}
      </Text>
      {description && (
        <Text size="xs" c="#94a3b8" mt={4} ta="center">
          {description}
        </Text>
      )}
    </Flex>
  );
}
