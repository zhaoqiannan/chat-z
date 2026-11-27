// API: Tab 3 剧情推演闭环引擎（联动 Tab 1 项目总纲节点+下级大纲 & Tab 2 章节大纲进度，生成多套纯文本走向方案，仅覆盖保留最新一次快照）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, outlines, chapters, characters, worldRules, materials } from "@/db";
import { eq, and, asc, desc, gte, lte } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";
import { stripHtml, parseChapterRange } from "@/utils/text";

function buildContentExcerpt(raw?: string | null, headLen = 450, tailLen = 550): string {
  const clean = (raw || "").trim();
  if (!clean) return "";
  if (clean.length <= headLen + tailLen + 60) return clean;
  return `${clean.slice(0, headLen)}\n……（中段略）……\n${clean.slice(-tailLen)}`;
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

function findNextSiblingNode(node: any, targetId: string): any | null {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) return null;
  const idx = node.children.findIndex((c: any) => String(c?.id) === String(targetId));
  if (idx !== -1) {
    return node.children[idx + 1] || null;
  }
  for (const c of node.children) {
    const found = findNextSiblingNode(c, targetId);
    if (found) return found;
  }
  return null;
}

function flattenMasterNodes(node: any, depth = 0, out: any[] = []): any[] {
  if (!node || typeof node !== "object") return out;
  out.push({
    id: String(node.id),
    title: String(node.title || "未命名节点"),
    tag: node.tag ? String(node.tag) : "",
    note: node.note ? String(node.note) : "",
    chapterRange: node.chapterRange ? String(node.chapterRange).trim() : "",
    status: node.status || "planned",
    depth,
    childCount: Array.isArray(node.children) ? node.children.length : 0,
  });
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      flattenMasterNodes(c, depth + 1, out);
    }
  }
  return out;
}

