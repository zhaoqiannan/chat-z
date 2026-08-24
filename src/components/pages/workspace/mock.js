export const workspaceMockData = {
    // 欢迎语信息
    welcome: {
        title: "欢迎回来，作家",
        subtitle: "今天是 2026年3月30日 · 灵感不断，落笔成章",
    },

    // 最近编辑章节
    recentChapter: {
        novelTitle: "星际迷途",
        chapterTitle: "第十二章 · 黎明之前",
        wordCount: "48,320",
        progressDesc: "已写 48,320 字 · 故事第二幕即将收尾",
    },

    // 我的作品列表
    worksList: [
        {
            id: 1,
            title: "星际迷途",
            tag: "科幻",
            wordCount: "48,320",
            chapterCount: 12,
            progress: 65,
            lastEditTime: "2小时前",
        },
    ],

    // 创作统计
    creationStats: [
        {
            id: "week",
            label: "本周写作",
            value: "8,420",
            unit: "字",
            color: "#00c9ff",
        },
        {
            id: "today",
            label: "今日写作",
            value: "1,240",
            unit: "字",
            color: "#10b981",
        },
        {
            id: "streak",
            label: "连续写作",
            value: "7",
            unit: "天",
            color: "#f59e0b",
        },
        {
            id: "total",
            label: "总字数",
            value: "84,220",
            unit: "字",
            color: "#1e293b",
        },
    ],

    // AI 创意智囊建议
    aiSuggestions: [
        {
            id: 1,
            type: "warning",
            title: "逻辑不一致警示",
            content: "「星际迷途」第十一章中，角色「林晓月」的背景叙述与第三章设定的立场产生冲突，请核对大纲。",
        },
    ],

    // 近期动态
    recentActivities: [
        {
            id: 1,
            title: "编辑了「星际迷途」第十二章",
            time: "10分钟前",
            description: "增加了 850 字，主要完成高潮前夕的对峙描写。",
        },
        {
            id: 2,
            title: "创建了角色「林晓月」",
            time: "2小时前",
            description: "设定为「曙光号」副舰长，擅长星际领航与心理学。",
        },
        {
            id: 3,
            title: "AI 完成了情节分析",
            time: "昨天",
            description: "已扫描第十一章，检测到情感推进偏快，建议补充过渡细节。",
        },
        {
            id: 4,
            title: "更新了设定「银河联邦」",
            time: "3天前",
            description: "修正了联邦议会席位分配规则，涉及第二章的历史提及。",
        },
    ],
};
