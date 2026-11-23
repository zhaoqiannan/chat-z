"use client";

import React from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import styles from "./style.module.scss";

interface LoadingMaskProps {
  visible: boolean;
  label?: string;
}

const LoadingMask: React.FC<LoadingMaskProps> = ({ visible, label }) => {
  if (!visible) return null;

  return (
    <Center className={styles.mask}>
      <Stack align="center" gap={8}>
        <Loader size="sm" color="#00c9ff" />
        {label ? <Text fz={12} c="#64748b">{label}</Text> : null}
      </Stack>
    </Center>
  );
};

export default LoadingMask;
