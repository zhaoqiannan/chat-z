// API: 基于选定的章节走向方案一键生成不少于 3000 字的正文（深度融合总纲/关系网/伏笔/前序文风，防 AI 味，仅覆盖保留最新一次）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, outlines, chapters, memoryFragments } from "@/db";
import { eq, and, lt, desc } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";
import { countWords } from "@/utils/text";
import { buildWorldLoreContext } from "@/utils/worldContext";

const MIN_TARGET_WORDS = 3000;

function findMasterNode(node: any, targetId: string): any | null {
  if (!node || typeof node !== "object") return null;
  if (String(node.id) === String(targetId)) return node;
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const found = findMasterNode(c, targetId);
      if (found) return found;
    }
  }
  return null;
}

function buildProseExcerpt(raw?: string | null, headLen = 1400, tailLen = 1400): string {
  const clean = (raw || "").trim();
  if (!clean) return "";
  if (clean.length <= headLen + tailLen + 80) return clean;
  return `${clean.slice(0, headLen)}\n\n……（中段略）……\n\n${clean.slice(-tailLen)}`;
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const nodeId = String(body.nodeId || "").trim();
    const planId = String(body.planId || "").trim();
    const planName = String(body.planName || "").trim();
    const chapterNumber = Math.max(1, Number(body.chapterNumber) || 1);
    const chapterTitle = String(body.chapterTitle || `第${chapterNumber}章`).trim();
    const plotText = String(body.plotText || "").trim();
    const prevPlanContext = String(body.prevPlanContext || "").trim();
    const nextPlanContext = String(body.nextPlanContext || "").trim();
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

    const [
      prevOutlines,
      exactPrevChapterRow,
      currentChapterRow,
      currentOutlineRow,
      fragmentList,
      masterRow,
      existingSnapRow,
    ] = await Promise.all([
      db
        .select()
        .from(outlines)
        .where(and(eq(outlines.workId, workId), eq(outlines.category, "chapter"), lt(outlines.chapterNumber, chapterNumber)))
        .orderBy(desc(outlines.chapterNumber))
        .limit(3)
        .all(),
      // 精确读取紧邻的上一章（chapterNumber - 1），避免跳章错接更早章节
      chapterNumber > 1
        ? db
            .select({ chapterNumber: chapters.chapterNumber, title: chapters.title, summary: chapters.summary, content: chapters.content })
            .from(chapters)
            .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0), eq(chapters.chapterNumber, chapterNumber - 1)))
            .limit(1)
            .get()
        : Promise.resolve(null),
      // 读取当前章节已有正文与摘要，避免无视当前章已写剧情
      db
        .select({
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          summary: chapters.summary,
          content: chapters.content,
          wordCount: chapters.wordCount,
        })
        .from(chapters)
        .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0), eq(chapters.chapterNumber, chapterNumber)))
        .limit(1)
        .get(),
      // 读取当前章节已有章节大纲
      db
        .select()
        .from(outlines)
        .where(and(eq(outlines.workId, workId), eq(outlines.category, "chapter"), eq(outlines.chapterNumber, chapterNumber)))
        .limit(1)
        .get(),
      db
        .select({ title: memoryFragments.title, content: memoryFragments.content })
        .from(memoryFragments)
        .where(and(eq(memoryFragments.workId, workId), eq(memoryFragments.userId, user.userId)))
        .orderBy(desc(memoryFragments.createdAt))
        .limit(6)
        .all(),
      env.DB.prepare("SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1")
        .bind(workId, user.userId)
        .first()
        .catch(() => null),
      env.DB.prepare(
        "SELECT snapshot_json FROM master_node_deduction_snapshots WHERE work_id = ? AND user_id = ? AND master_node_id = ? LIMIT 1"
      )
        .bind(workId, user.userId, nodeId)
        .first()
        .catch(() => null),
    ]);

    // 提前解析快照，以便在上一章尚未落库章节表时，自动降级衔接快照中刚生成的第 N-1 章正文
    let existingSnapshot: any = null;
    if (existingSnapRow && (existingSnapRow as any).snapshot_json) {
      try {
        existingSnapshot = JSON.parse((existingSnapRow as any).snapshot_json);
      } catch {}
    }

    let masterGoalText = "";
    if (masterRow && (masterRow as any).tree_json) {
      try {
        const targetNode = findMasterNode(JSON.parse((masterRow as any).tree_json), nodeId);
        if (targetNode) {
          masterGoalText = `${targetNode.title}${targetNode.note ? `：${String(targetNode.note).trim()}` : ""}`;
        }
      } catch { }
    }

    const prevOutlineText = prevOutlines
      .reverse()
      .map((o) => {
        const bodyParts = [
          o.summary || o.event || o.content || "",
          o.twist ? `转折：${o.twist}` : "",
          o.nextGoal ? `后续推进：${o.nextGoal}` : "",
          o.suspense ? `伏笔：${o.suspense}` : "",
        ]
          .filter((s) => s && String(s).trim())
          .join("；");
        return `第${o.chapterNumber}章《${o.title}》：${bodyParts.slice(0, 280)}`;
      })
      .join("\n");

    // 组装紧邻上一章（chapterNumber - 1）的完整内容与结尾：优先章节库已写正文，其次同节点刚生成的上一章草稿
    const prevChapterNum = chapterNumber - 1;
    const prevDraftFromSnapshot =
      prevChapterNum >= 1 ? existingSnapshot?.latestDrafts?.[String(prevChapterNum)] : null;
    const prevChapterSourceContent =
      (exactPrevChapterRow?.content || "").trim() || (prevDraftFromSnapshot?.content || "").trim();
    const prevChapterTitle =
      exactPrevChapterRow?.title || prevDraftFromSnapshot?.chapterTitle || `第${prevChapterNum}章`;
    const prevChapterSourceLabel = (exactPrevChapterRow?.content || "").trim()
      ? "章节库已写正文"
      : (prevDraftFromSnapshot?.content || "").trim()
      ? "刚生成的上一章草稿"
      : "";
    const prevChapterSummary = (exactPrevChapterRow?.summary || "").trim();
    const prevChapterExcerpt = prevChapterSourceContent
      ? buildProseExcerpt(prevChapterSourceContent, 700, 1600)
      : "";

    // 组装当前章节（chapterNumber）已有剧情与正文基础
    const currentExistingContent = (currentChapterRow?.content || "").trim();
    const currentExistingSummary = (currentChapterRow?.summary || "").trim();
    const currentExistingOutline = currentOutlineRow
      ? [
          currentOutlineRow.summary || currentOutlineRow.event || currentOutlineRow.content || "",
          currentOutlineRow.twist ? `转折：${currentOutlineRow.twist}` : "",
          currentOutlineRow.nextGoal ? `后续目标：${currentOutlineRow.nextGoal}` : "",
          currentOutlineRow.suspense ? `伏笔：${currentOutlineRow.suspense}` : "",
        ]
          .filter((s) => s && String(s).trim())
          .join("；")
      : "";
    const hasCurrentExistingPlot = Boolean(currentExistingContent || currentExistingOutline || currentExistingSummary);
    const currentExistingContextBlock = hasCurrentExistingPlot
      ? [
          `【当前章节（第${chapterNumber}章《${currentChapterRow?.title || chapterTitle}》）已有剧情与正文（请尊重并自然融合已写核心情节，不可无视重来）】：`,
          currentExistingOutline ? `已有章节大纲：${currentExistingOutline}` : "",
          !currentExistingOutline && currentExistingSummary ? `已有章节摘要：${currentExistingSummary}` : "",
          currentExistingContent
            ? `已有正文内容（当前约 ${currentChapterRow?.wordCount || countWords(currentExistingContent)} 字）：\n${buildProseExcerpt(currentExistingContent, 1400, 1400)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    // 拆分“上一章走向参考”与“下一章边界防剧透参考”
    const nextBoundaryText = nextPlanContext || (!prevPlanContext ? siblingContext : "");
    const worldLore = await buildWorldLoreContext(
      db,
      workId,
      [plotText, masterGoalText, prevChapterExcerpt, currentExistingContent, extraInstruction].join("\n"),
      { includeTimeline: true, includeMaterials: true, maxChars: 3400 }
    );
    const charText = worldLore.charText;
    const ruleText = worldLore.ruleText;
    const fragmentText = fragmentList
      .map((f) => `- ${f.title}：${(f.content || "").slice(0, 100)}`)
      .join("\n");

    const systemPrompt = `你是一位功底深厚的长篇小说执笔作家。请严格依据作者选定的【本章剧情走向蓝本】，撰写一章完整、沉浸、连贯且有文学质感的小说正文。

【写作铁律与连贯性保障】：
1. **篇幅结构（不少于 3000 字，目标 3400~4200 字）**：请将本章走向自然拆分为 **3~4 个具体场景**（每个场景约 900~1100 字），用实时发生的动作、对白交锋、环境感官细节和克制的心理博弈把每个场景写实写透。
2. **严密承接上一章内容与结尾（极其重要）**：
   - 若提供了上一章（第 ${chapterNumber - 1} 章）的正文与结尾片段，**本章开篇必须精准承接上一章最后停驻的时间点、场景地点、在场人物、动作/对话余韵与悬念钩子**；
   - 严禁场景或时间线莫名瞬移，严禁把上一章结尾已经发生过的动作、台词或揭示在本章开头重复再演一遍；
   - 严格继承上一章的叙事人称（第一人称“我”或第三人称限知）、称谓习惯与行文口吻。
3. **尊重当前章节已有剧情（极其重要）**：
   - 若提供了【当前章节已有剧情与正文】，说明本章并非从零开始。请以完整一章的形式输出正文（≥3000 字），**保留并自然融合当前章节已写的关键剧情事实、人物状态、细节伏笔**，在此基础上围绕【本章剧情走向蓝本】做无缝补全、扩写与深化（除非作者在补充要求中明确要求推翻重写）。
4. **严禁快进概括**：绝对禁止使用“很快”“几天后”“经过一番激烈的商议”“转眼间事情就办妥了”这类一句话跳过剧情的提纲式写法。
5. **去 AI 味规范**：禁止滥用陈词滥调（如“嘴角勾起一抹不易察觉的弧度”“眼神微眯”“空气仿佛凝固”“心中掀起惊涛骇浪”“不禁/不由得”），禁止在段落末尾强行讲道理、抒情升华或做总结性点评；角色言行严格贴合角色档案与关系网，绝不 OOC。
6. **严守章节边界**：忠实完成本章走向蓝本即可，严禁越界提前写到下一章的核心剧情。
7. **纯正文直出**：从正文第一句直接写到章末最后一句，严禁输出章节号、标题复述、场景序号、思考过程或字数统计。`;

    const prevChapterBlock =
      prevChapterNum >= 1 && (prevChapterExcerpt || prevChapterSummary || prevPlanContext)
        ? [
            `【上一章（第${prevChapterNum}章《${prevChapterTitle}》）完整内容与结尾${prevChapterSourceLabel ? ` · 来源：${prevChapterSourceLabel}` : ""}（本章开头必须紧贴此处结尾场景、时间与情绪无缝承接，切勿重复已演完的情节）】：`,
            prevChapterSummary ? `上一章摘要：${prevChapterSummary}` : "",
            !prevChapterExcerpt && prevPlanContext ? `上一章走向规划：${prevPlanContext}` : "",
            prevChapterExcerpt ? `上一章正文与完整结尾：\n${prevChapterExcerpt}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "";

    const userPrompt = `【作品】：《${work.title}》（题材：${work.tag || "小说"}）
${masterGoalText ? `【所属总纲阶段目标】：${masterGoalText}\n` : ""}
${worldLore.text ? `${worldLore.text}\n\n` : ""}${fragmentText ? `【近期伏笔与记忆碎片（自然契合时可呼应，切勿生硬强塞）】：\n${fragmentText}\n\n` : ""}${prevOutlineText ? `【前序章节大纲（前情脉络）】：\n${prevOutlineText}\n\n` : ""}${prevChapterBlock ? `${prevChapterBlock}\n\n` : ""}${currentExistingContextBlock ? `${currentExistingContextBlock}\n\n` : ""}${nextBoundaryText ? `【下一章边界参考（仅作防剧透边界，严禁越界提前写出）】：\n${nextBoundaryText}\n\n` : ""}【当前执笔章节】：第 ${chapterNumber} 章《${chapterTitle}》
【本章剧情走向蓝本（请拆成 3~4 个饱满场景逐一写透）】：
${plotText}

【文风与节奏要求】：${writingStyle}${extraInstruction ? `\n【作者补充要求】：${extraInstruction}` : ""}
【字数硬指标】：正文必须严格不少于 3000 汉字（目标 3400~4000 字）。

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
    let wordCount = countWords(prose);

    // 若首次生成不足 3000 字，最多进行 2 轮精准补足（携带精简人设与法则防 OOC，严禁越界到下一章）
    for (let attempt = 0; attempt < 2 && prose && wordCount < MIN_TARGET_WORDS; attempt++) {
      const remainNeeded = Math.max(900, 3400 - wordCount);
      const continueMessages: ChatMessage[] = [
        {
          role: "system",
          content: `你是正在撰写同一章正文的同一位小说作家。当前正文已有 ${wordCount} 字，距离 3000 字底线还差约 ${remainNeeded} 字。
请紧接已写正文的最后一句无缝往下写：
1. 若【本章剧情走向蓝本】中仍有尚未展开的情节，请把剩余场景与对话交锋写足写透；
2. 若核心事件刚刚落幕，请重点深化事件落幕后的即时余波、关键人物私下反应与章末暗流悬念，**严禁越界提前写到下一章的新主线事件**；
3. 严格贴合角色档案与世界规则，严禁重复前文已写过的动作或台词，保持人称视角与文风完全一致，禁止 AI 套话与总结式升华，直接从下一句输出纯正文。`,
        },
        {
          role: "user",
          content: `${charText ? `【核心角色档案】：\n${charText}\n\n` : ""}${ruleText ? `【世界观法则】：\n${ruleText}\n\n` : ""}${currentExistingOutline ? `【当前章节已有大纲参考】：\n${currentExistingOutline}\n\n` : ""}【本章剧情走向蓝本】：\n${plotText}\n${nextBoundaryText ? `\n【下一章边界（严禁越界提前写出）】：\n${nextBoundaryText}\n` : ""}\n【已写正文的末尾段落（请紧接最后一句无缝续写至少 ${remainNeeded} 字）】：\n${prose.slice(-1500)}\n\n请直接输出无缝续写的纯正文：`,
        },
      ];

      try {
        const contRaw = await callCloudflareAi(env.AI, continueMessages, {
          taskType: "creative",
          temperature: 0.75,
          maxTokens: 6144,
        });
        const contClean = cleanNovelStoryText(contRaw);
        if (contClean && contClean.length > 100) {
          prose = `${prose.trim()}\n\n${contClean.trim()}`;
          wordCount = countWords(prose);
        } else {
          break;
        }
      } catch (contErr) {
        console.warn(`[generate-prose] 第 ${attempt + 1} 轮补足续写失败:`, contErr);
        break;
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

    // 仅覆盖保存最近一次生成结果，不记录历史数据
    const snapshot: any = existingSnapshot && typeof existingSnapshot === "object"
      ? { ...existingSnapshot }
      : {
          nodeId,
          plans: [],
          selectedPlanId: planId,
          latestDrafts: {},
          updatedAt: now,
        };
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
