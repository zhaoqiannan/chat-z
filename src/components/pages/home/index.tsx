"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mantine/core';
import { useAppSelector } from '@/store';
import { postChatStream } from '@/rest/chat';

import ChatTemplates from './ChatTemplates';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function HomePage() {
    const user = useAppSelector((state) => state.userInfo);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const viewportRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        if (viewportRef.current) {
            viewportRef.current.scrollTo({
                top: viewportRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, messages[messages.length - 1]?.content]);

    const handleSend = async (textToSend?: string) => {
        const text = (textToSend || input).trim();
        if (!text || loading) return;

        if (!textToSend) {
            setInput('');
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date()
        };

        const assistantMsgId = (Date.now() + 1).toString();
        const assistantMsg: Message = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            await postChatStream(
                { message: text },
                (chunk) => {
                    setMessages(prev => prev.map(msg => {
                        if (msg.id === assistantMsgId) {
                            return { ...msg, content: msg.content + chunk };
                        }
                        return msg;
                    }));
                },
                controller.signal
            );
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log('Stream aborted');
            } else {
                console.error('Stream error:', e);
                setMessages(prev => prev.map(msg => {
                    if (msg.id === assistantMsgId) {
                        return { ...msg, content: msg.content + `\n\n*(错误: ${e.message || '请求失败，请稍后重试'})*` };
                    }
                    return msg;
                }));
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
        }
    };

    return (
        <Box style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 80px)',
            maxWidth: '960px',
            margin: '0 auto',
            position: 'relative',
            overflow: 'hidden'
        }} p={16}>

            {messages.length === 0 ? (
                <ChatTemplates
                    userName={user.name}
                    onSelectPrompt={handleSend}
                />
            ) : (
                <ChatMessageList
                    messages={messages}
                    userName={user.name}
                    viewportRef={viewportRef}
                />
            )}

            <ChatInput
                input={input}
                setInput={setInput}
                loading={loading}
                onSend={() => handleSend()}
                onStop={handleStop}
            />
        </Box>
    );
}
