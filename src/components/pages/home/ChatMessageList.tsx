"use client";

import React from 'react';
import { Box, ScrollArea, Stack, Paper, Text } from '@mantine/core';
import { FiCpu } from 'react-icons/fi';
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
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.15)'
                                }}>
                                    <FiCpu size={18} color="#fff" />
                                </Box>
                            )}
                        </Box>

                        {/* Message Bubble */}
                        <Paper
                            shadow="none"
                            radius="lg"
                            px="md"
                            py="sm"
                            style={{
                                maxWidth: '78%',
                                backgroundColor: msg.role === 'user' ? '#4f46e5' : '#ffffff',
                                border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                                color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                                boxShadow: msg.role === 'user' ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                                borderRadius: msg.role === 'user' 
                                    ? '16px 4px 16px 16px' 
                                    : '4px 16px 16px 16px'
                            }}
                        >
                            <Text 
                                size="sm" 
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
                            </Text>
                        </Paper>
                    </Box>
                ))}
            </Stack>
        </ScrollArea>
    );
}
