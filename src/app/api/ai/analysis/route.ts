// API: AI 深度分析引擎（全书宏观 / 区间节点 / 逻辑自洽 / 人物性格 OOC，独立表 ai_analysis_reports 零侵入线上数据）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters, outlines, characters, worldRules, items, factions, timelineEvents, characterRelations } from "@/db";
import { eq, and, asc, inArray, gte, lte, sql } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";
import { stripHtml } from "@/utils/text";

function serializeMasterTree(node: any, depth = 0): string {
  if (!node || typeof node !== "object") return "";
  const indent = "  ".repeat(depth);
  const metaParts: string[] = [];
  if (node.tag) metaParts.push(node.tag);
  if (node.chapterRange) metaParts.push(`第${node.chapterRange}章`);
  if (node.status) metaParts.push(node.status);
  const meta = metaParts.length > 0 ? ` [${metaParts.join(" | ")}]` : "";
  const note = node.note ? `：${String(node.note).slice(0, 120)}` : "";
  let line = `${indent}- ${node.title || "节点"}${meta}${note}\n`;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      line += serializeMasterTree(child, depth + 1);
    }
  }
  return line;
}

function extractMasterRangeNodes(node: any, out: Array<{ id: string; title: string; chapterRange: string; tag?: string }> = []) {
  if (!node || typeof node !== "object") return out;
  if (node.chapterRange && String(node.chapterRange).trim()) {
    out.push({
      id: String(node.id || out.length),
      title: String(node.title || "节点"),
      chapterRange: String(node.chapterRange).trim(),
      tag: node.tag ? String(node.tag) : undefined,
    });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      extractMasterRangeNodes(child, out);
    }
  }
  return out;
}

