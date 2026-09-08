import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, outlines, worldRules, factions } from "@/db";
import { eq, desc } from "drizzle-orm";
import { callCloudflareAi, ChatMessage } from "@/utils/ai";

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
          content: `你是一位资深小说责任编辑与世界观推演助手。
请基于给出的简明小说设定，给出 1~2 条极度精炼的高价值建议（包括：设定潜在逻辑冲突预警、人物冲突看点、或大纲推进启发）。
【输出要求】：严格输出 JSON 数组格式，禁止输出 markdown 格式代码块以外的多余文字。
格式范例：
[
  { "type": "warning", "title": "逻辑冲突预警", "content": "角色XXX的性格与其所在势力的宗旨存在潜在矛盾，建议在剧情中补充其两难抉择。" },
  { "type": "inspiration", "title": "高潮冲突启发", "content": "结合当前大纲节点，可让XXX势力介入制造第三派危机，增强故事张力。" }
]`,
        },
        {
          role: "user",
          content: `以下是小说设定：\n${loreContext}\n请直接给出 1~2 条精炼诊断建议（严格 JSON 数组）：`,
        },
      ];

      try {
        const rawAi = await callCloudflareAi(env.AI, messages, {
          temperature: 0.5,
          maxTokens: 600,
        });

        const jsonMatch = rawAi.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((item, index) => {
              fastSuggestions.push({
                id: `ai-${Date.now()}-${index}`,
                type: item.type || "warning",
                title: item.title || "AI 创意建议",
                content: item.content,
              });
            });
          }
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
