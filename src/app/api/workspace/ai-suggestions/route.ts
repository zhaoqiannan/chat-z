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

    // 2. 提取该作品的核心设定摘要（同步纳入项目总纲树与近期更新的大纲节点）
    const [charList, ruleList, outlineList, factionList, masterRow] = await Promise.all([
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
        .select({ title: outlines.title, goal: outlines.goal, conflict: outlines.conflict, event: outlines.event })
        .from(outlines)
        .where(eq(outlines.workId, latestWork.id))
        .orderBy(desc(outlines.updatedAt))
        .limit(5),
      db
        .select({ name: factions.name, doctrine: factions.doctrine })
        .from(factions)
        .where(eq(factions.workId, latestWork.id))
        .limit(4),
      env.DB.prepare("SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1")
        .bind(latestWork.id, user.userId)
        .first()
        .catch(() => null),
    ]);

    let masterNodesBrief: string[] = [];
    if (masterRow && (masterRow as any).tree_json) {
      try {
        const tree = JSON.parse((masterRow as any).tree_json);
        const children = Array.isArray(tree?.children) ? tree.children : [];
        masterNodesBrief = children
          .slice(0, 5)
          .map((n: any) => `${n.title || "阶段"}${n.note ? `（${String(n.note).slice(0, 45)}）` : ""}`);
      } catch {}
    }

    const hasAnyOutline = outlineList.length > 0 || masterNodesBrief.length > 0;

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
    if (!hasAnyOutline) {
      fastSuggestions.push({
        id: "fast-2",
        type: "tip",
        title: "大纲节点待规划",
        content: `「${latestWork.title}」尚未建立项目总纲或章节大纲。明确主线阶段目标有助于理清剧情推进节奏。`,
      });
    }

    // 如果设定相对充足，调用轻量 AI 进行逻辑冲突与灵感启发诊断
    let aiSucceeded = false;
    if (charList.length > 0 || hasAnyOutline || ruleList.length > 0) {
      let loreContext = `作品《${latestWork.title}》(类型：${latestWork.tag || "通用小说"})\n`;
      if (charList.length > 0) {
        loreContext += `【主要角色】：` + charList.map((c) => `${c.name}（身份：${c.identity || "未知"}，性格：${c.personality || "未知"}）`).join("；") + "\n";
      }
      if (factionList.length > 0) {
        loreContext += `【主要势力】：` + factionList.map((f) => `${f.name}（宗旨：${f.doctrine || "未知"}）`).join("；") + "\n";
      }
      if (ruleList.length > 0) {
        loreContext += `【世界规则】：` + ruleList.map((r) => `${r.name}（${(r.mechanisms || r.effects || "基础规则").slice(0, 60)}）`).join("；") + "\n";
      }
      if (masterNodesBrief.length > 0) {
        loreContext += `【项目总纲阶段】：${masterNodesBrief.join("；")}\n`;
      }
      if (outlineList.length > 0) {
        loreContext += `【近期大纲节点】：` + outlineList.map((o) => `${o.title}（${(o.event || o.goal || "推进剧情").slice(0, 50)}${o.conflict ? ` / 冲突：${o.conflict.slice(0, 30)}` : ""}）`).join("；") + "\n";
      }

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `你是一位资深小说责任编辑与世界观设定审查助手。
请严格基于提供的真实作品设定，给出 1~2 条具体、可落地的诊断或灵感建议（潜在设定冲突、角色张力看点、或大纲推进切入点）。
【核心要求】
1. 必须直接点名引用上方提供的具体角色名、势力名、规则名或大纲节点名，严禁泛泛而谈的万能套话。
2. type 从 "warning"（风险/冲突提醒）、"inspiration"（剧情灵感）、"tip"（结构完善建议）中按实际内容选择，不要强行凑冲突。
3. 仅输出合法 JSON 数组，严禁输出 Markdown 代码块或任何多余文字：
[
  { "type": "warning | inspiration | tip", "title": "<不超过12字标题>", "content": "<50~100字具体诊断与可执行建议>" }
]`,
        },
        {
          role: "user",
          content: `以下是小说设定：\n${loreContext}\n请直接输出 1~2 条精准诊断建议（严格 JSON 数组）：`,
        },
      ];

      const tryFetchSuggestions = async (taskType: "structured" | "fast") => {
        const rawAi = await callCloudflareAi(env.AI, messages, {
          taskType,
          temperature: 0.4,
          maxTokens: 2048,
        });
        const parsed = parseStructuredJson<any[]>(rawAi, []);
        return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.content === "string" && item.content.trim().length >= 10) : [];
      };

      try {
        let validItems = await tryFetchSuggestions("structured");
        if (validItems.length === 0) {
          validItems = await tryFetchSuggestions("fast");
        }
        if (validItems.length > 0) {
          aiSucceeded = true;
          validItems.slice(0, 2).forEach((item, index) => {
            fastSuggestions.push({
              id: `ai-${Date.now()}-${index}`,
              type: ["warning", "inspiration", "tip", "info"].includes(item.type) ? item.type : "inspiration",
              title: String(item.title || "AI 创意建议").trim(),
              content: String(item.content).trim(),
            });
          });
        }
      } catch (aiErr) {
        console.warn("AI 诊断解析失败:", aiErr);
      }
    }

    if (fastSuggestions.length === 0) {
      fastSuggestions.push({
        id: "info-1",
        type: "info",
        title: aiSucceeded ? "暂无明显设定冲突" : "暂未获取到 AI 诊断结果",
        content: aiSucceeded
          ? `「${latestWork.title}」当前录入的核心设定暂未发现明显矛盾，可继续推进章节创作。`
          : `本次未能从 AI 获取有效分析结果，请稍后点击刷新重新诊断。`,
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
