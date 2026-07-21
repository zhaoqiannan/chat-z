"use client";

import React from 'react';
import { Box, Title, Text, SimpleGrid, Card, Group, Stack } from '@mantine/core';
import { FiMessageSquare } from 'react-icons/fi';
import { TEMPLATES, UI_TEXT } from './constants';
import styles from './style.module.scss';

interface ChatTemplatesProps {
    userName: string;
    onSelectPrompt: (prompt: string) => void;
}

export default function ChatTemplates({ userName, onSelectPrompt }: ChatTemplatesProps) {
    return (
        <Box style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '70vh',
            padding: '24px'
        }}>
            {/* Greeting / Brand Section */}
            <Stack align="center" gap={8} mb={40} style={{ textAlign: 'center' }}>
                <Box style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 30px rgba(79, 70, 229, 0.25)',
                    animation: 'pulse 3s infinite ease-in-out'
                }}>
                    <FiMessageSquare size={30} color="#fff" />
                </Box>
                <Title order={2} style={{ 
                    background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '28px',
                    fontWeight: 800
                }}>
                    {UI_TEXT.greetingPrefix}{userName || UI_TEXT.greetingDefault}
                </Title>
                <Text size="sm" c="dimmed" style={{ maxWidth: '480px' }}>
                    {UI_TEXT.aiSubtitle}
                </Text>
            </Stack>

            {/* Templates Simple Grid */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" w="100%" max-w="800px">
                {TEMPLATES.map((item, idx) => (
                    <Card
                        key={idx}
                        shadow="sm"
                        padding="lg"
                        radius="md"
                        withBorder
                        onClick={() => onSelectPrompt(item.prompt)}
                        className={styles.templateCard}
                    >
                        <Group gap={16} wrap="nowrap" align="flex-start">
                            <Box style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                backgroundColor: '#f8fafc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {item.icon}
                            </Box>
                            <Stack gap={4}>
                                <Text fw={600} size="sm" c="#1e293b">
                                    {item.title}
                                </Text>
                                <Text size="xs" c="dimmed" lh={1.4}>
                                    {item.description}
                                </Text>
                            </Stack>
                        </Group>
                    </Card>
                ))}
            </SimpleGrid>
        </Box>
    );
}
