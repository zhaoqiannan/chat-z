import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters as dbChapters, chapterAiHistory, characters as dbCharacters, characterRelations as dbRelations, worldRules as dbWorldRules } from "@/db";
import { eq, and, lt, desc } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";
import { assertWorkOwnership, assertChapterOwnership, parseJsonBody } from "@/utils/ownership";

/**
 * AI 章节初稿生成接口（已移除零调用的 optimize/selection_ai 冗余模式，统一由 /api/ai/chapter/chat 承接）
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const {
      workId: rawWorkId,
      chapterId: rawChapterId,
      mode = "draft",
      overview,
      events,
      plotDirection,
      characters,
      writingStyle,
      targetWords,
    } = parsedBody.data;

    const workId = Number(rawWorkId);
    const chapterId = rawChapterId ? Number(rawChapterId) : 0;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    if (mode !== "draft") {
      return NextResponse.json({ success: false, message: "请使用章节 AI 协同助手接口进行润色或改写" }, { status: 400 });
    }

    let currentChapterRow: any = null;
    if (chapterId > 0) {
      const owned = await assertChapterOwnership(db, chapterId, user.userId, workId);
      if (!owned) {
        return NextResponse.json({ success: false, message: "目标章节不存在或不属于当前作品" }, { status: 403 });
      }
      currentChapterRow = owned.chapter;
    }

    const [workChars, workRules, workRelations] = await Promise.all([
      db.select().from(dbCharacters).where(eq(dbCharacters.workId, workId)).limit(8).all(),
      db.select().from(dbWorldRules).where(eq(dbWorldRules.workId, workId)).limit(6).all(),
      db.select().from(dbRelations).where(eq(dbRelations.workId, workId)).limit(8).all(),
    ]);

    let prevChapterTail = "";
    if (currentChapterRow?.chapterNumber && currentChapterRow.chapterNumber > 1) {
      const prevCh = await db
        .select({ content: dbChapters.content })
        .from(dbChapters)
        .where(and(eq(dbChapters.workId, workId), eq(dbChapters.isVolume, 0), lt(dbChapters.chapterNumber, currentChapterRow.chapterNumber)))
        .orderBy(desc(dbChapters.chapterNumber))
        .limit(1)
        .get();
      if (prevCh?.content?.trim()) {
        prevChapterTail = prevCh.content.trim().slice(-800);
      }
    }

    let loreContext = "";
    if (workChars.length > 0) {
      loreContext +=
        "【作品角色档案（严格贴合人设，严防 OOC）】：\n" +
        workChars
          .map((c) => `- ${c.name} (${c.identity || c.roleType || "角色"}): 性格[${c.personality || "未知"}], 能力[${c.abilities || "无"}], 特点[${(c.description || c.experiences || "无").slice(0, 80)}]`)
          .join("\n") +
        "\n\n";
    }
    if (workRelations.length > 0) {
      loreContext +=
        "【人物关系网】：\n" +
        workRelations.map((r) => `- ${r.sourceCharName} ➔ ${r.targetCharName}：${r.relationType}${r.description ? `（${r.description.slice(0, 40)}）` : ""}`).join("\n") +
        "\n\n";
    }
    if (workRules.length > 0) {
      loreContext +=
        "【世界观法则】：\n" +
        workRules.map((r) => `- ${r.name}: ${(r.mechanisms || r.description || "无").slice(0, 100)}`).join("\n") +
        "\n\n";
    }
    if (prevChapterTail) {
      loreContext += `【上一章正文末尾（严格继承其人称视角与文风无缝承接，不要重复前文）】：\n...${prevChapterTail}\n\n`;
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你是一名专业小说执笔助手。请根据作者给出的本章大纲、核心事件、角色档案与文风要求撰写章节正文。
【核心准则】
1. 严格按作者指定的事件顺序与剧情走向展开，不擅自改写既定设定或凭空加入无关角色。
2. 人物言行与心理必须符合角色档案与人物关系，用实时发生的动作、对话与感官细节推进情节；严禁使用“很快”“转眼间”“经过一番商议”这类快进概括写法。
3. 去 AI 味规范：禁止滥用陈词滥调（如“嘴角勾起一抹弧度”“空气仿佛凝固”“心中掀起惊涛骇浪”“不由得/不禁”），禁止段尾强行说教或总结升华。
4. 严格继承上一章的叙事人称与文风（若有提供），控制篇幅贴近目标字数。
5. 【纯正文直出】：从正文第一句直接输出到最后一句，严禁输出思考过程、大纲复述、字数说明或开场白。`,
      },
      {
        role: "user",
        content: `作品书名：《${work.title}》（题材：${work.tag || "通用小说"}）
${loreContext}【本章创作需求】
- 本章大致内容：${overview || "推进核心主线"}
- 核心事件安排：${events || "按大纲事件展开"}
- 剧情走向与预期节点：${plotDirection || "自然推进至目标节点"}
- 本章登场人物与性格：${characters || "参考上述角色档案"}
- 文风要求：${writingStyle || "流畅自然、画面感强"}
- 目标字数：约 ${targetWords || 2000} 字

请直接开始输出本章纯正文：`,
      },
    ];

    const rawDraftText = await callCloudflareAi(env.AI, messages, {
      taskType: "creative",
      temperature: 0.75,
      maxTokens: 8192,
    });

    const draftText = cleanNovelStoryText(rawDraftText);
    if (!draftText || !draftText.trim()) {
      return NextResponse.json({ success: false, message: "AI 初稿创作失败，未能获取到有效正文" }, { status: 500 });
    }

    const wordCount = draftText.trim().replace(/\s+/g, "").length;
    if (chapterId > 0) {
      try {
        await db
          .insert(chapterAiHistory)
          .values({
            workId,
            chapterId,
            mode: "draft",
            title: `AI 初稿生成 (${wordCount} 字)`,
            promptSummary: overview || events || "根据剧情大纲生成正文",
            content: draftText.trim(),
            wordCount,
            createdAt: new Date(),
          })
          .run();
      } catch (histErr) {
        console.warn("保存章节 AI 初稿历史记录失败:", histErr);
      }
    }

    return NextResponse.json({
      success: true,
      result: { draftText: draftText.trim(), wordCount },
      message: "AI 初稿生成成功！",
    });
  } catch (error: any) {
    console.error("Chapter AI error:", error);
    return NextResponse.json({ success: false, message: "AI 章节服务异常" }, { status: 500 });
  }
});
