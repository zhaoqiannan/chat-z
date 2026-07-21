"use client";

import React from 'react';
import { Box, Paper, Group, Textarea, Tooltip, ActionIcon, Text } from '@mantine/core';
import { FiSend, FiSquare } from 'react-icons/fi';
import { UI_TEXT } from './constants';
import styles from './style.module.scss';

interface ChatInputProps {
    input: string;
    setInput: (val: string) => void;
    loading: boolean;
    onSend: () => void;
    onStop: () => void;
}

export default function ChatInput({ input, setInput, loading, onSend, onStop }: ChatInputProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <Box style={{
            paddingTop: '8px',
            backgroundColor: 'transparent',
            position: 'relative',
            zIndex: 10
        }}>
            <Paper
                radius="xl"
                withBorder
                p="xs"
                className={styles.paperContainer}
            >
                <Group align="flex-end" wrap="nowrap" gap="xs">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.currentTarget.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={UI_TEXT.inputPlaceholder}
                        autosize
                        minRows={1}
                        maxRows={5}
                        variant="unstyled"
                        style={{
                            flex: 1,
                            paddingLeft: '12px',
                            paddingRight: '4px'
                        }}
                        styles={{
                            input: {
                                fontSize: '14px',
                                color: '#1e293b',
                                lineHeight: '1.5',
                                '&::placeholder': {
                                    color: '#94a3b8'
                                }
                            }
                        }}
                    />

                    {loading ? (
                        <Tooltip label={UI_TEXT.stopGeneratingTooltip} position="top">
                            <ActionIcon
                                size="36px"
                                radius="xl"
                                color="red"
                                variant="filled"
                                onClick={onStop}
                                style={{
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                                    flexShrink: 0
                                }}
                            >
                                <FiSquare size={16} />
                            </ActionIcon>
                        </Tooltip>
                    ) : (
                        <ActionIcon
                            size="36px"
                            radius="xl"
                            color="indigo"
                            variant="filled"
                            onClick={onSend}
                            disabled={!input.trim()}
                            style={{
                                background: input.trim() ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : '#e2e8f0',
                                boxShadow: input.trim() ? '0 4px 12px rgba(79, 70, 229, 0.25)' : 'none',
                                cursor: input.trim() ? 'pointer' : 'not-allowed',
                                flexShrink: 0
                            }}
                        >
                            <FiSend size={16} />
                        </ActionIcon>
                    )}
                </Group>
            </Paper>

            <Text size="10px" c="dimmed" style={{ textAlign: 'center', marginTop: '6px', opacity: 0.7 }}>
                {UI_TEXT.disclaimer}
            </Text>
        </Box>
    );
}
