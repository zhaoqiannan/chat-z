// API: 基于选定的章节走向方案一键生成不少于 3000 字的正文（深度融合总纲/关系网/伏笔/前序文风，防 AI 味，仅覆盖保留最新一次）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, outlines, chapters, characters, worldRules, characterRelations, memoryFragments } from "@/db";
import { eq, and, lt, desc } from "drizzle-orm";
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

    const [prevOutlines, prevChapterRow, charList, ruleList, relationList, fragmentList, masterRow, existingSnapRow] =
      await Promise.all([
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
        db
          .select({
            sourceCharName: characterRelations.sourceCharName,
            targetCharName: characterRelations.targetCharName,
            relationType: characterRelations.relationType,
            description: characterRelations.description,
          })
          .from(characterRelations)
          .where(eq(characterRelations.workId, workId))
          .limit(10)
          .all(),
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
      .map((o) => `第${o.chapterNumber}章《${o.title}》：${(o.summary || o.event || o.content || "").slice(0, 220)}`)
      .join("\n");

    const prevTail = prevChapterRow?.content ? prevChapterRow.content.trim().slice(-1000) : "";
    const charText = charList
      .map((c) => `- ${c.name}（${c.identity || "角色"}）：性格[${c.personality || "未知"}] 能力[${c.abilities || "无"}]`)
      .join("\n");
    const relationText = relationList
      .map((r) => `- ${r.sourceCharName} ➔ ${r.targetCharName}：${r.relationType}${r.description ? `（${r.description.slice(0, 50)}）` : ""}`)
      .join("\n");
    const ruleText = ruleList
      .map((r) => `- ${r.name}：${(r.mechanisms || "").slice(0, 80)}${r.taboos ? `（禁忌：${r.taboos.slice(0, 40)}）` : ""}`)
      .join("\n");
    const fragmentText = fragmentList
      .map((f) => `- ${f.title}：${(f.content || "").slice(0, 100)}`)
      .join("\n");

    const systemPrompt = `你是一位功底深厚的长篇小说执笔作家。请严格依据作者选定的【本章剧情走向蓝本】，撰写一章完整、沉浸、有文学质感的小说正文。

【写作铁律与字数保障】：
1. **篇幅结构（不少于 3000 字，目标 3400~4200 字）**：请将本章走向自然拆分为 **3~4 个具体场景**（每个场景约 900~1100 字），用实时发生的动作、对白交锋、环境感官细节和克制的心理博弈把每个场景写实写透。
2. **严禁快进概括**：绝对禁止使用“很快”“几天后”“经过一番激烈的商议”“转眼间事情就办妥了”这类一句话跳过剧情的提纲式写法。
3. **去 AI 味规范**：禁止滥用陈词滥调（如“嘴角勾起一抹不易察觉的弧度”“眼神微眯”“空气仿佛凝固”“心中掀起惊涛骇浪”“不禁/不由得”），禁止在段落末尾强行讲道理、抒情升华或做总结性点评。
4. **视角与人设严格一致**：若提供了上一章正文末尾片段，必须严格继承其叙事人称（第一人称“我”或第三人称限知）与行文口吻；角色言行严格贴合角色档案与关系网，绝不 OOC。
5. **严守章节边界**：忠实完成本章走向蓝本即可，严禁越界提前写到下一章的核心剧情。
6. **纯正文直出**：从正文第一句直接写到章末最后一句，严禁输出章节号、标题复述、场景序号、思考过程或字数统计。`;

    const userPrompt = `【作品】：《${work.title}》（题材：${work.tag || "小说"}）
${masterGoalText ? `【所属总纲阶段目标】：${masterGoalText}\n` : ""}
${charText ? `【核心角色档案】：\n${charText}\n\n` : ""}${relationText ? `【角色关系网】：\n${relationText}\n\n` : ""}${ruleText ? `【世界观法则】：\n${ruleText}\n\n` : ""}${fragmentText ? `【近期伏笔与记忆碎片（自然契合时可呼应，切勿生硬强塞）】：\n${fragmentText}\n\n` : ""}${prevOutlineText ? `【前序章节大纲（承接上文进度）】：\n${prevOutlineText}\n\n` : ""}${prevTail ? `【上一章（第${prevChapterRow?.chapterNumber}章）正文末尾（请严格沿用此叙事视角与文风无缝承接）】：\n...${prevTail}\n\n` : ""}${siblingContext ? `【前后相邻章边界参考（仅作边界防剧透，切勿越界写到下一章）】：\n${siblingContext}\n\n` : ""}【当前执笔章节】：第 ${chapterNumber} 章《${chapterTitle}》
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
    let wordCount = countChineseWords(prose);

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
          content: `${charText ? `【核心角色档案】：\n${charText}\n\n` : ""}${ruleText ? `【世界观法则】：\n${ruleText}\n\n` : ""}【本章剧情走向蓝本】：\n${plotText}\n${siblingContext ? `\n【下一章边界（严禁越界提前写出）】：\n${siblingContext}\n` : ""}\n【已写正文的末尾段落（请紧接最后一句无缝续写至少 ${remainNeeded} 字）】：\n${prose.slice(-1500)}\n\n请直接输出无缝续写的纯正文：`,
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
          wordCount = countChineseWords(prose);
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
      } catch { }
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
