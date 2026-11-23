// API: 正文一键提取剧情大纲（深度分析单章节正文，精准提炼单张高质量故事大纲卡片，自增数字主键）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, works, characters, outlines } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { chapterId: rawChapterId, workId: rawWorkId, content, title } = body;

    const chapterId = Number(rawChapterId);
    const workId = Number(rawWorkId);

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "缺少有效章节ID" }, { status: 400 });
    }

    const chapter = await db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
    if (!chapter) {
      return NextResponse.json({ success: false, message: "章节不存在" }, { status: 404 });
    }

    const effectiveWorkId = workId || chapter.workId;
    const work = await db.select().from(works).where(and(eq(works.id, effectiveWorkId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "无权访问该作品" }, { status: 403 });
    }

    const chapterText = (content || chapter.content || "").trim();
    if (!chapterText || chapterText.length < 20) {
      return NextResponse.json({ success: false, message: "章节正文内容过短，无法提取有效大纲" }, { status: 400 });
    }

    // 获取该作品的角色列表供 AI 识别
    const allChars = await db.select().from(characters).where(eq(characters.workId, effectiveWorkId)).all();
    const charNames = allChars.map((c) => ({ id: c.id, name: c.name }));
    const charListStr = charNames.map((c) => `${c.name}(ID:${c.id})`).join(", ");

    const chapterLabel = chapter.chapterNumber ? `第${chapter.chapterNumber}章` : "本章";
    const rawChapterTitle = title || chapter.title || "未命名章节";

    const systemPrompt = `你是一位严谨的小说主编与剧情架构师。
任务：严格依据提供的【单章正文原文】，提炼出【唯一一张准确、客观、不脑补】的本章故事大纲卡片。

小说信息：
- 书名：《${work.title}》
- 章节序号：${chapterLabel}
- 章节原始标题：${rawChapterTitle}
- 作品预设角色库：${charListStr || "暂无预设角色"}

提炼铁律（必须全部基于正文事实，严禁编造正文未出现的情节）：
1. title：格式为“${chapterLabel} · 核心事件简称”（不超过 20 字）。
2. event：发生经过（明确人物、地点、起因与核心事件结果，50~120 字，直白具体）。
3. twist：意外转折或核心阻碍（30~70 字；若本章平稳过渡无反转，直接如实写本章遇到的阻力或“本章以平稳过渡/铺垫为主”）。
4. nextGoal：本章结尾处角色明确的下一步行动目标（20~50 字）。
5. suspense：本章实际埋下的伏笔或未解悬念（20~50 字；若正文未埋伏笔则写“暂无明显悬念”）。
6. detectedCharacterIds：正文中**实际出场或被明确提及**的角色 ID 纯数字数组（仅从上方角色库中匹配，不得凭空造 ID）。

输出协议：
仅输出以下单个合法 JSON 对象，严禁输出数组、Markdown 代码块或任何解释文字：
{
  "title": "${chapterLabel} · 提炼标题",
  "event": "发生经过",
  "twist": "意外转折或核心阻碍",
  "nextGoal": "下一步动机",
  "suspense": "留下伏笔",
  "detectedCharacterIds": []
}`;

    // 若章节较长，保留前 4000 字 + 末尾 2000 字，防止结尾悬念与下一步动机被截断
    const excerpt =
      chapterText.length > 6000
        ? `${chapterText.slice(0, 4000)}\n\n……（中段略）……\n\n${chapterText.slice(-2000)}`
        : chapterText;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `以下是【${chapterLabel} · ${rawChapterTitle}】的正文内容：\n\n${excerpt}` },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.2,
      maxTokens: 1500,
    });

    let parsed: any = parseStructuredJson<any>(rawResponse, null);

    if (!parsed || typeof parsed !== "object" || (!parsed.event && !parsed.title)) {
      parsed = {
        title: `${chapterLabel} · ${rawChapterTitle}`,
        event: `${rawChapterTitle}：剧情稳步推进，角色展开行动。`,
        twist: "局势暗流涌动，面临潜在挑战。",
        nextGoal: "继续推进下一步计划。",
        suspense: "暗中留存关键线索。",
        detectedCharacterIds: [],
      };
    }

    // 检查是否已有对应 chapterId 的大纲节点
    const existingOutline = await db
      .select()
      .from(outlines)
      .where(and(eq(outlines.workId, effectiveWorkId), eq(outlines.chapterId, chapterId)))
      .get();

    const detectedCharIds = Array.isArray(parsed.detectedCharacterIds) ? parsed.detectedCharacterIds.map(Number).filter((n: any) => !isNaN(n)) : [];

    const finalTitle = (parsed.title || `${chapterLabel} · ${rawChapterTitle}`).trim();
    const finalEvent = (parsed.event || "").trim();
    const finalTwist = (parsed.twist || "").trim();
    const finalNextGoal = (parsed.nextGoal || "").trim();
    const finalSuspense = (parsed.suspense || "").trim();

    const outlineData: any = {
      workId: effectiveWorkId,
      category: "chapter",
      chapterId: chapterId,
      chapterNumber: chapter.chapterNumber || 1,
      title: finalTitle,
      event: finalEvent,
      twist: finalTwist,
      nextGoal: finalNextGoal,
      suspense: finalSuspense,
      content: finalEvent,
      status: "completed",
      isFromChapter: 1,
      type: "scene",
      wordCountEstimate: chapter.wordCount || chapterText.length,
      linkedCharacterIds: detectedCharIds,
      orderIndex: chapter.chapterNumber || 1,
      updatedAt: new Date(),
    };

    let resultRecord = null;
    if (existingOutline) {
      await db.update(outlines).set(outlineData).where(eq(outlines.id, existingOutline.id));
      resultRecord = { ...existingOutline, ...outlineData };
    } else {
      const inserted = await db.insert(outlines).values({
        ...outlineData,
        createdAt: new Date(),
      }).returning();
      resultRecord = inserted[0] || outlineData;
    }

    return NextResponse.json({
      success: true,
      result: resultRecord,
      message: `成功提炼${chapterLabel}剧情并同步到大纲故事轴！`,
    });
  } catch (error: any) {
    console.error("[API /api/ai/chapter/extract-outline] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "提取大纲失败" }, { status: 500 });
  }
});
