import React from 'react';
import { FiFeather, FiUsers, FiGlobe, FiCompass } from 'react-icons/fi';

export interface TemplateItem {
    title: string;
    description: string;
    prompt: string;
    icon: React.ReactNode;
    color: string;
}

export const TEMPLATES: TemplateItem[] = [
    {
        title: "开篇脑洞与钩子",
        description: "构思抓人的黄金三章开局、核心悬念与冲突设计。",
        prompt: "我想写一部东方奇幻长篇，主角表面是落魄账房，暗中却能看见他人命格欠债。请帮我构思 3 个不同风格的黄金三章开篇方案与核心钩子。",
        icon: React.createElement(FiFeather, { size: 20, color: "#00c9ff" }),
        color: "cyan"
    },
    {
        title: "立体人设打磨",
        description: "塑造反差感强、有成长弧光与记忆点的主要角色。",
        prompt: "请帮我设计一名既有压迫感又不脸谱化的反派宗主：给出他的核心执念、表面伪装、致命弱点，以及 3 句极具辨识度的标志性台词。",
        icon: React.createElement(FiUsers, { size: 20, color: "#8b5cf6" }),
        color: "violet"
    },
    {
        title: "世界观法则推演",
        description: "搭建自洽的力量体系、代价规则与势力博弈格局。",
        prompt: "我想设计一套“以记忆为代价施法”的超凡体系，请帮我推演它的等级划分、不可违背的禁忌代价，以及由此衍生出的黑市与权力结构。",
        icon: React.createElement(FiGlobe, { size: 20, color: "#10b981" }),
        color: "teal"
    },
    {
        title: "卡文剧情救急",
        description: "打破情节僵局，推演意料之外、情理之中的剧情转折。",
        prompt: "主角刚潜入敌方宝库拿到关键密信，却发现守卫提前换防被堵在密室里。如何不靠机械降神，用智斗和前期伏笔破局？请给 3 个方向。",
        icon: React.createElement(FiCompass, { size: 20, color: "#f59e0b" }),
        color: "orange"
    }
];

export const UI_TEXT = {
    greetingPrefix: "您好，",
    greetingDefault: "作家",
    aiSubtitle: "我是您的网文与小说创作 AI 搭档 chat-z，随时帮您聊灵感、磨人设、破卡文。",
    inputPlaceholder: "输入创作问题或灵感片段，按 Enter 发送，Shift + Enter 换行",
    thinkingText: "构思推演中...",
    disclaimer: "AI 建议仅供创作参考，您可以随时前往「作品管理」进入完整创作工作台。",
    stopGeneratingTooltip: "停止生成"
};
