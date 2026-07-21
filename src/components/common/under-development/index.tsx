"use client";

import React from "react";
import { Box, Flex, Text, Card, SimpleGrid, Paper, Title } from "@mantine/core";
import { FiCpu, FiInfo } from "react-icons/fi";
import styles from "./style.module.scss";

interface UnderDevelopmentProps {
    title: string;
    subtitle?: string;
    description?: string;
    expectedFeatures?: string[];
    icon?: React.ReactNode;
}

export default function UnderDevelopment({
    title,
    subtitle = "功能暂未开放，正在进行底层对接与设计。",
    description = "该模块暂未开放，平台开发团队正在进行高标准设计与底层数据对接。敬请期待正式版本上线。",
    expectedFeatures = [],
    icon = <FiCpu color="#00c9ff" size={36} />
}: UnderDevelopmentProps) {
    return (
        <Flex mih="calc(100vh - 60px)" direction="column">
            <Flex justify="space-between" align="center" h={80} pl={24} pr={24} bg="#fff" style={{ borderBottom: "1px solid #f0f2f5" }}>
                <Flex gap={8} align="center">
                    {icon}
                    <Flex direction="column">
                        <Title c="#333" order={4}>{title}</Title>
                        <Text c="#666" mt={2} size="xs">
                            {subtitle}
                        </Text>
                    </Flex>
                </Flex>
            </Flex>

            <Box p={24} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Card
                    bg="#ffffff"
                    bd="1px solid #e9ecef"
                    radius="md"
                    p={40}
                    shadow="xs"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: 1,
                        textAlign: "center"
                    }}
                >
                    <Flex pos="relative" w={120} h={120} mb={24} align="center" justify="center">
                        <Box className={styles.pulseCircle} />
                        <FiCpu className={styles.icon} />
                    </Flex>

                    <Text fz={20} fw={600} c="#333" mb={12}>功能暂未开放</Text>
                    <Text fz={14} c="#666" maw={480} lh={1.6} mb={32}>
                        {description}
                    </Text>

                    {expectedFeatures.length > 0 && (
                        <Paper bg="#f8f9fa" bd="1px solid #e9ecef" radius="md" p="24px 32px" maw={500} w="100%" style={{ textAlign: "left" }}>
                            <Flex align="center" gap={6} fz={13} fw={600} c="#333" mb={12} style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                <FiInfo size={14} color="#00c9ff" />
                                规划包含的特性
                            </Flex>
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={12}>
                                {expectedFeatures.map((feature, index) => (
                                    <Flex key={index} align="center" gap={8} fz={13} c="#666">
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#00c9ff", flexShrink: 0 }} />
                                        {feature}
                                    </Flex>
                                ))}
                            </SimpleGrid>
                        </Paper>
                    )}
                </Card>
            </Box>
        </Flex>
    );
}
