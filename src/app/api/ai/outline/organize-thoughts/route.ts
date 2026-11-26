// API: AI 零散思路与剧情点时空逻辑智能整理引擎
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, notes, worldRules } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";

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
            .map((n) => `【参考笔记: ${n.title}】:\n${(n.content || "").trim().slice(0, 800)}`)
            .join("\n\n")
            .slice(0, 2400);
        }
      }
    }

    // 关联基础世界规则
    const rulesList = await db.select().from(worldRules).where(eq(worldRules.workId, workId)).limit(4).all();
    const ruleContext = rulesList.length > 0
      ? rulesList.map((r) => `【${r.name}】: ${(r.mechanisms || r.description || "").slice(0, 100)}`).join("\n")
      : "";

    const thoughtListStr = validThoughts
      .map((t: string, idx: number) => `[灵感碎片 ${idx + 1}]: ${t}`)
      .join("\n");

    const systemPrompt = `你是一位严谨的小说大纲总监与叙事逻辑架构师。
你的核心任务是：完整保留并吸收作者提供的每一条零散灵感碎片，按【时间先后、空间流转、人物动机因果】将其重构为逻辑严密的二级树状大纲。

【整理规则】：
1. 必须将作者提供的每一条灵感碎片都落实到具体的子节点中，严禁遗漏或篡改原意。
2. 归纳出 2~4 个宏观阶段作为一级节点，每个一级节点下拆解 1~3 个具体二级子情节点，并补齐必要的因果过渡。
3. 每个节点的 content 必须写出具体人物、场景与事件经过，严禁空洞套话。

【输出协议】：
仅输出以下合法 JSON 对象，严禁输出 Markdown 代码块或任何多余文字：
{
  "title": "<本次思路整理总标题>",
  "summary": "<一句话梳理核心脉络>",
  "timeframe": "<全局时间跨度>",
  "location": "<核心主场>",
  "tree": [
    {
      "title": "<一级阶段标题>",
      "content": "<该阶段核心局势与目标概述>",
      "timeframe": "<时间线阶段>",
      "location": "<主要地点>",
      "children": [
        {
          "title": "<具体子情节点标题>",
          "content": "<具体的发生经过与人物行动>",
          "timeframe": "<具体时间>",
          "location": "<具体地点>"
        }
      ]
    }
  ]
}`;

    const userMessage = `【作品信息】：《${work.title}》（题材：${work.tag || "通用小说"}）
${work.description ? `【作品简介】：${work.description.slice(0, 260)}\n` : ""}${charContext ? `【参演人物库】：\n${charContext}\n` : ""}${ruleContext ? `【世界观法则】：\n${ruleContext}\n` : ""}${noteContext ? `【参考设定笔记】：\n${noteContext}\n` : ""}
【待整理的零散灵感碎片】：
${thoughtListStr}

请重构整理为时空逻辑自洽的二级树状大纲，直接输出合法 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const isValidTree = (obj: any) => Boolean(obj && Array.isArray(obj.tree) && obj.tree.length > 0);

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.45,
      maxTokens: 4096,
    });

    let parsed: any = parseStructuredJson<any>(rawResponse, null);

    // 首次解析失败切换 fast 通道重试一次，绝不用假模板套壳糊弄
    if (!isValidTree(parsed)) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.4,
          maxTokens: 3584,
        });
        const retryParsed = parseStructuredJson<any>(retryRaw, null);
        if (isValidTree(retryParsed)) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        console.warn("[organize-thoughts] 备选通道重试失败:", retryErr);
      }
    }

    if (!isValidTree(parsed)) {
      return NextResponse.json(
        { success: false, message: "AI 思路整理结果解析失败，请稍后重试" },
        { status: 500 }
      );
    }

    if (!parsed.title) {
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
