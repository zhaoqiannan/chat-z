export const projectOverviewMockData = {
  id: "1",
  title: "星际迷途",
  tag: "科幻",
  status: "写作中",
  summary:
    "一段跨越星系的冒险故事，探索人类文明的边界与希望。在寂静宇宙中寻找最初的港湾与终极的真相。",
  stats: {
    totalWords: "48,320",
    chapterProgress: "12 / 20 章",
    coreCharacters: "8 个设定",
    outlineProgress: "65%",
  },
  actProgress: [
    { name: "第一幕：启程", status: "已完成", color: "#10b981", percent: 100 },
    { name: "第二幕：试炼", status: "写作中", color: "#00c9ff", percent: 60 },
    { name: "第三幕：回归", status: "未开始", color: "#cbd5e1", percent: 0 },
  ],
  recentChapters: [
    {
      id: 10,
      index: "第十章",
      title: "曙光乍现",
      status: "已完成",
      wordCount: "3,500字",
      time: "5天前",
    },
    {
      id: 11,
      index: "第十一章",
      title: "深渊凝视",
      status: "已完成",
      wordCount: "4,200字",
      time: "3天前",
    },
    {
      id: 12,
      index: "第十二章",
      title: "黎明之前",
      status: "写作中",
      wordCount: "2,120字",
      time: "2小时前",
    },
    {
      id: 13,
      index: "第十三章",
      title: "未命名的远航",
      status: "未开始",
      wordCount: "0字",
      time: "未编辑",
    },
    {
      id: 14,
      index: "第十四章",
      title: "群星尽头",
      status: "未开始",
      wordCount: "0字",
      time: "未编辑",
    },
  ],
  aiSuggestions: [
    {
      id: 1,
      type: "warning",
      tagColor: "#f59e0b",
      title: "第十一章角色动机不一致",
      content:
        "林晓月在会议上的妥协态度与此前明表出现的坚定立场不符，建议补充心理变化描写。",
    },
    {
      id: 2,
      type: "warning",
      tagColor: "#f59e0b",
      title: "「林晓月」背景描述与第三章矛盾",
      content:
        "此章节提及她曾在联邦军事学院就读，但第三章设定其出身为边缘矿区抵抗军反抗组织。",
    },
    {
      id: 3,
      type: "tip",
      tagColor: "#00c9ff",
      title: "建议为第二幕添加转折点",
      content:
        "分析故事线走势，第二幕中段缺少决定性的外部危机，引入一次船体故障或跃迁信标干扰能更好凝聚张力。",
    },
  ],
  recentLores: [
    { id: 1, name: "林晓月", desc: "核心角色" },
    { id: 2, name: "银河联邦", desc: "世界设定" },
    { id: 3, name: "曙光号飞船", desc: "核心道具" },
    { id: 4, name: "曲率引擎协议", desc: "科技规则" },
  ],
  memos: [
    {
      id: 1,
      title: "关于第十五章星际跃迁的物理约...",
      time: "1小时前",
      content: "跃迁并非瞬间，需要24小时预热，产生强磁偏转...",
    },
    {
      id: 2,
      title: "林晓月与舰长的冲突张力线拟定",
      time: "昨天",
      content: "主题是关于边缘星域难民的救援分歧...",
    },
  ],
};
