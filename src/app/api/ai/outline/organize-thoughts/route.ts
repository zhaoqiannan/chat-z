// API: AI 零散思路与剧情点时空逻辑智能整理引擎
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, notes, worldRules } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      thoughts = [],
      selectedCharacterIds = [],
      selectedNoteIds = [],
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    const validThoughts = Array.isArray(thoughts)
      ? thoughts.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0)
      : [];

    if (validThoughts.length === 0) {
      return NextResponse.json({ success: false, message: "请至少输入一个灵感或剧情点" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    // 关联人物
    let charContext = "";
    if (Array.isArray(selectedCharacterIds) && selectedCharacterIds.length > 0) {
      const numIds = selectedCharacterIds.map(Number).filter((n) => !isNaN(n));
      if (numIds.length > 0) {
        const chars = await db.select().from(characters).where(and(eq(characters.workId, workId), inArray(characters.id, numIds))).all();
        if (chars.length > 0) {
          charContext = chars
            .map((c) => `【${c.name}】(${c.roleType || "主要人物"}): 身份/标签: [${c.identity || ""}, ${c.tags || ""}] | 性格: ${c.personality || "未详"}`)
            .join("\n");
        }
      }
    }

    // 关联笔记
    let noteContext = "";
    if (Array.isArray(selectedNoteIds) && selectedNoteIds.length > 0) {
      const numIds = selectedNoteIds.map(Number).filter((n) => !isNaN(n));
      if (numIds.length > 0) {
        const foundNotes = await db.select().from(notes).where(and(eq(notes.workId, workId), inArray(notes.id, numIds))).all();
        if (foundNotes.length > 0) {
          noteContext = foundNotes
            .map((n) => `【参考笔记: ${n.title}】:\n${n.content}`)
            .join("\n\n");
        }
      }
    }

    const thoughtListStr = validThoughts
      .map((t: string, idx: number) => `[灵感碎片 ${idx + 1}]: ${t}`)
      .join("\n");

    const systemPrompt = `你是一位顶级小说大纲总监与叙事逻辑架构师。
作者向你提供了一组零散、无序的【剧情点与灵感碎片】。
你的核心任务是：深入分析这些灵感之间的内在联系，从【时间先后推进、空间/地点流转、人物动机因果承接】等维度，将它们重构成一个【逻辑严密、层级清晰的树状大纲体系】。

作品信息：
- 书名：《${work.title}》
- 题材：${work.tag || "通用故事"}

参演人物库：
${charContext || "通用主角与配角"}

参考设定：
${noteContext || "暂无特定设定"}

整理规则：
1. 梳理出 2-4 个主要宏观阶段/母题（作为一级父节点，例如：起因篇章、发酵对峙、高潮转折、收尾余波）；
2. 在每个一级节点下，归纳拆解出具体的 1-3 个子情节点（作为二级子节点），将作者的零散点子严密镶嵌进去，并补充合理的过渡动作；
3. 输出的每个节点需包含具体清晰的叙述，避免空洞模版套话。

请严格输出为以下 JSON 格式：
{
  "title": "本次思路整理总标题（简明有力，如：商会晚宴逆袭与专利反制）",
  "summary": "一句话梳理总括（说明本次整理的核心脉络，如：从最初的误会起因，经多方周旋，最终在商会彻底反转）",
  "timeframe": "全局时间跨度（如：三天内 / 跨越二十年）",
  "location": "核心主场（如：展厅、商会大厦）",
  "tree": [
    {
      "title": "一级阶段标题（如：第一幕 · 风波骤起与线索浮现）",
      "content": "该宏观阶段的核心局势与主要目标概述...",
      "timeframe": "时间线阶段（如：前三天 / 当天上午）",
      "location": "主要发生地点（如：展厅 / 茶楼）",
      "children": [
        {
          "title": "具体子情节点标题（如：展厅当众质询）",
          "content": "具体的发生经过与人物行动叙述...",
          "timeframe": "具体时间",
          "location": "具体地点"
        }
      ]
    }
  ]
}
注意：只输出纯合法 JSON，严禁输出任何 Markdown 标记或多余文字。`;

    const userMessage = `以下是作者输入的零散灵感点子列表，请重构整理为时空逻辑自洽的树级大纲：\n\n${thoughtListStr}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.7,
      maxTokens: 3500,
    });

    const cleaned = cleanNovelStoryText(rawResponse);
    let parsed: any = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (__) {}
      }
    }

    if (!parsed || !Array.isArray(parsed.tree) || parsed.tree.length === 0) {
      // 动态兜底根据输入的灵感碎片进行结构化组织
      const fallbackTitle = `思路整理：${validThoughts[0].slice(0, 16)}${validThoughts[0].length > 16 ? "..." : ""}`;
      parsed = {
        title: fallbackTitle,
        summary: `围绕输入的 ${validThoughts.length} 个灵感点完成时空逻辑梳理与递进建构`,
        timeframe: "故事主线周期",
        location: "主故事舞台",
        tree: validThoughts.map((t: string, idx: number) => ({
          title: `阶段 ${idx + 1} · 灵感推进`,
          content: t,
          timeframe: `阶段 ${idx + 1}`,
          location: "待定场景",
          children: [
            {
              title: `情节点 ${idx + 1}.1`,
              content: `围绕【${t}】展开具体行动与情境互动。`,
              timeframe: "即时",
              location: "核心现场",
            },
          ],
        })),
      };
    } else if (!parsed.title) {
      parsed.title = `思路整理：${validThoughts[0].slice(0, 16)}${validThoughts[0].length > 16 ? "..." : ""}`;
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      message: "AI 思路整理完成",
    });
  } catch (error: any) {
    console.error("[API /api/ai/outline/organize-thoughts] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "整理思路失败" }, { status: 500 });
  }
});