function serializeSubtree(node: any, depth = 0, indexLabel = ""): string {
  if (!node || typeof node !== "object") return "";
  const indent = "  ".repeat(depth);
  const meta: string[] = [];
  if (node.tag) meta.push(String(node.tag));
  if (node.chapterRange) meta.push(`关联第${node.chapterRange}章`);
  const metaStr = meta.length > 0 ? ` [${meta.join(" | ")}]` : "";
  const noteStr = node.note ? `：${String(node.note).trim()}` : "：（未填要点）";
  const prefix = indexLabel ? `${indexLabel}. ` : "";
  let line = `${indent}- ${prefix}${node.title || "未命名节点"}${metaStr}${noteStr}\n`;
  if (Array.isArray(node.children) && node.children.length > 0) {
    node.children.forEach((child: any, idx: number) => {
      const nextLabel = indexLabel ? `${indexLabel}.${idx + 1}` : `${idx + 1}`;
      line += serializeSubtree(child, depth + 1, nextLabel);
    });
  }
  return line;
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const requestedNodeId = searchParams.get("nodeId") || "";

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

    const [masterRow, chapterOutlineRows, chapterRows, snapshotRows] = await Promise.all([
      env.DB.prepare("SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1")
        .bind(workId, user.userId)
        .first()
        .catch(() => null),
      db
        .select()
        .from(outlines)
        .where(and(eq(outlines.workId, workId), eq(outlines.category, "chapter")))
        .orderBy(asc(outlines.chapterNumber), asc(outlines.orderIndex), asc(outlines.id))
        .all(),
      db
        .select({
          id: chapters.id,
          volumeId: chapters.volumeId,
          isVolume: chapters.isVolume,
          title: chapters.title,
          chapterNumber: chapters.chapterNumber,
          wordCount: chapters.wordCount,
          status: chapters.status,
          summary: chapters.summary,
        })
        .from(chapters)
        .where(eq(chapters.workId, workId))
        .orderBy(desc(chapters.isVolume), asc(chapters.chapterNumber), asc(chapters.createdAt))
        .all(),
      env.DB.prepare(
        "SELECT master_node_id, snapshot_json, updated_at FROM master_node_deduction_snapshots WHERE work_id = ? AND user_id = ?"
      )
        .bind(workId, user.userId)
        .all()
        .catch(() => ({ results: [] })),
    ]);

    let tree: any = null;
    if (masterRow && (masterRow as any).tree_json) {
      try {
        tree = JSON.parse((masterRow as any).tree_json);
      } catch { }
    }

    const snapshotMap = new Map<string, any>();
    for (const r of (snapshotRows as any)?.results || []) {
      try {
        snapshotMap.set(String(r.master_node_id), JSON.parse(r.snapshot_json));
      } catch { }
    }

    // 合并 Tab 2 章节大纲与章节表，构建按 chapterNumber 索引的每章进度与内容
    const normalChapters = chapterRows.filter((c) => c.isVolume === 0);
    const volumes = chapterRows.filter((c) => c.isVolume === 1).map((v) => ({ id: v.id, title: v.title }));

    const chapterProgressByNum = new Map<
      number,
      {
        chapterNumber: number;
        chapterId: number | null;
        title: string;
        outlineText: string;
        twist?: string;
        suspense?: string;
        wordCount: number;
        hasOutline: boolean;
        hasProse: boolean;
      }
    >();

    for (const ch of normalChapters) {
      const num = Number(ch.chapterNumber || 0);
      if (!num) continue;
      chapterProgressByNum.set(num, {
        chapterNumber: num,
        chapterId: ch.id,
        title: ch.title || `第 ${num} 章`,
        outlineText: (ch.summary || "").trim(),
        wordCount: ch.wordCount || 0,
        hasOutline: Boolean(ch.summary?.trim()),
        hasProse: (ch.wordCount || 0) >= 200,
      });
    }

    for (const ol of chapterOutlineRows) {
      const num = Number(ol.chapterNumber || 0);
      if (!num) continue;
      const outlineText = [ol.summary, ol.event || ol.content, ol.nextGoal ? `后续目标：${ol.nextGoal}` : ""]
        .filter((s) => s && String(s).trim())
        .join(" ")
        .trim();
      const prev = chapterProgressByNum.get(num);
      chapterProgressByNum.set(num, {
        chapterNumber: num,
        chapterId: ol.chapterId || prev?.chapterId || null,
        title: ol.title || prev?.title || `第 ${num} 章`,
        outlineText: outlineText || prev?.outlineText || "",
        twist: ol.twist || undefined,
        suspense: ol.suspense || undefined,
        wordCount: prev?.wordCount || 0,
        hasOutline: true,
        hasProse: prev?.hasProse || false,
      });
    }

    const allKnownChapterNums = Array.from(chapterProgressByNum.keys()).sort((a, b) => a - b);
    const maxKnownChapter = allKnownChapterNums.length > 0 ? allKnownChapterNums[allKnownChapterNums.length - 1] : 0;

    // 整理项目总纲可选节点列表及各节点章节完成度
    const flatNodes = tree ? flattenMasterNodes(tree) : [];
    const enrichedMasterNodes = flatNodes.map((n) => {
      const parsed = parseChapterRange(n.chapterRange);
      const writtenNums: number[] = [];
      const missingNums: number[] = [];
      if (parsed) {
        const capEnd = Math.min(parsed.end, parsed.start + 60);
        for (let num = parsed.start; num <= capEnd; num++) {
          const info = chapterProgressByNum.get(num);
          if (info && (info.hasOutline || info.hasProse)) {
            writtenNums.push(num);
          } else {
            missingNums.push(num);
          }
        }
      }
      return {
        ...n,
        parsedRange: parsed,
        writtenCount: writtenNums.length,
        totalPlannedCount: parsed ? Math.min(parsed.end, parsed.start + 60) - parsed.start + 1 : 0,
        missingChapters: missingNums,
        hasSnapshot: snapshotMap.has(n.id),
      };
    });

    // 决定默认选中的节点：优先 requestedNodeId -> 第一个带关联章节且有未写章节的节点 -> 第一个带关联章节的节点 -> 第一个非根节点
    let selectedNodeId = requestedNodeId;
    if (!selectedNodeId || !enrichedMasterNodes.some((n) => n.id === selectedNodeId)) {
      const firstUnfinished = enrichedMasterNodes.find((n) => n.parsedRange && n.missingChapters.length > 0);
      const firstWithRange = enrichedMasterNodes.find((n) => n.parsedRange);
      const firstNonRoot = enrichedMasterNodes.find((n) => n.depth > 0);
      selectedNodeId = firstUnfinished?.id || firstWithRange?.id || firstNonRoot?.id || enrichedMasterNodes[0]?.id || "";
    }

    const targetNode = tree && selectedNodeId ? findMasterNode(tree, selectedNodeId) : null;
    const selectedMeta = enrichedMasterNodes.find((n) => n.id === selectedNodeId) || null;

    // 计算当前节点的已写大纲与前序衔接大纲
    const inRangeOutlines: any[] = [];
    const precedingOutlines: any[] = [];
    let suggestedStart = maxKnownChapter + 1;
    let suggestedEnd = maxKnownChapter + 3;

    if (selectedMeta?.parsedRange) {
      const { start, end } = selectedMeta.parsedRange;
      for (let num = start; num <= Math.min(end, start + 60); num++) {
        const info = chapterProgressByNum.get(num);
        if (info && (info.hasOutline || info.hasProse)) {
          inRangeOutlines.push(info);
        }
      }

      if (selectedMeta.missingChapters.length > 0) {
        suggestedStart = selectedMeta.missingChapters[0];
        suggestedEnd = selectedMeta.missingChapters[selectedMeta.missingChapters.length - 1];
      } else {
        suggestedStart = start;
        suggestedEnd = end;
      }

      // 抓取待推演起始章之前的最近 3 章 Tab 2 大纲，便于承接上文
      const beforeNums = allKnownChapterNums.filter((n) => n < suggestedStart).slice(-3);
      beforeNums.forEach((n) => {
        const info = chapterProgressByNum.get(n);
        if (info) precedingOutlines.push(info);
      });
    } else {
      const recentNums = allKnownChapterNums.slice(-3);
      recentNums.forEach((n) => {
        const info = chapterProgressByNum.get(n);
        if (info) precedingOutlines.push(info);
      });
    }

    return NextResponse.json({
      success: true,
      result: {
        masterNodes: enrichedMasterNodes,
        selectedNodeId,
        targetNode,
        suggestedRange: { start: suggestedStart, end: Math.min(suggestedEnd, suggestedStart + 14) },
        inRangeOutlines,
        precedingOutlines,
        volumes,
        existingChapters: normalChapters.map((c) => ({
          id: c.id,
          chapterNumber: c.chapterNumber || 0,
          title: c.title,
          wordCount: c.wordCount || 0,
          volumeId: c.volumeId,
        })),
        snapshot: selectedNodeId ? snapshotMap.get(selectedNodeId) || null : null,
      },
    });
  } catch (error: any) {
    console.error("[API /api/ai/plot-deduction/plan GET] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取推演上下文失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const nodeId = String(body.nodeId || "").trim();
    const chapterStart = Math.max(1, Number(body.chapterStart) || 1);
    const chapterEnd = Math.max(chapterStart, Math.min(chapterStart + 9, Number(body.chapterEnd) || chapterStart));
    const preference = String(body.preference || "").trim();

    if (!workId || isNaN(workId) || !nodeId) {
      return NextResponse.json({ success: false, message: "缺少作品或总纲节点参数" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    const [masterRow, chapterOutlineRows, chapterRows, prevChapterContentRow, inRangeChapterContentRows, charList, ruleList, existingSnapRow, materialList] = await Promise.all([
      env.DB.prepare("SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1")
        .bind(workId, user.userId)
        .first()
        .catch(() => null),
      db
        .select()
        .from(outlines)
        .where(and(eq(outlines.workId, workId), eq(outlines.category, "chapter")))
        .orderBy(asc(outlines.chapterNumber), asc(outlines.id))
        .all(),
      // 仅查询章节元数据与摘要，避免把全书正文拉入 Worker 内存
      db
        .select({
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          summary: chapters.summary,
          wordCount: chapters.wordCount,
        })
        .from(chapters)
        .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0)))
        .orderBy(asc(chapters.chapterNumber))
        .all(),
      chapterStart > 1
        ? db
          .select({ chapterNumber: chapters.chapterNumber, title: chapters.title, summary: chapters.summary, content: chapters.content })
          .from(chapters)
          .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0), eq(chapters.chapterNumber, chapterStart - 1)))
          .limit(1)
          .get()
        : Promise.resolve(null),
      // 读取本次待规划区间内已有正文的章节，避免无视当前章节已写剧情
      db
        .select({
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          summary: chapters.summary,
          content: chapters.content,
          wordCount: chapters.wordCount,
        })
        .from(chapters)
        .where(
          and(
            eq(chapters.workId, workId),
            eq(chapters.isVolume, 0),
            gte(chapters.chapterNumber, chapterStart),
            lte(chapters.chapterNumber, chapterEnd)
          )
        )
        .orderBy(asc(chapters.chapterNumber))
        .all(),
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
      db
        .select({ title: materials.title, aiSummary: materials.aiSummary, extractedLore: materials.extractedLore, content: materials.content })
        .from(materials)
        .where(and(eq(materials.workId, workId), eq(materials.includeInAiContext, 1)))
        .limit(5)
        .all(),
    ]);

    let parsedMasterTree: any = null;
    if (masterRow && (masterRow as any).tree_json) {
      try {
        parsedMasterTree = JSON.parse((masterRow as any).tree_json);
      } catch { }
    }

    let targetNode: any = body.targetNode || null;
    if (!targetNode && parsedMasterTree) {
      targetNode = findMasterNode(parsedMasterTree, nodeId);
    }
    if (!targetNode) {
      return NextResponse.json({ success: false, message: "未找到对应的项目总纲节点" }, { status: 404 });
    }

    const nextSiblingNode = parsedMasterTree ? findNextSiblingNode(parsedMasterTree, nodeId) : null;
    const nextAnchorText = nextSiblingNode
      ? `${nextSiblingNode.title}${nextSiblingNode.chapterRange ? `（关联第${nextSiblingNode.chapterRange}章）` : ""}：${(nextSiblingNode.note || "").slice(0, 180)}`
      : "";

    // 读取上一章（chapterStart - 1）的正文：若未提取大纲，取前中段+完整结尾 1200 字；若已提取大纲，也保留完整结尾 1100 字确保精准承接
    const prevChapterRawContent = (prevChapterContentRow?.content || "").trim();
    const prevChapterExcerpt = prevChapterRawContent
      ? buildContentExcerpt(prevChapterRawContent, 500, 1100)
      : "";

    // 汇总已有章节大纲（优先「3. 章节大纲」提取结果，补充章节表摘要）
    const outlineByNum = new Map<number, string>();
    for (const ch of chapterRows) {
      const n = Number(ch.chapterNumber || 0);
      if (n > 0 && ch.summary?.trim()) {
        outlineByNum.set(n, `第${n}章《${ch.title}》：${ch.summary.trim()}`);
      }
    }
    for (const ol of chapterOutlineRows) {
      const n = Number(ol.chapterNumber || 0);
      if (n <= 0) continue;
      const parts = [
        ol.summary || ol.event || ol.content || "",
        ol.twist ? `转折：${ol.twist}` : "",
        ol.suspense ? `伏笔：${ol.suspense}` : "",
        ol.nextGoal ? `后续推进：${ol.nextGoal}` : "",
      ]
        .filter((s) => s && String(s).trim())
        .join("；");
      outlineByNum.set(n, `第${n}章《${ol.title}》：${parts || "（已有章节大纲）"}`);
    }

    const recentBeforeNums = Array.from(outlineByNum.keys())
      .filter((n) => n < chapterStart)
      .sort((a, b) => a - b)
      .slice(-5);
    const recentProgressText = recentBeforeNums.map((n) => outlineByNum.get(n)).join("\n");

    // 汇总本次规划区间内已有剧情（合并已有大纲 + 已写正文片段，避免规划时忽略当前章节已写内容）
    const inRangeContentMap = new Map<number, { title: string; content: string; wordCount: number; summary: string }>();
    for (const ch of inRangeChapterContentRows) {
      const n = Number(ch.chapterNumber || 0);
      const cleanContent = (ch.content || "").trim();
      if (n > 0 && (cleanContent || ch.summary?.trim())) {
        inRangeContentMap.set(n, {
          title: ch.title || `第${n}章`,
          content: cleanContent,
          wordCount: ch.wordCount || cleanContent.replace(/\s+/g, "").length,
          summary: (ch.summary || "").trim(),
        });
      }
    }
    const inRangeExistingParts: string[] = [];
    for (let n = chapterStart; n <= chapterEnd; n++) {
      const olText = outlineByNum.get(n);
      const chInfo = inRangeContentMap.get(n);
      if (!olText && !chInfo) continue;
      const lines: string[] = [];
      lines.push(`- 第${n}章《${chInfo?.title || `第${n}章`}》${chInfo?.wordCount ? `（已有正文约 ${chInfo.wordCount} 字）` : ""}`);
      if (olText) lines.push(`  已有章节大纲：${olText}`);
      if (chInfo?.content) {
        const perCapHead = chapterEnd - chapterStart >= 4 ? 260 : 420;
        const perCapTail = chapterEnd - chapterStart >= 4 ? 320 : 480;
        lines.push(`  已有正文片段：\n${buildContentExcerpt(chInfo.content, perCapHead, perCapTail)}`);
      }
      inRangeExistingParts.push(lines.join("\n"));
    }
    const inRangeExistingText = inRangeExistingParts.join("\n\n");

    const chapterNumbersToPlan: number[] = [];
    for (let n = chapterStart; n <= chapterEnd; n++) {
      chapterNumbersToPlan.push(n);
    }

    const subtreeText = serializeSubtree(targetNode);
    const charText = charList
      .map((c) => `- ${c.name}（${c.identity || "角色"}）：性格[${c.personality || "未填"}] 能力[${c.abilities || "无"}]`)
      .join("\n");
    const ruleText = ruleList
      .map((r) => `- ${r.name}：${stripHtml(r.mechanisms).slice(0, 100)}${r.taboos ? `（禁忌：${r.taboos.slice(0, 50)}）` : ""}`)
      .join("\n");
    const materialText = materialList
      .map((m) => `- 《${m.title}》：${(m.extractedLore || m.aiSummary || stripHtml(m.content)).slice(0, 140)}`)
      .join("\n");

    const planCountTarget = chapterNumbersToPlan.length <= 2 ? "2~3 套" : "2 套";
    const wordsRangePerChapter = chapterNumbersToPlan.length <= 3 ? "320~460 字" : "240~340 字";

    const systemPrompt = `你是一位经验丰富的长篇小说剧情总策划。
作者已经在「项目总纲」中规划了某阶段节点及其下级子节点，并在「章节大纲」中积累了前序已写章节的剧情进度。
现在需要你针对**尚未写作的章节（第 ${chapterStart} 章至第 ${chapterEnd} 章，共 ${chapterNumbersToPlan.length} 章）**，结合总纲目标与已有剧情进度，生成 **${planCountTarget}差异化的纯文本章节走向方案**（如方案一稳健推进流、方案二冲突反转流）。

【核心策划铁律】：
1. **严格守住总纲硬锚点**：当前总纲节点及其下级子节点里已经明确写定的核心事件、人物转折与阶段目标属于**必经硬锚点**，必须在方案中完整落实；各套方案的差异体现在**切入方式、冲突引爆节奏、人物破局策略与暗线编排**上，严禁为了制造反转而把总纲设定改跑偏。
2. **严密承接上一章内容与结尾**：第 ${chapterStart} 章的开头必须精准承接上一章（第 ${chapterStart - 1} 章）结尾所停驻的**时间、地点、在场人物状态与未完悬念/对话**，严禁场景莫名跳脱，也严禁重复上一章已经演完的剧情；第 ${chapterEnd} 章收尾时要为下一阶段总纲节点自然铺好接口。
3. **尊重当前章节已有剧情**：如果待规划区间内某些章节**已经存在已写正文或章节大纲**，必须保留并顺延其已确立的关键剧情事实与人物状态，在其基础上完善、补全或衔接后续走向（除非作者在补充偏好中明确要求推翻重写），严禁无视当前章节已有剧情另起炉灶。
4. **纯文本大段走向（plotText）**：必须严格覆盖从第 ${chapterStart} 章到第 ${chapterEnd} 章的每一章。每章走向写为一整段流畅充实的纯文本（${wordsRangePerChapter}），像编剧分集故事大纲一样写明「紧承上一章结尾 ➔ 具体人名与场景事件 ➔ 冲突交锋与推进 ➔ 情绪落点与章末悬念钩子」，严禁空洞套话（如“剧情稳步推进”），严禁拆成零碎标签。
5. 仅输出合法 JSON，严禁输出 Markdown 代码块或多余解释：
{
  "progressSummary": "<用2~3句话概括前序章节走到了哪一步，以及第 ${chapterStart}~${chapterEnd} 章必须完成的总纲核心任务>",
  "plans": [
    {
      "id": "plan-1",
      "name": "<方案一名称>",
      "style": "<风格标签，如稳健递进/悬念暗线>",
      "overview": "<用60~100字概括本方案的核心策略差异与看点>",
      "chapters": [
        {
          "chapterNumber": ${chapterStart},
          "title": "<建议章节名，不含“第X章”前缀>",
          "plotText": "<一整段 ${wordsRangePerChapter} 连贯的纯文本剧情走向描述，可直接作为后续生成 3000+ 字正文的蓝本>"
        }
      ]
    }
  ]
}`;

    const userPrompt = `【作品信息】：《${work.title}》（题材：${work.tag || "小说"}）
作品简介：${work.description || "暂无"}

【1. 项目总纲目标节点及其下级子节点大纲（必须落实的硬锚点）】：
${subtreeText}${nextAnchorText ? `【下一阶段总纲出口锚点（供最后一章收尾衔接，切勿提前写爆）】：\n${nextAnchorText}\n\n` : ""}【前序已有章节大纲与当前进度】：
${recentProgressText || "（前序暂无已提取章节大纲，请优先依据下方上一章正文与总纲展开）"}
${prevChapterExcerpt ? `\n【上一章（第${chapterStart - 1}章《${prevChapterContentRow?.title || ""}》）正文与完整结尾（第 ${chapterStart} 章必须紧贴此处结尾场景/时间/人物状态无缝承接）】：\n${prevChapterExcerpt}\n` : ""}${inRangeExistingText ? `\n【本次规划区间内当前章节已有剧情与正文（必须尊重并融合既有剧情脉络，切勿无视已写内容推翻重来）】：\n${inRangeExistingText}\n` : ""}
${charText ? `【核心角色档案】：\n${charText}\n\n` : ""}${ruleText ? `【世界观法则】：\n${ruleText}\n\n` : ""}${materialText ? `【作者设定素材库】：\n${materialText}\n\n` : ""}【本次需规划的待写章节】：第 ${chapterStart} 章 至 第 ${chapterEnd} 章（共 ${chapterNumbersToPlan.length} 章）
${preference ? `【作者补充走向偏好】：${preference}\n` : ""}
请直接输出包含 ${planCountTarget} 完整纯文本走向方案的合法 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const hasCompletePlans = (obj: any) =>
      Boolean(
        obj &&
        Array.isArray(obj.plans) &&
        obj.plans.length > 0 &&
        obj.plans.some(
          (p: any) =>
            Array.isArray(p?.chapters) &&
            p.chapters.length >= chapterNumbersToPlan.length &&
            p.chapters.every((c: any) => String(c?.plotText || c?.content || c?.summary || "").trim().length >= 30)
        )
      );

    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.65,
      maxTokens: 8192,
    });

    let parsed = parseStructuredJson<any>(raw, null);
    if (!hasCompletePlans(parsed)) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.6,
          maxTokens: 8192,
        });
        const retryParsed = parseStructuredJson<any>(retryRaw, null);
        if (hasCompletePlans(retryParsed) || (!parsed && retryParsed?.plans?.length)) {
          parsed = retryParsed;
        }
      } catch { }
    }

    if (!parsed || !Array.isArray(parsed.plans) || parsed.plans.length === 0) {
      return NextResponse.json({ success: false, message: "AI 推演章节走向失败，请重试" }, { status: 500 });
    }

    const normalizedPlans = parsed.plans
      .filter((p: any) => p && typeof p === "object")
      .slice(0, 3)
      .map((p: any, pIdx: number) => {
        const rawChapters = Array.isArray(p.chapters) ? p.chapters : [];
        const chaptersList = chapterNumbersToPlan.map((chNum, cIdx) => {
          const matched =
            rawChapters.find((rc: any) => Number(rc?.chapterNumber) === chNum) || rawChapters[cIdx] || {};
          const rawTitle = String(matched.title || `待定章节 ${chNum}`)
            .replace(/^第\s*\d+\s*章[\s：:·-]*/i, "")
            .trim();
          return {
            chapterNumber: chNum,
            title: rawTitle || `剧情推进 ${chNum}`,
            plotText: String(matched.plotText || matched.content || matched.summary || "").trim(),
          };
        });

        return {
          id: String(p.id || `plan-${pIdx + 1}`),
          name: String(p.name || `方案${pIdx + 1}`).trim(),
          style: String(p.style || "剧情走向").trim(),
          overview: String(p.overview || "").trim(),
          chapters: chaptersList,
        };
      });

    let prevDrafts: Record<string, any> = {};
    if (existingSnapRow && (existingSnapRow as any).snapshot_json) {
      try {
        const prev = JSON.parse((existingSnapRow as any).snapshot_json);
        if (prev?.latestDrafts && typeof prev.latestDrafts === "object") {
          prevDrafts = prev.latestDrafts;
        }
      } catch { }
    }

    const now = Date.now();
    const snapshot = {
      nodeId,
      nodeTitle: String(targetNode.title || ""),
      chapterStart,
      chapterEnd,
      preference,
      progressSummary: String(parsed.progressSummary || "").trim(),
      plans: normalizedPlans,
      selectedPlanId: normalizedPlans[0]?.id || "plan-1",
      latestDrafts: prevDrafts,
      updatedAt: now,
    };

    await env.DB.prepare(
      `INSERT INTO master_node_deduction_snapshots (work_id, user_id, master_node_id, snapshot_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(work_id, master_node_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`
    )
      .bind(workId, user.userId, nodeId, JSON.stringify(snapshot), now)
      .run();

    return NextResponse.json({
      success: true,
      result: snapshot,
      message: "章节走向推演完成",
    });
  } catch (error: any) {
    console.error("[API /api/ai/plot-deduction/plan POST] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "章节走向推演异常" }, { status: 500 });
  }
});
