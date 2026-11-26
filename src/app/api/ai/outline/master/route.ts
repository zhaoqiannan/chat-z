// API: AI 一键生成 / 反推项目总纲思维导图树
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters, outlines, characters, worldRules } from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";

function normalizeTreeNode(node: any, pathId: string): any {
  const childrenRaw = Array.isArray(node?.children) ? node.children : [];
  return {
    id: node?.id ? String(node.id) : pathId,
    title: String(node?.title || "未命名节点").trim(),
    tag: node?.tag ? String(node.tag).trim() : "",
    note: node?.note ? String(node.note).trim() : "",
    chapterRange: node?.chapterRange ? String(node.chapterRange).trim() : "",
    status: ["planned", "in_progress", "completed"].includes(node?.status) ? node.status : "planned",
    children: childrenRaw.map((child: any, idx: number) => normalizeTreeNode(child, `${pathId}-${idx + 1}`)),
  };
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const extraPrompt = String(body.prompt || "").trim();

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    const [chapterList, outlineList, charList, ruleList] = await Promise.all([
      db
        .select({ chapterNumber: chapters.chapterNumber, title: chapters.title, summary: chapters.summary, isVolume: chapters.isVolume, status: chapters.status })
        .from(chapters)
        .where(eq(chapters.workId, workId))
        .orderBy(asc(chapters.chapterNumber))
        .limit(40)
        .all(),
      db
        .select({ title: outlines.title, event: outlines.event, twist: outlines.twist, category: outlines.category, chapterNumber: outlines.chapterNumber })
        .from(outlines)
        .where(eq(outlines.workId, workId))
        .orderBy(asc(outlines.chapterNumber), asc(outlines.orderIndex))
        .limit(30)
        .all(),
      db.select({ name: characters.name, identity: characters.identity, personality: characters.personality }).from(characters).where(eq(characters.workId, workId)).limit(8).all(),
      db.select({ name: worldRules.name, mechanisms: worldRules.mechanisms }).from(worldRules).where(eq(worldRules.workId, workId)).limit(5).all(),
    ]);

    const normalChapters = chapterList.filter((c) => !c.isVolume);
    const maxWrittenChapter = normalChapters.reduce((max, c) => Math.max(max, Number(c.chapterNumber) || 0), 0);
    const expectedChapters = work.expectedChapters || 100;

    let context = `书名：《${work.title}》\n题材：${work.tag || "通用小说"}\n目标字数：${work.expectedWords || 500000} 字\n预计章节：${expectedChapters} 章（当前已有至第 ${maxWrittenChapter} 章）\n简介：${work.description || "暂无简介"}\n`;

    if (charList.length > 0) {
      context += `\n【主要角色】：${charList.map((c) => `${c.name}(${c.identity || ""}/${c.personality || ""})`).join("；")}\n`;
    }
    if (ruleList.length > 0) {
      context += `\n【世界规则】：${ruleList.map((r) => `${r.name}(${(r.mechanisms || "").slice(0, 60)})`).join("；")}\n`;
    }
    if (normalChapters.length > 0) {
      const chText = normalChapters
        .slice(0, 25)
        .map((c) => `第${c.chapterNumber}章 ${c.title}${c.summary ? `：${c.summary.slice(0, 60)}` : ""}`)
        .join("\n");
      if (chText) context += `\n【已有章节列表】：\n${chText}\n`;
    }
    if (outlineList.length > 0) {
      const sortedOutlines = [
        ...outlineList.filter((o) => o.category === "chapter"),
        ...outlineList.filter((o) => o.category !== "chapter"),
      ];
      const olText = sortedOutlines
        .slice(0, 15)
        .map((o) => `- ${o.title}${o.event ? `：${o.event.slice(0, 60)}` : ""}`)
        .join("\n");
      if (olText) context += `\n【已有章节大纲卡片】：\n${olText}\n`;
    }

    const systemPrompt = `你是一位资深小说总编剧。请根据作品信息（以及已有章节/角色/世界观），构建一棵清晰、简洁、可直接用于思维导图与表格视图的【项目总纲树】。
结构规范：
- 根节点为整部作品（id 固定为 "root"）
- 一级子节点为 3~5 个核心宏观阶段/分卷/故事线，各分卷的 chapterRange 必须首尾衔接并合理覆盖全书预计章节（1-${expectedChapters}）
- 每个一级节点下拆解 2~4 个关键剧情节点或伏笔节点，其 chapterRange 落在所属分卷范围内
- 已有章节覆盖到的阶段（第 1~${maxWrittenChapter} 章）status 标为 "completed" 或 "in_progress"，未写阶段标为 "planned"
- 仅输出合法 JSON 对象，严禁输出 Markdown 代码块或任何多余说明：
{
  "id": "root",
  "title": "<作品书名>",
  "tag": "总纲",
  "note": "<一句话核心主旨与终极目标>",
  "status": "in_progress",
  "children": [
    {
      "id": "v1",
      "title": "<第一卷 · 卷名>",
      "tag": "主线",
      "note": "<本阶段核心矛盾与收束目标>",
      "chapterRange": "<如起止章号，按全书预计章数动态分配>",
      "status": "in_progress",
      "children": [
        {
          "id": "v1-1",
          "title": "<关键情节点名称>",
          "tag": "高潮 | 铺垫 | 转折 | 伏笔",
          "note": "<具体推进要点与人物变化>",
          "chapterRange": "<落在所属分卷内的起止章号>",
          "status": "planned",
          "children": []
        }
      ]
    }
  ]
}`;

    const userPrompt = `${context}${extraPrompt ? `\n【作者补充构想】：${extraPrompt}` : ""}\n\n请直接输出项目总纲树 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const isValidTree = (obj: any) => Boolean(obj && typeof obj === "object" && Array.isArray(obj.children) && obj.children.length > 0);

    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.5,
      maxTokens: 6144,
    });

    let parsed = parseStructuredJson<any>(raw, null);
    if (!isValidTree(parsed)) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.45,
          maxTokens: 5120,
        });
        const retryParsed = parseStructuredJson<any>(retryRaw, null);
        if (isValidTree(retryParsed)) parsed = retryParsed;
      } catch {}
    }

    if (!isValidTree(parsed)) {
      return NextResponse.json({ success: false, message: "AI 生成项目总纲失败，请重试" }, { status: 500 });
    }

    const normalized = normalizeTreeNode({ ...parsed, id: "root", title: parsed.title || work.title }, "root");

    return NextResponse.json({
      success: true,
      result: { tree: normalized },
      message: "AI 项目总纲生成成功",
    });
  } catch (error: any) {
    console.error("[API /api/ai/outline/master] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "生成项目总纲异常" }, { status: 500 });
  }
});
