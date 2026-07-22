"use client";

import React from 'react';
import { Box, ScrollArea, Stack, Paper, Text } from '@mantine/core';
import Image from 'next/image';
import AvatarCircle from '@/components/common/avatar-circle';
import { UI_TEXT } from './constants';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatMessageListProps {
    messages: Message[];
    userName: string;
    viewportRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatMessageList({ messages, userName, viewportRef }: ChatMessageListProps) {
    return (
        <ScrollArea
            viewportRef={viewportRef}
            style={{ flex: 1, paddingBottom: '20px' }}
            scrollbarSize={6}
        >
            <Stack gap={24} pr={12} pl={4} pt={16}>
                {messages.map((msg) => (
                    <Box
                        key={msg.id}
                        style={{
                            display: 'flex',
                            gap: '16px',
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                            alignItems: 'flex-start',
                            animation: 'fadeIn 0.25s ease-out'
                        }}
                    >
                        {/* Avatar */}
                        <Box style={{ flexShrink: 0 }}>
                            {msg.role === 'user' ? (
                                <AvatarCircle
                                    text={userName}
                                    size={38}
                                    textSize="14px"
                                />
                            ) : (
                                <Box style={{
                                    position: 'relative',
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 8px rgba(0, 201, 255, 0.15)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#1e293b'
                                }}>
                                    <Image
                                        src="/images/logo-mini.svg"
                                        alt="chat-z"
                                        width={38}
                                        height={38}
                                        style={{ objectFit: 'contain' }}
                                    />
                                </Box>
                            )}
                        </Box>

                        <Paper
                            shadow="none"
                            radius="lg"
                            px="md"
                            py="sm"
                            style={{
                                maxWidth: '78%',
                                backgroundColor: msg.role === 'user' ? '#00c9ff' : '#ffffff',
                                border: msg.role === 'user' ? 'none' : '1px solid #f1f5f9',
                                color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                                boxShadow: msg.role === 'user' ? '0 4px 12px rgba(0, 201, 255, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.02)',
                                borderRadius: msg.role === 'user'
                                    ? '16px 4px 16px 16px'
                                    : '4px 16px 16px 16px'
                            }}
                        >
                            <Box
                                lh={1.6}
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}
                            >
                                {msg.content || (
                                    <Text size="xs" c="dimmed" style={{ fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        {UI_TEXT.thinkingText}
                                    </Text>
                                )}
                            </Box>
                        </Paper>
                    </Box>
                ))}
            </Stack>
        </ScrollArea>
    );
}
