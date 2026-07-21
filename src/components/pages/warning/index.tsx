"use client";
import React from 'react';
import { Title, Text, Box } from '@mantine/core';

export default function WarningPage() {
    return (
        <Box p={24}>
            <Title order={2}>自然灾害预警</Title>
            <Text c="dimmed" mt={8}>
                这是自然灾害预警页面的框架占位。
            </Text>
        </Box>
    );
}