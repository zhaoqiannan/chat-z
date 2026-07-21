import React from 'react';
import { FiCpu, FiCompass, FiPieChart, FiZap } from 'react-icons/fi';

export interface TemplateItem {
    title: string;
    description: string;
    prompt: string;
    icon: React.ReactNode;
    color: string;
}

export const TEMPLATES: TemplateItem[] = [
    {
        title: "分析排污数据",
        description: "深入解析当前排污监管指标与异常排污源定位。",
        prompt: "请帮我分析最近的排污异常监测数据，并给出潜在的合规风险建议。",
        icon: React.createElement(FiPieChart, { size: 20, color: "#3b82f6" }),
        color: "blue"
    },
    {
        title: "智能问答技术",
        description: "探讨前沿大语言模型与 Agentic 智能体的实现。",
        prompt: "详细介绍一下什么是 Agentic AI 智能体，以及它的核心优势是什么？",
        icon: React.createElement(FiCpu, { size: 20, color: "#8b5cf6" }),
        color: "violet"
    },
    {
        title: "合规建议查询",
        description: "查询并评估环境法规相关的合规与准入要求。",
        prompt: "请问当前最新的工业废水排污标准有哪些关键变化？",
        icon: React.createElement(FiCompass, { size: 20, color: "#10b981" }),
        color: "teal"
    },
    {
        title: "快速代码编写",
        description: "编写一个能够处理数据过滤与汇总的 JS 脚本。",
        prompt: "请用 JavaScript 写一个函数，对一组排污监测点的数据进行平均值计算和超标警报过滤。",
        icon: React.createElement(FiZap, { size: 20, color: "#f59e0b" }),
        color: "amber"
    }
];

export const UI_TEXT = {
    greetingPrefix: "您好，",
    greetingDefault: "研究员",
    aiSubtitle: "我是您的 AI 助手。今天我可以为您提供哪些有关排污监控、环保合规或代码分析的支持？",
    inputPlaceholder: "输入对话内容，按 Enter 发送，Shift + Enter 换行",
    thinkingText: "思考中...",
    disclaimer: "AI 可能会产生偏见或错误信息，请核对重要监测数据的准确性。",
    stopGeneratingTooltip: "停止生成"
};
