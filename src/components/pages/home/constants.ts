import React from 'react';
import { FiCode, FiEdit3, FiBarChart2, FiHelpCircle } from 'react-icons/fi';

export interface TemplateItem {
    title: string;
    description: string;
    prompt: string;
    icon: React.ReactNode;
    color: string;
}

export const TEMPLATES: TemplateItem[] = [
    {
        title: "创意文案写作",
        description: "撰写推文、文章大纲或创意故事内容。",
        prompt: "请帮我写一篇关于 AI 智能体如何改变我们日常工作和生活的创意推文，文字生动有趣。",
        icon: React.createElement(FiEdit3, { size: 20, color: "#ec4899" }),
        color: "pink"
    },
    {
        title: "智能问答技术",
        description: "探讨大语言模型与 AI 智能体的前沿实现。",
        prompt: "详细介绍一下什么是 Agentic AI 智能体，以及它的核心架构和主要优势是什么？",
        icon: React.createElement(FiHelpCircle, { size: 20, color: "#8b5cf6" }),
        color: "violet"
    },
    {
        title: "高效代码编写",
        description: "编写、调试和解释算法与实用工具函数。",
        prompt: "请用 TypeScript 编写一个健壮的防抖（debounce）函数，并用简单的例子说明其原理。",
        icon: React.createElement(FiCode, { size: 20, color: "#3b82f6" }),
        color: "blue"
    },
    {
        title: "数据分析建议",
        description: "提供关于数据清洗、建模与可视化的思路。",
        prompt: "我想对海量的服务器访问日志进行异常检测和可视化分析，可以提供一个完整的实施步骤和常用工具链吗？",
        icon: React.createElement(FiBarChart2, { size: 20, color: "#10b981" }),
        color: "teal"
    }
];

export const UI_TEXT = {
    greetingPrefix: "您好，",
    greetingDefault: "用户",
    aiSubtitle: "我是您的智能 AI 助手 chat-z。今天有什么我可以帮您的？",
    inputPlaceholder: "输入对话内容，按 Enter 发送，Shift + Enter 换行",
    thinkingText: "思考中...",
    disclaimer: "AI 可能会产生偏见或错误信息，请核对重要信息的准确性。",
    stopGeneratingTooltip: "停止生成"
};
