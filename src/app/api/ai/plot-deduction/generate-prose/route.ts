// API: 基于选定的章节走向方案一键生成不少于 3000 字的正文（只覆盖保留最近一次生成结果，不记录历史）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, outlines, chapters, characters, worldRules } from "@/db";
import { eq, and, asc, lt, desc } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

const MIN_TARGET_WORDS = 3000;

async function ensureSnapshotTable(envDb: any) {
  await envDb
    .prepare(
      `CREATE TABLE IF NOT EXISTS master_node_deduction_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        master_node_id TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(work_id, master_node_id)
      )`
    )
    .run();
}

function countChineseWords(text: string): number {
  return (text || "").replace(/\s+/g, "").length;
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureSnapshotTable(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const nodeId = String(body.nodeId || "").trim();
    const planId = String(body.planId || "").trim();
    const planName = String(body.planName || "").trim();
    const chapterNumber = Math.max(1, Number(body.chapterNumber) || 1);
    const chapterTitle = String(body.chapterTitle || `第${chapterNumber}章`).trim();
    const plotText = String(body.plotText || "").trim();
    const siblingContext = String(body.siblingContext || "").trim();
    const writingStyle = String(body.writingStyle || "流畅细腻、画面感强、节奏紧凑").trim();
    const extraInstruction = String(body.extraInstruction || "").trim();

    if (!workId || isNaN(workId) || !nodeId || !plotText) {
      return NextResponse.json({ success: false, message: "缺少必要参数或章节走向内容为空" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    const [prevOutlines, prevChapterRow, charList, ruleList, existingSnapRow] = await Promise.all([
      db
        .select()
        .from(outlines)
        .where(and(eq(outlines.workId, workId), eq(outlines.category, "chapter"), lt(outlines.chapterNumber, chapterNumber)))
        .orderBy(desc(outlines.chapterNumber))
        .limit(3)
        .all(),
      db
        .select({ chapterNumber: chapters.chapterNumber, title: chapters.title, content: chapters.content })
        .from(chapters)
        .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0), lt(chapters.chapterNumber, chapterNumber)))
        .orderBy(desc(chapters.chapterNumber))
        .limit(1)
        .get(),
      db
        .select({ name: characters.name, identity: characters.identity, personality: characters.personality, abilities: characters.abilities })
        .from(characters)
        .where(eq(characters.workId, workId))
        .limit(10)
        .all(),
      db
        .select({ name: worldRules.name, mechanisms: worldRules.mechanisms, taboos: worldRules.taboos })
        .from(worldRules)
        .where(eq(worldRules.workId, workId))
        .limit(5)
        .all(),
      env.DB.prepare(
        "SELECT snapshot_json FROM master_node_deduction_snapshots WHERE work_id = ? AND user_id = ? AND master_node_id = ? LIMIT 1"
      )
        .bind(workId, user.userId, nodeId)
        .first()
        .catch(() => null),
    ]);

    const prevOutlineText = prevOutlines
      .reverse()
      .map((o) => `第${o.chapterNumber}章《${o.title}》：${(o.summary || o.event || o.content || "").slice(0, 180)}`)
      .join("\n");

    const prevTail = prevChapterRow?.content ? prevChapterRow.content.trim().slice(-900) : "";
    const charText = charList
      .map((c) => `- ${c.name}（${c.identity || "角色"}）：性格[${c.personality || "未知"}] 能力[${c.abilities || "无"}]`)
      .join("\n");
    const ruleText = ruleList
      .map((r) => `- ${r.name}：${(r.mechanisms || "").slice(0, 80)}${r.taboos ? `（禁忌：${r.taboos.slice(0, 40)}）` : ""}`)
      .join("\n");

    const systemPrompt = `你是一位畅销长篇小说执笔作家。请严格根据作者选定的【本章纯文本剧情走向】，撰写一章完整、沉浸、高质量的小说正文。

【铁律与字数硬指标】：
1. **篇幅要求：本章正文必须严格不少于 3000 个汉字（目标 3300 ~ 4200 字）**。切忌用总结式/提纲式快进跳过情节，必须将走向中的每个场景充分铺陈开：写足环境氛围、人物动作细节、神态微表情、心理活动与多轮有张力的对话交锋。
2. 严格贴合前序剧情与角色档案人设，严防 OOC 与设定冲突，不得擅自提前写完后续章节的情节。
3. **纯正文直出**：从正文第一句直接写到章末最后一句，严禁输出章节号、标题复述、思考过程、字数统计或任何开场/结尾说明。`;

    const userPrompt = `【作品】：《${work.title}》（题材：${work.tag || "小说"}）
${charText ? `【核心角色档案】：\n${charText}\n\n` : ""}${ruleText ? `【世界观设定】：\n${ruleText}\n\n` : ""}${prevOutlineText ? `【前序章节大纲（承接上文）】：\n${prevOutlineText}\n\n` : ""}${prevTail ? `【上一章（第${prevChapterRow?.chapterNumber}章）正文末尾片段（保持文风与场景无缝衔接）】：\n...${prevTail}\n\n` : ""}${siblingContext ? `【同方案前后相邻章边界参考（仅作边界防越界，本章不要提前写到下一章）】：\n${siblingContext}\n\n` : ""}【当前要写的章节】：第 ${chapterNumber} 章《${chapterTitle}》
【本章剧情走向蓝本（必须完整且细致展开）】：
${plotText}

【文风与节奏要求】：${writingStyle}${extraInstruction ? `\n【作者补充写作要求】：${extraInstruction}` : ""}
【字数硬要求】：不少于 3000 字（请充分描写场景与对话，写足 3300~4000 字）。

请直接开始输出本章纯正文：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const firstRaw = await callCloudflareAi(env.AI, messages, {
      taskType: "creative",
      temperature: 0.78,
      maxTokens: 8192,
    });

    let prose = cleanNovelStoryText(firstRaw);
    let wordCount = countChineseWords(prose);

    // 若首次生成不足 3000 字，自动无缝续写补足至 >= 3000 字
    if (prose && wordCount < MIN_TARGET_WORDS) {
      const remainNeeded = Math.max(1200, 3400 - wordCount);
      const continueMessages: ChatMessage[] = [
        {
          role: "system",
          content: `你是正在连贯撰写本章正文的同一位小说作家。当前已写内容尚未达到 3000 字目标，请紧接已写正文的最后一句**无缝续写后续情节与细节**，补足至少 ${remainNeeded} 字，直到完整走完本章走向蓝本并自然收束在章末钩子处。严禁重复已写段落，严禁输出任何解释说明，直接从下一句开始输出纯正文。`,
        },
        {
          role: "user",
          content: `【本章完整剧情走向蓝本】：\n${plotText}\n\n【已写正文的后段内容（请紧接最后一句无缝往下写）】：\n${prose.slice(-1400)}\n\n请直接无缝续写至少 ${remainNeeded} 字纯正文：`,
        },
      ];

      try {
        const contRaw = await callCloudflareAi(env.AI, continueMessages, {
          taskType: "creative",
          temperature: 0.76,
          maxTokens: 6144,
        });
        const contClean = cleanNovelStoryText(contRaw);
        if (contClean && contClean.length > 100) {
          prose = `${prose.trim()}\n\n${contClean.trim()}`;
          wordCount = countChineseWords(prose);
        }
      } catch (contErr) {
        console.warn("[generate-prose] 自动补足续写失败，返回首次生成正文:", contErr);
      }
    }

    if (!prose || !prose.trim()) {
      return NextResponse.json({ success: false, message: "正文生成失败，请重试" }, { status: 500 });
    }

    const now = Date.now();
    const draftObj = {
      chapterNumber,
      chapterTitle,
      planId,
      planName,
      plotText,
      content: prose.trim(),
      wordCount,
      updatedAt: now,
    };

    // 仅覆盖更新最近一次生成结果（不建历史表、不保留旧版本）
    let snapshot: any = {
      nodeId,
      plans: [],
      selectedPlanId: planId,
      latestDrafts: {},
      updatedAt: now,
    };
    if (existingSnapRow && (existingSnapRow as any).snapshot_json) {
      try {
        snapshot = JSON.parse((existingSnapRow as any).snapshot_json);
      } catch {}
    }
    if (!snapshot.latestDrafts || typeof snapshot.latestDrafts !== "object") {
      snapshot.latestDrafts = {};
    }
    snapshot.latestDrafts[String(chapterNumber)] = draftObj;
    snapshot.lastGeneratedDraft = draftObj;
    snapshot.selectedPlanId = planId || snapshot.selectedPlanId;
    snapshot.updatedAt = now;

    await env.DB.prepare(
      `INSERT INTO master_node_deduction_snapshots (work_id, user_id, master_node_id, snapshot_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(work_id, master_node_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`
    )
      .bind(workId, user.userId, nodeId, JSON.stringify(snapshot), now)
      .run();

    return NextResponse.json({
      success: true,
      result: draftObj,
      message: `正文生成完成（共 ${wordCount} 字）`,
    });
  } catch (error: any) {
    console.error("[API /api/ai/plot-deduction/generate-prose POST] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "生成正文异常" }, { status: 500 });
  }
});