function extractCharacterExcerpts(text: string, charNames: string[], maxLen = 1400): string {
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const pickedIndexes = new Set<number>();

  for (let i = 0; i < paragraphs.length; i++) {
    if (charNames.some((name) => name && paragraphs[i].includes(name))) {
      // 命中角色名时顺带保留紧邻前后各 1 段，避免漏掉未提全名的连续对话与动作反应
      if (i > 0) pickedIndexes.add(i - 1);
      pickedIndexes.add(i);
      if (i + 1 < paragraphs.length) pickedIndexes.add(i + 1);
    }
  }

  const ordered = Array.from(pickedIndexes).sort((a, b) => a - b);
  const picked: string[] = [];
  let len = 0;

  for (const idx of ordered) {
    const snippet = paragraphs[idx].slice(0, 260);
    if (len + snippet.length > maxLen) break;
    picked.push(snippet);
    len += snippet.length;
  }
  return picked.join("\n");
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const tabParam = searchParams.get("tab") || "";
    const validTab = ["book_overview", "chapter_range", "audit"].includes(tabParam) ? tabParam : "";
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    const needCharacters = !validTab || validTab === "audit";
    const needOutlines = !validTab || validTab === "book_overview";
    const needMasterNodes = !validTab || validTab === "book_overview" || validTab === "chapter_range";

    const [allChapters, allOutlines, allChars] = await Promise.all([
      db
        .select({
          id: chapters.id,
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          wordCount: chapters.wordCount,
          volumeId: chapters.volumeId,
          isVolume: chapters.isVolume,
          status: chapters.status,
        })
        .from(chapters)
        .where(eq(chapters.workId, workId))
        .orderBy(asc(chapters.chapterNumber), asc(chapters.createdAt))
        .all(),
      needOutlines
        ? db.select({ id: outlines.id }).from(outlines).where(eq(outlines.workId, workId)).all()
        : Promise.resolve([]),
      needCharacters
        ? db
            .select({ id: characters.id, name: characters.name, identity: characters.identity, roleType: characters.roleType })
            .from(characters)
            .where(eq(characters.workId, workId))
            .all()
        : Promise.resolve([]),
    ]);

    let masterNodes: Array<{ id: string; title: string; chapterRange: string; tag?: string }> = [];
    let hasMasterOutline = false;
    try {
      const masterRow: any = await env.DB.prepare(
        "SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1"
      )
        .bind(workId, user.userId)
        .first();
      if (masterRow?.tree_json) {
        hasMasterOutline = true;
        if (needMasterNodes) {
          masterNodes = extractMasterRangeNodes(JSON.parse(masterRow.tree_json));
        }
      }
    } catch {}

    const volumes = allChapters.filter((c) => c.isVolume === 1).map((v) => ({ id: v.id, title: v.title }));
    const normalChapters = allChapters
      .filter((c) => c.isVolume === 0)
      .map((c) => ({
        id: c.id,
        chapterNumber: c.chapterNumber || 1,
        title: c.title,
        wordCount: c.wordCount || 0,
        volumeId: c.volumeId ?? null,
        status: c.status || "not_started",
      }));

    const totalWords = normalChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0) || work.wordCount || 0;
    const expectedWords = work.expectedWords || 500000;
    const completedChapters = normalChapters.filter((c) => c.status === "completed").length;
    const avgWordsPerChapter = normalChapters.length > 0 ? Math.round(totalWords / normalChapters.length) : 0;

    let historySql = `SELECT id, work_id, analysis_type, scope_label, scope_params_json, overall_score, report_json, created_at
       FROM ai_analysis_reports
       WHERE work_id = ? AND user_id = ?`;
    const historyBinds: any[] = [workId, user.userId];
    if (validTab === "book_overview") {
      historySql += ` AND analysis_type = 'book_overview'`;
    } else if (validTab === "chapter_range") {
      historySql += ` AND analysis_type = 'chapter_range'`;
    } else if (validTab === "audit") {
      historySql += ` AND analysis_type IN ('logic_audit', 'character_audit')`;
    }
    historySql += ` ORDER BY created_at DESC LIMIT 20`;

    const historyRows: any = await env.DB.prepare(historySql)
      .bind(...historyBinds)
      .all();

    const history = (historyRows?.results || [])
      .map((r: any) => {
        try {
          return {
            id: r.id,
            workId: r.work_id,
            analysisType: r.analysis_type,
            scopeLabel: r.scope_label,
            scopeParams: r.scope_params_json ? JSON.parse(r.scope_params_json) : null,
            overallScore: r.overall_score || 0,
            report: JSON.parse(r.report_json),
            createdAt: r.created_at,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      result: {
        metrics: {
          workTitle: work.title,
          workTag: work.tag || "小说",
          totalWords,
          expectedWords,
          progressPercent: expectedWords > 0 ? Math.min(100, Math.round((totalWords / expectedWords) * 100)) : 0,
          chapterCount: normalChapters.length,
          completedChapters,
          avgWordsPerChapter,
          outlineNodeCount: allOutlines.length,
          hasMasterOutline,
          chapters: normalChapters,
          volumes,
          characters: allChars,
          masterNodes,
        },
        history,
      },
    });
  } catch (error: any) {
    console.error("[API /api/ai/analysis GET] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取分析数据失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const analysisType = String(body.analysisType || "book_overview");

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    // 仅查询轻量章节元数据，绝不一次性把整本书正文全部读入 Worker 内存
    const chapterMetaList = await db
      .select({
        id: chapters.id,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        wordCount: chapters.wordCount,
        status: chapters.status,
        summary: chapters.summary,
        contentHead: sql<string>`substr(${chapters.content}, 1, 180)`,
      })
      .from(chapters)
      .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0)))
      .orderBy(asc(chapters.chapterNumber), asc(chapters.createdAt))
      .all();

    const fetchRangeChapters = (startCh: number, endCh: number, limitCount: number) =>
      db
        .select({
          id: chapters.id,
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          wordCount: chapters.wordCount,
          content: chapters.content,
        })
        .from(chapters)
        .where(
          and(
            eq(chapters.workId, workId),
            eq(chapters.isVolume, 0),
            gte(chapters.chapterNumber, startCh),
            lte(chapters.chapterNumber, endCh)
          )
        )
        .orderBy(asc(chapters.chapterNumber), asc(chapters.createdAt))
        .limit(limitCount)
        .all();

    let masterOutlineText = "";
    try {
      const masterRow: any = await env.DB.prepare(
        "SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1"
      )
        .bind(workId, user.userId)
        .first();
      if (masterRow?.tree_json) {
        masterOutlineText = serializeMasterTree(JSON.parse(masterRow.tree_json)).slice(0, 2200);
      }
    } catch {}

    let scopeLabel = "全书宏观分析";
    let scopeParams: Record<string, any> = {};
    let systemPrompt = "";
    let userPrompt = "";

    const SCORING_RUBRIC = `【客观评分标尺（严禁打和稀泥高分）】：
- 90~100：结构严密、张力饱满、几无明显硬伤；
- 75~89：整体合格有亮点，存在局部节奏或细节可打磨处；
- 60~74：存在明显短板（节奏失衡、动机薄弱、偏离大纲或设定疏漏），需要针对性改稿；
- 60 以下：存在严重逻辑硬伤、大量空缺或主线失焦。`;

    // =========================================================================
    // 模式 1：全书宏观分析 (book_overview)
    // =========================================================================
    if (analysisType === "book_overview") {
      const outlineList = await db
        .select()
        .from(outlines)
        .where(eq(outlines.workId, workId))
        .orderBy(asc(outlines.chapterNumber), asc(outlines.orderIndex))
        .limit(30)
        .all();
      const totalWords = chapterMetaList.reduce((s, c) => s + (c.wordCount || 0), 0) || work.wordCount || 0;
      const expectedWords = work.expectedWords || 500000;
      const expectedChapters = work.expectedChapters || 100;
      const progressPct = expectedWords > 0 ? Math.round((totalWords / expectedWords) * 100) : 0;

      const writtenChapters = chapterMetaList.filter((c) => (c.wordCount || 0) > 0 || (c.contentHead || "").trim().length > 0);
      const emptyChapterCount = chapterMetaList.length - writtenChapters.length;

      const chapterDigest = writtenChapters
        .slice(0, 45)
        .map((c) => {
          const brief = (c.summary || (c.contentHead || "").slice(0, 140)).replace(/\s+/g, " ").trim();
          return `第${c.chapterNumber}章《${c.title}》(ID:${c.id}, ${c.wordCount || 0}字, ${c.status || "not_started"}): ${brief || "暂无内容"}`;
        })
        .join("\n");

      const chapterOutlinesFirst = [
        ...outlineList.filter((o) => o.category === "chapter"),
        ...outlineList.filter((o) => o.category !== "chapter"),
      ];
      const outlineDigest = chapterOutlinesFirst
        .slice(0, 25)
        .map((o) => `- [${o.category}] ${o.title}：${(o.event || o.content || o.goal || "").slice(0, 90)}${o.suspense ? `（伏笔：${o.suspense.slice(0, 50)}）` : ""}`)
        .join("\n");

      systemPrompt = `你是一位资深小说总主编。请基于作品简介、项目总纲、已写章节进度与剧情摘要，输出客观、精准、可落地的【全书宏观健康度诊断报告】。
【铁律】：严格依据提供的真实数据诊断，点名具体章节号与总纲阶段，严禁空泛套话。
${SCORING_RUBRIC}
仅输出合法 JSON，严禁输出 Markdown 代码块或任何多余文字：
{
  "overallScore": "<0-100整数>",
  "summary": "<100字以内全书当前状态总评>",
  "progressDiagnosis": "<字数进度与剧情推进是否匹配的具体评估（指出是否存在前期拖沓/推进过快/偏离总纲）>",
  "dimensions": [
    { "name": "主线聚焦度", "score": "<0-100整数>", "comment": "<简短评语>" },
    { "name": "节奏把控", "score": "<0-100整数>", "comment": "<简短评语>" },
    { "name": "大纲契合度", "score": "<0-100整数>", "comment": "<简短评语>" },
    { "name": "悬念与钩子", "score": "<0-100整数>", "comment": "<简短评语>" },
    { "name": "完本潜力", "score": "<0-100整数>", "comment": "<简短评语>" }
  ],
  "strengths": ["<核心亮点>"],
  "risks": ["<核心风险预警>"],
  "suggestions": [
    { "title": "<建议标题>", "chapterId": null, "chapterNumber": null, "detail": "<具体可执行的修改或后续推进建议>" }
  ]
}`;

      userPrompt = `书名：《${work.title}》（题材：${work.tag || "通用小说"}）
目标规模：预计 ${expectedWords} 字 / ${expectedChapters} 章 | 当前实际：${totalWords} 字（进度约 ${progressPct}%），已有正文 ${writtenChapters.length} 章${emptyChapterCount > 0 ? `（另有 ${emptyChapterCount} 章为空白草稿）` : ""}
作品简介：${work.description || "暂无简介"}

【项目总纲树】：
${masterOutlineText || "暂未设置项目总纲"}

【大纲故事轴摘要】：
${outlineDigest || "暂无大纲卡片"}

【已写章节摘要与字数分布】：
${chapterDigest || "暂无已写章节内容"}

请直接输出全书宏观分析 JSON：`;
    }
    // =========================================================================
    // 模式 2：区间 / 节点模块分析 (chapter_range)
    // =========================================================================
    else if (analysisType === "chapter_range") {
      const startCh = Math.max(1, Number(body.startChapter) || 1);
      const endCh = Math.max(startCh, Number(body.endChapter) || startCh);
      const expectedGoal = String(body.expectedGoal || "").trim();

      const targetChapters = await fetchRangeChapters(startCh, endCh, 10);

      if (targetChapters.length === 0) {
        return NextResponse.json({ success: false, message: `未找到第 ${startCh} 章到第 ${endCh} 章的正文内容` }, { status: 400 });
      }

      scopeLabel = startCh === endCh ? `第 ${startCh} 章模块分析` : `第 ${startCh}~${endCh} 章模块分析`;
      scopeParams = { startChapter: startCh, endChapter: endCh, expectedGoal };

      const perChapterLimit = targetChapters.length <= 4 ? 2600 : 1400;
      const chaptersText = targetChapters
        .map((c) => {
          const raw = (c.content || "").trim();
          const bodySnippet =
            raw.length > perChapterLimit
              ? `${raw.slice(0, Math.round(perChapterLimit * 0.65))}\n...（中段略）...\n${raw.slice(-Math.round(perChapterLimit * 0.35))}`
              : raw || "（本章暂无正文）";
          return `=== 第${c.chapterNumber}章《${c.title}》(chapterId:${c.id}, ${c.wordCount || 0}字) ===\n${bodySnippet}`;
        })
        .join("\n\n");

      systemPrompt = `你是一位顶级网文剧情主编。请对作者指定的【章节区间】进行深度模块评分、逐章节奏诊断、伏笔追踪与具体改稿建议。
【铁律】：
1. 每条逐章评价与修改建议必须严格对应真实的 chapterId 与 chapterNumber。
2. 伏笔追踪必须基于正文实际出现的线索，严禁凭空编造。
${SCORING_RUBRIC}
仅输出合法 JSON，严禁输出 Markdown 代码块或多余文字：
{
  "overallScore": "<0-100整数>",
  "summary": "<本区间剧情整体表现评价（80字以内）>",
  "goalAchievement": "<若作者提供了预期目标，评估达成情况与偏差；若未提供则评价本段核心叙事功能>",
  "dimensions": [
    { "name": "节奏紧凑度", "score": "<0-100整数>", "comment": "<简评>" },
    { "name": "冲突张力", "score": "<0-100整数>", "comment": "<简评>" },
    { "name": "章末钩子", "score": "<0-100整数>", "comment": "<简评>" },
    { "name": "情绪起伏", "score": "<0-100整数>", "comment": "<简评>" },
    { "name": "伏笔衔接", "score": "<0-100整数>", "comment": "<简评>" }
  ],
  "chapterPacing": [
    { "chapterId": 1, "chapterNumber": 1, "title": "<章节标题>", "pacingTag": "铺垫/起势/高潮/略平/仓促", "score": "<0-100整数>", "note": "<一句话节奏诊断>" }
  ],
  "foreshadowing": {
    "planted": [{ "chapterNumber": 1, "clue": "<新埋伏笔说明>" }],
    "resolved": [{ "chapterNumber": 3, "clue": "<已回收伏笔说明>" }],
    "forgotten": [{ "chapterNumber": 1, "clue": "<疑似落下/断线未呼应的伏笔与建议>" }]
  },
  "suggestions": [
    { "chapterId": 1, "chapterNumber": 1, "title": "<优化点标题>", "detail": "<精准问题定位与具体改法>" }
  ]
}`;

      userPrompt = `作品：《${work.title}》（题材：${work.tag || "通用小说"}）
${masterOutlineText ? `【项目总纲参考】：\n${masterOutlineText.slice(0, 900)}\n` : ""}${expectedGoal ? `【作者对本区间的预期目标】：${expectedGoal}\n` : ""}
【待分析章节内容（共 ${targetChapters.length} 章）】：
${chaptersText}

请直接输出模块分析 JSON：`;
    }
    // =========================================================================
    // 模式 3：逻辑与设定冲突审查 (logic_audit)
    // =========================================================================
    else if (analysisType === "logic_audit") {
      const startCh = Math.max(1, Number(body.startChapter) || 1);
      const endCh = Math.max(startCh, Number(body.endChapter) || Math.min(startCh + 4, chapterMetaList.length || startCh));

      const targetChapters = await fetchRangeChapters(startCh, endCh, 8);

      if (targetChapters.length === 0) {
        return NextResponse.json({ success: false, message: "所选区间没有可审查的章节正文" }, { status: 400 });
      }

      const [rulesList, itemsList, factionsList, timelineList] = await Promise.all([
        db.select().from(worldRules).where(eq(worldRules.workId, workId)).limit(8).all(),
        db.select().from(items).where(eq(items.workId, workId)).limit(8).all(),
        db.select().from(factions).where(eq(factions.workId, workId)).limit(6).all(),
        db.select().from(timelineEvents).where(eq(timelineEvents.workId, workId)).limit(12).all(),
      ]);

      scopeLabel = `第 ${startCh}~${endCh} 章逻辑审查`;
      scopeParams = { startChapter: startCh, endChapter: endCh };

      let loreText = "";
      if (rulesList.length > 0) {
        loreText += "【世界观法则与禁忌】：\n" + rulesList.map((r) => `- ${r.name}: 机制[${stripHtml(r.mechanisms).slice(0, 200) || "无"}] 禁忌[${r.taboos || "无"}]`).join("\n") + "\n\n";
      }
      if (itemsList.length > 0) {
        loreText += "【道具法宝限制】：\n" + itemsList.map((i) => `- ${i.name}: 效果[${i.effects || "无"}] 代价[${i.drawbacks || "无"}]`).join("\n") + "\n\n";
      }
      if (factionsList.length > 0) {
        loreText += "【势力立场】：\n" + factionsList.map((f) => `- ${f.name}: 立场[${f.alignment || "中立"}] 宗旨[${f.doctrine || "无"}]`).join("\n") + "\n\n";
      }
      if (timelineList.length > 0) {
        loreText += "【时间线大事记】：\n" + timelineList.map((t) => `- [${t.timePoint}] ${t.title}: ${(t.description || "").slice(0, 60)}`).join("\n") + "\n\n";
      }

      // 采用首尾采样覆盖全章（避免漏掉后半章漏洞）
      const perLimit = targetChapters.length <= 4 ? 2600 : 1500;
      const chaptersText = targetChapters
        .map((c) => {
          const raw = (c.content || "").trim();
          const bodySnippet =
            raw.length > perLimit
              ? `${raw.slice(0, Math.round(perLimit * 0.6))}\n...（中段略）...\n${raw.slice(-Math.round(perLimit * 0.4))}`
              : raw || "（本章暂无正文）";
          return `=== 第${c.chapterNumber}章《${c.title}》(chapterId:${c.id}) ===\n${bodySnippet}`;
        })
        .join("\n\n");

      systemPrompt = `你是一位极度严谨的小说逻辑审计专家。请交叉比对【世界观设定/时间线】与【章节正文】，排查规则体系违背、时间线/空间错乱、信息差漏洞与因果断层。
【铁律】：
1. 必须实事求是，若某方面自洽良好则明确说明，issues 可为空数组 []，绝不为了凑条数硬编漏洞。
2. 每条问题必须同时指出【正文具体章节(chapterId/chapterNumber)】与【冲突依据（违背了哪条设定或前文哪处事实）】。
3. severity 仅允许取 "high"（严重硬伤）、"medium"（明显瑕疵）、"low"（细节提醒）。
${SCORING_RUBRIC}
仅输出合法 JSON，严禁 Markdown 代码块：
{
  "overallScore": "<0-100整数>",
  "summary": "<逻辑自洽度总体结论>",
  "issues": [
    {
      "severity": "high | medium | low",
      "category": "世界观冲突 | 时间线漏洞 | 信息差 | 因果断层",
      "chapterId": 1,
      "chapterNumber": 1,
      "title": "<问题简述>",
      "evidence": "<正文中出现的具体矛盾点与违背的设定依据>",
      "fixSuggestion": "<具体修复改法>"
    }
  ],
  "passedChecks": ["<自洽良好的维度说明>"]
}`;

      userPrompt = `作品：《${work.title}》
${loreText || "【设定库】：暂无额外世界观条目，请重点检查章节前后自身逻辑与因果自洽。\n"}
【待审查章节】：
${chaptersText}

请直接输出逻辑审查 JSON：`;
    }
    // =========================================================================
    // 模式 4：人物性格与弧光 OOC 分析 (character_audit)
    // =========================================================================
    else if (analysisType === "character_audit") {
      const charIds: number[] = Array.isArray(body.characterIds)
        ? body.characterIds.map(Number).filter((n: number) => !isNaN(n) && n > 0).slice(0, 3)
        : [];
      const startCh = Math.max(1, Number(body.startChapter) || 1);
      const endCh = Math.max(startCh, Number(body.endChapter) || Math.min(startCh + 9, chapterMetaList.length || startCh));

      const targetChars =
        charIds.length > 0
          ? await db.select().from(characters).where(and(eq(characters.workId, workId), inArray(characters.id, charIds))).all()
          : await db.select().from(characters).where(eq(characters.workId, workId)).limit(3).all();

      if (targetChars.length === 0) {
        return NextResponse.json({ success: false, message: "请先在「世界/知识库 - 角色」中建立角色档案" }, { status: 400 });
      }

      const targetChapters = await fetchRangeChapters(startCh, endCh, 12);

      if (targetChapters.length === 0) {
        return NextResponse.json({ success: false, message: "所选区间没有可分析的章节正文" }, { status: 400 });
      }

      const charNames = targetChars.map((c) => c.name);
      scopeLabel = `人物分析：${charNames.join(" / ")}（第${startCh}~${endCh}章）`;
      scopeParams = { characterIds: targetChars.map((c) => c.id), startChapter: startCh, endChapter: endCh };

      const relationsList = await db.select().from(characterRelations).where(eq(characterRelations.workId, workId)).all();
      const relevantRelations = relationsList.filter(
        (r) => charNames.includes(r.sourceCharName) || charNames.includes(r.targetCharName)
      );

      // 精准按角色名抽取相关段落（含前后 1 段对话上下文）
      const mentionStats: Record<string, number> = {};
      charNames.forEach((n) => (mentionStats[n] = 0));

      const excerptBlocks = targetChapters
        .map((c) => {
          const text = c.content || "";
          charNames.forEach((n) => {
            const count = text.split(n).length - 1;
            mentionStats[n] += count;
          });
          const excerpt = extractCharacterExcerpts(text, charNames, 1300);
          return excerpt ? `=== 第${c.chapterNumber}章《${c.title}》(chapterId:${c.id}) ===\n${excerpt}` : "";
        })
        .filter(Boolean)
        .join("\n\n");

      const charProfiles = targetChars
        .map(
          (c) =>
            `- 【${c.name}】(${c.identity || c.roleType || "角色"}): 性格[${c.personality || "未填"}] | 能力[${c.abilities || "无"}] | 成长弧光[${c.characterArc || "未设"}] | 经历/特点[${(c.description || c.experiences || "无").slice(0, 120)}] | 本区间提及约 ${mentionStats[c.name]} 次`
        )
        .join("\n");

      const relText =
        relevantRelations.length > 0
          ? relevantRelations.map((r) => `- ${r.sourceCharName} ➔ ${r.targetCharName}：${r.relationType}（${r.description || ""}）`).join("\n")
          : "暂无显式关系图谱记录";

      systemPrompt = `你是一位擅长人物塑造与防 OOC 的资深小说编辑。请对照【角色档案与关系】与【章节出场片段】，对选定角色进行性格一致性（OOC 风险）、成长弧光与对白辨识度深度诊断。
【铁律】：必须基于实际出场言行评价，若角色在区间内戏份极少请如实指出，oocIssues 无问题可为空数组 []，严禁瞎编。
${SCORING_RUBRIC}
仅输出合法 JSON，严禁 Markdown 代码块：
{
  "overallScore": "<0-100整数>",
  "summary": "<人物塑造总体结论（80字以内）>",
  "characterReports": [
    {
      "name": "<角色名>",
      "consistencyScore": "<0-100整数>",
      "oocRisk": "低 | 中 | 高",
      "arcProgress": "<本区间内角色心理/立场/能力的成长变化评价>",
      "highlights": ["<高光表现或立住人设的细节>"],
      "oocIssues": [
        { "chapterId": 1, "chapterNumber": 1, "detail": "<具体的性格偏差/工具人行为说明>", "suggestion": "<对白或动作强化建议>" }
      ]
    }
  ]
}`;

      userPrompt = `作品：《${work.title}》
【待审计角色档案】：
${charProfiles}

【角色关系参考】：
${relText}

【第 ${startCh}~${endCh} 章中涉及上述角色的出场片段】：
${excerptBlocks || "（上述角色在所选章节正文中几乎未出现）"}

请直接输出人物性格分析 JSON：`;
    } else {
      return NextResponse.json({ success: false, message: `未知的分析类型: ${analysisType}` }, { status: 400 });
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const rawAi = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.3,
      maxTokens: 6144,
    });

    let parsed = parseStructuredJson<any>(rawAi, null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.3,
          maxTokens: 5120,
        });
        parsed = parseStructuredJson<any>(retryRaw, null);
      } catch {}
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ success: false, message: "AI 分析结果解析失败，请重试" }, { status: 500 });
    }

    const rawScoreMatch = String(parsed.overallScore ?? "").match(/\d+/);
    const overallScore = Math.max(0, Math.min(100, rawScoreMatch ? Number(rawScoreMatch[0]) : 0));
    const now = Date.now();

    const insertRes: any = await env.DB.prepare(
      `INSERT INTO ai_analysis_reports (work_id, user_id, analysis_type, scope_label, scope_params_json, overall_score, report_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(workId, user.userId, analysisType, scopeLabel, JSON.stringify(scopeParams), overallScore, JSON.stringify(parsed), now)
      .run();

    const insertedId = insertRes?.meta?.last_row_id || now;

    return NextResponse.json({
      success: true,
      result: {
        id: insertedId,
        workId,
        analysisType,
        scopeLabel,
        scopeParams,
        overallScore,
        report: parsed,
        createdAt: now,
      },
      message: "AI 分析完成",
    });
  } catch (error: any) {
    console.error("[API /api/ai/analysis POST] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "AI 分析服务异常" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));
    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch {}
    }
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await env.DB.prepare("DELETE FROM ai_analysis_reports WHERE id = ? AND user_id = ?").bind(id, user.userId).run();
    return NextResponse.json({ success: true, message: "已删除分析报告" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除失败" }, { status: 500 });
  }
});
