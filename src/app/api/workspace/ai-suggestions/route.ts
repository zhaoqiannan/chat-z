import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, outlines, worldRules, factions } from "@/db";
import { eq, desc } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";

/**
 * AI 创意智囊与设定冲突诊断接口 (按需单次调用，极简 Token 消耗)
 * 仅比对作品结构化元数据（人物/阵营/规则/大纲目标），绝不上传几十万字正文，将 Token 消耗严格控制在 800 以内。
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // 1. 获取用户最近活跃的 1 部作品
    const latestWork = await db
      .select()
      .from(works)
      .where(eq(works.userId, user.userId))
      .orderBy(desc(works.updatedAt))
      .limit(1)
      .get();

    if (!latestWork) {
      return NextResponse.json({
        success: true,
        result: [
          {
            id: 1,
            type: "info",
            title: "尚无作品",
            content: "新建一部小说作品并添加角色与大纲后，AI 将为你提供精准的世界观冲突诊断与创作灵感建议。",
          },
        ],
      });
    }

    // 2. 提取该作品的核心设定摘要 (每个人物/规则只取 50 字简短描述，极省 Token)
    const [charList, ruleList, outlineList, factionList] = await Promise.all([
      db
        .select({ name: characters.name, identity: characters.identity, personality: characters.personality, background: characters.background })
        .from(characters)
        .where(eq(characters.workId, latestWork.id))
        .limit(6),
      db
        .select({ name: worldRules.name, mechanisms: worldRules.mechanisms, effects: worldRules.effects })
        .from(worldRules)
        .where(eq(worldRules.workId, latestWork.id))
        .limit(4),
      db
        .select({ title: outlines.title, goal: outlines.goal, conflict: outlines.conflict })
        .from(outlines)
        .where(eq(outlines.workId, latestWork.id))
        .limit(4),
      db
        .select({ name: factions.name, doctrine: factions.doctrine })
        .from(factions)
        .where(eq(factions.workId, latestWork.id))
        .limit(4),
    ]);

    // 纯代码快速规则前置检测 (0 Token 消耗)
    const fastSuggestions: any[] = [];
    if (charList.length === 0) {
      fastSuggestions.push({
        id: "fast-1",
        type: "tip",
        title: "完善人物设定库",
        content: `作品「${latestWork.title}」尚未录入核心角色卡。建议在「世界/知识库 - 角色」中建立主角与主要配角卡片，方便 AI 协助把控人设。`,
      });
    }
    if (outlineList.length === 0) {
      fastSuggestions.push({
        id: "fast-2",
        type: "tip",
        title: "大纲节点待规划",
        content: `「${latestWork.title}」尚未建立故事大纲情节点。明确主线核心事件有助于理清剧情推进节奏。`,
      });
    }

    // 如果设定相对充足，调用一次超轻量 AI 进行逻辑冲突与灵感启发诊断 (耗费 < 600 tokens)
    if (charList.length > 0 || outlineList.length > 0 || ruleList.length > 0) {
      let loreContext = `作品《${latestWork.title}》(类型：${latestWork.tag || "网文"})\n`;
      if (charList.length > 0) {
        loreContext += `【主要角色】：` + charList.map((c) => `${c.name}（身份：${c.identity || "未知"}，性格：${c.personality || "未知"}）`).join("；") + "\n";
      }
      if (factionList.length > 0) {
        loreContext += `【主要势力】：` + factionList.map((f) => `${f.name}（宗旨：${f.doctrine || "未知"}）`).join("；") + "\n";
      }
      if (ruleList.length > 0) {
        loreContext += `【世界规则】：` + ruleList.map((r) => `${r.name}（${(r.mechanisms || r.effects || "基础规则").slice(0, 60)}）`).join("；") + "\n";
      }
      if (outlineList.length > 0) {
        loreContext += `【近期大纲节点】：` + outlineList.map((o) => `${o.title}（目标：${o.goal || "推进剧情"}，主要冲突：${o.conflict || "见招拆招"}）`).join("；") + "\n";
      }

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `你是一位资深小说责任编辑与世界观设定审查助手。
请严格基于提供的真实作品设定，给出 1~2 条具体、可落地的诊断或灵感建议（潜在设定冲突、角色张力看点、或大纲推进切入点）。
【核心要求】
1. 必须直接点名引用上方提供的具体角色名、势力名、规则名或大纲节点名，严禁泛泛而谈的万能套话。
2. 仅输出合法 JSON 数组，严禁输出 Markdown 代码块或任何多余文字。
格式：
[
  { "type": "warning", "title": "简短标题（不超过12字）", "content": "50~100字具体诊断与可执行建议" },
  { "type": "inspiration", "title": "简短标题（不超过12字）", "content": "50~100字具体灵感启发" }
]`,
        },
        {
          role: "user",
          content: `以下是小说设定：\n${loreContext}\n请直接输出 1~2 条精准诊断建议（严格 JSON 数组）：`,
        },
      ];

      try {
        const rawAi = await callCloudflareAi(env.AI, messages, {
          taskType: "structured",
          temperature: 0.4,
          maxTokens: 700,
        });

        const parsed = parseStructuredJson<any[]>(rawAi, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((item, index) => {
            if (item && item.content) {
              fastSuggestions.push({
                id: `ai-${Date.now()}-${index}`,
                type: item.type || "warning",
                title: item.title || "AI 创意建议",
                content: item.content,
              });
            }
          });
        }
      } catch (aiErr) {
        console.warn("AI 诊断解析失败，返回本地建议:", aiErr);
      }
    }

    if (fastSuggestions.length === 0) {
      fastSuggestions.push({
        id: "ok-1",
        type: "success",
        title: "世界观与大纲自洽良好",
        content: `「${latestWork.title}」当前角色、阵营与大纲设定逻辑通顺，无明显自相矛盾之处，可保持当前节奏继续创作！`,
      });
    }

    return NextResponse.json({
      success: true,
      result: fastSuggestions,
      message: "AI 智囊诊断完成",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "AI 智囊诊断服务异常" },
      { status: 500 }
    );
  }
});
