// API: 正文一键提取剧情大纲（深度分析单章节正文，精准提炼单张高质量故事大纲卡片，自增数字主键）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, works, characters, outlines } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

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

    const systemPrompt = `你是一位顶级小说主编与大纲架构师。
你的任务是：通读作者提供的【单个章节正文】，精准浓缩出【唯一一张清晰、完整、高信息量】的本章故事大纲卡片。

小说信息：
- 书名：《${work.title}》
- 章节序号：${chapterLabel}
- 章节原始标题：${rawChapterTitle}
- 作品预设角色库：${charListStr || "暂无预设角色"}

提炼规范（请用清晰自然的通俗大白话表述，严禁空话套话）：
1. title: 章节提炼标题（格式如：“${chapterLabel} · 核心事件简称”，如：“${chapterLabel} · 药铺遇伏与假死脱身”）
2. event: 📍 发生经过（清晰表述：在什么场景下，主要人物做了什么，发生了怎样的核心事件脉络，50-100字）
3. twist: ⚡ 意外转折（清晰表述：发生了什么意料之外的阻碍、突发危险、反转或矛盾激化，30-60字；若本章平稳则写面临的核心阻碍）
4. nextGoal: 🎯 下一步动机（清晰表述：本章结束时主角或关键人物下一步的具体行动目标与打算，20-40字）
5. suspense: 🕳️ 留下伏笔（清晰表述：本章埋下的新线索、悬念或未解之谜，20-40字；若无明显伏笔写“暂无重大悬念”）
6. detectedCharacterIds: 本章正文中实际出场的角色 ID 数组（从可选角色库匹配，纯数字数组）

请严格输出为以下 JSON 格式：
{
  "title": "${chapterLabel} · 提炼标题",
  "event": "清晰具体的发生经过说明",
  "twist": "清晰具体的意外转折说明",
  "nextGoal": "清晰具体的下一步动机说明",
  "suspense": "清晰具体的留下伏笔说明",
  "detectedCharacterIds": []
}
注意：只输出上述单个 JSON 对象，严禁输出多条卡片数组，严禁包含 Markdown 代码块标记。`;

    const excerpt = chapterText.slice(0, 4500);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `以下是【${chapterLabel} · ${rawChapterTitle}】的正文内容：\n\n${excerpt}` },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.3,
      maxTokens: 1200,
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

    if (!parsed) {
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
      chapterId: chapterId,
      chapterNumber: chapter.chapterNumber || 1,
      title: finalTitle,
      event: finalEvent,
      twist: finalTwist,
      nextGoal: finalNextGoal,
      suspense: finalSuspense,
      content: `${finalEvent}\n转折: ${finalTwist}\n下一步: ${finalNextGoal}\n伏笔: ${finalSuspense}`,
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
