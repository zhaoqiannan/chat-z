// API: 正文一键提取剧情大纲（精准提炼单章核心剧情链，严禁空洞占位兜底，提取成功后标记 chapters.outline_extracted = 1）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, works, characters, outlines } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";

async function ensureChapterOutlineExtractedColumn(envDb: any) {
  try {
    await envDb.prepare("ALTER TABLE chapters ADD COLUMN outline_extracted INTEGER DEFAULT 0;").run();
  } catch (_) {}
}

function isBoilerplateEvent(text: string): boolean {
  const clean = (text || "").trim();
  if (clean.length < 15) return true;
  if (clean.includes("剧情稳步推进，角色展开行动")) return true;
  if (/^第\s*\d+\s*章[：:]?\s*(剧情|故事)?(稳步|继续|自然)推进/.test(clean)) return true;
  return false;
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureChapterOutlineExtractedColumn(env.DB);

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
    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, effectiveWorkId), eq(works.userId, user.userId)))
      .get();
    if (!work) {
      return NextResponse.json({ success: false, message: "无权访问该作品" }, { status: 403 });
    }

    const chapterText = (content || chapter.content || "").trim();
    if (!chapterText || chapterText.length < 20) {
      return NextResponse.json({ success: false, message: "章节正文内容过短，无法提取有效大纲" }, { status: 400 });
    }

    const allChars = await db.select().from(characters).where(eq(characters.workId, effectiveWorkId)).all();
    const charListStr = allChars.map((c) => `${c.name}(ID:${c.id})`).join(", ");

    const chapterLabel = chapter.chapterNumber ? `第${chapter.chapterNumber}章` : "本章";
    const rawChapterTitle = (title || chapter.title || "未命名章节").trim();

    const systemPrompt = `你是一位严谨的小说总编审。你的任务是通读【单章正文原文】，忠实、具体地提炼出本章实际发生的剧情大纲，供后续「剧情推演」无缝衔接使用。

小说信息：
- 书名：《${work.title}》
- 章节序号：${chapterLabel}
- 章节标题：${rawChapterTitle}
- 作品角色库：${charListStr || "暂无预设角色"}

【提炼铁律】：
1. 必须 100% 基于正文事实提取具体人名、地点、行动与结果，严禁编造正文未出现的内容。
2. **严禁空洞套话**：绝不允许输出“剧情稳步推进”、“角色展开行动”、“局势暗流涌动”这类毫无信息量的废话！必须写清实际发生了什么事。
3. 字段要求：
   - title：格式为“${chapterLabel} · 本章核心事件简称”（18字以内，概括最核心一件事）。
   - event：本章完整剧情经过（**120~260字**，按时间顺序写清楚：开场情境 ➔ 谁做了什么关键行动/对话交锋 ➔ 引发了什么结果 ➔ 本章结尾最终停留在什么状态，确保不看正文也能直接接写下一章）。
   - twist：本章核心冲突、意外转折或遇到的主要阻碍（30~80字；若本章平稳过渡无大反转，写明本段遇到的核心阻力或氛围变化即可）。
   - nextGoal：本章结尾处角色明确要去做或即将面临的下一步行动/目标（20~60字）。
   - suspense：本章实际埋下的伏笔、未解线索或章末钩子（20~60字；若无则写“暂无明显伏笔”）。
   - detectedCharacterIds：正文中**实际出场或被明确提及**的角色 ID 纯数字数组（仅从上方角色库中匹配，匹配不到返回 []）。

仅输出以下合法 JSON 对象，严禁输出 Markdown 代码块或任何额外解释：
{
  "title": "<章节核心事件简称>",
  "event": "<120~260字具体完整的本章剧情经过与结尾落点>",
  "twist": "<核心冲突或转折>",
  "nextGoal": "<结尾指向的下一步目标>",
  "suspense": "<埋下的伏笔或章末悬念>",
  "detectedCharacterIds": []
}`;

    // 长章节保留前 4200 字 + 末尾 2200 字，完整覆盖起承转合与章末落点
    const excerpt =
      chapterText.length > 6500
        ? `${chapterText.slice(0, 4200)}\n\n……（中段略）……\n\n${chapterText.slice(-2200)}`
        : chapterText;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请提炼【${chapterLabel} · ${rawChapterTitle}】的正文剧情大纲，直接输出 JSON：\n\n${excerpt}` },
    ];

    // 首次使用 structured 模型（充裕 maxTokens 避免思考链截断 JSON）
    const rawResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.2,
      maxTokens: 3072,
    });

    let parsed: any = parseStructuredJson<any>(rawResponse, null);

    const extractEventText = (obj: any): string =>
      String(obj?.event || obj?.summary || obj?.plot || obj?.content || obj?.description || "").trim();

    // 若首次解析失败或返回空洞废话，自动用 fast 通道再试一次（绝不用假占位文本糊弄入库）
    if (!parsed || typeof parsed !== "object" || isBoilerplateEvent(extractEventText(parsed))) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.25,
          maxTokens: 2560,
        });
        const retryParsed = parseStructuredJson<any>(retryRaw, null);
        if (retryParsed && typeof retryParsed === "object" && !isBoilerplateEvent(extractEventText(retryParsed))) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        console.warn("[extract-outline] 重试提取失败:", retryErr);
      }
    }

    const finalEvent = extractEventText(parsed);
    if (!parsed || typeof parsed !== "object" || isBoilerplateEvent(finalEvent)) {
      return NextResponse.json(
        { success: false, message: "AI 未能从本章正文中解析出有效剧情大纲，请稍后重试" },
        { status: 500 }
      );
    }

    const existingOutline = await db
      .select()
      .from(outlines)
      .where(and(eq(outlines.workId, effectiveWorkId), eq(outlines.chapterId, chapterId)))
      .get();

    const validCharIdSet = new Set(allChars.map((c) => c.id));
    const detectedCharIds = Array.isArray(parsed.detectedCharacterIds)
      ? parsed.detectedCharacterIds.map(Number).filter((n: number) => !isNaN(n) && validCharIdSet.has(n))
      : [];

    // 若模型漏填角色 ID，按角色姓名在正文中补充命中
    if (detectedCharIds.length === 0 && allChars.length > 0) {
      for (const c of allChars) {
        if (c.name && chapterText.includes(c.name)) {
          detectedCharIds.push(c.id);
        }
      }
    }

    const finalTitle = String(parsed.title || `${chapterLabel} · ${rawChapterTitle}`).trim();
    const finalTwist = String(parsed.twist || "").trim();
    const finalNextGoal = String(parsed.nextGoal || "").trim();
    const finalSuspense = String(parsed.suspense || "").trim();

    const outlineData: any = {
      workId: effectiveWorkId,
      category: "chapter",
      chapterId: chapterId,
      chapterNumber: chapter.chapterNumber || 1,
      title: finalTitle,
      summary: finalEvent,
      event: finalEvent,
      twist: finalTwist,
      nextGoal: finalNextGoal,
      suspense: finalSuspense,
      content: finalEvent,
      status: "completed",
      isFromChapter: 1,
      type: "scene",
      wordCountEstimate: chapter.wordCount || chapterText.replace(/\s+/g, "").length,
      linkedCharacterIds: detectedCharIds,
      orderIndex: chapter.chapterNumber || 1,
      updatedAt: new Date(),
    };

    let resultRecord = null;
    if (existingOutline) {
      await db.update(outlines).set(outlineData).where(eq(outlines.id, existingOutline.id));
      resultRecord = { ...existingOutline, ...outlineData };
    } else {
      const inserted = await db
        .insert(outlines)
        .values({
          ...outlineData,
          createdAt: new Date(),
        })
        .returning();
      resultRecord = inserted[0] || outlineData;
    }

    // 同步标记 chapters.outline_extracted = 1（若章节本身 summary 为空则顺便写入）
    try {
      await env.DB.prepare(
        `UPDATE chapters
         SET outline_extracted = 1,
             summary = CASE WHEN summary IS NULL OR TRIM(summary) = '' THEN ? ELSE summary END,
             updated_at = ?
         WHERE id = ?`
      )
        .bind(finalEvent.slice(0, 500), Date.now(), chapterId)
        .run();
    } catch (markErr) {
      console.warn("[extract-outline] 更新章节提取标记失败:", markErr);
    }

    return NextResponse.json({
      success: true,
      result: resultRecord,
      message: `成功提炼${chapterLabel}剧情并同步到大纲！`,
    });
  } catch (error: any) {
    console.error("[API /api/ai/chapter/extract-outline] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "提取大纲失败" }, { status: 500 });
  }
});
