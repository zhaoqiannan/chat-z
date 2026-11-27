// API: 从已有章节正文/章节大纲一键反推映射为「项目总纲」层级节点树（支持单章挂载更新 & 全书/批量反推合并）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, outlines } from "@/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";
import { parseChapterRange } from "@/utils/text";

interface TreeNode {
  id: string;
  title: string;
  tag?: string;
  note?: string;
  chapterRange?: string;
  status?: "planned" | "in_progress" | "completed";
  children: TreeNode[];
}

function normalizeTreeNode(node: any, fallbackId: string): TreeNode {
  const childrenRaw = Array.isArray(node?.children) ? node.children : [];
  return {
    id: node?.id ? String(node.id) : fallbackId,
    title: String(node?.title || "未命名节点").trim(),
    tag: node?.tag ? String(node.tag).trim() : "",
    note: node?.note ? String(node.note).trim() : "",
    chapterRange: node?.chapterRange ? String(node.chapterRange).trim() : "",
    status: ["planned", "in_progress", "completed"].includes(node?.status) ? node.status : "completed",
    children: childrenRaw.map((child: any, idx: number) => normalizeTreeNode(child, `${fallbackId}-${idx + 1}`)),
  };
}

function countTreeNodes(node: TreeNode): number {
  return 1 + (node.children || []).reduce((sum, c) => sum + countTreeNodes(c), 0);
}

function updateChapterNodeInPlace(node: TreeNode, chNum: number, nextLeaf: TreeNode): boolean {
  const exactId = `ch-${chNum}`;
  const parsed = parseChapterRange(node.chapterRange);
  const isSameSingleChapter =
    node.id === exactId ||
    (node.id !== "root" && parsed !== null && parsed.start === chNum && parsed.end === chNum && node.children.length === 0);

  if (isSameSingleChapter) {
    node.title = nextLeaf.title;
    node.note = nextLeaf.note;
    node.tag = node.tag || nextLeaf.tag;
    node.chapterRange = String(chNum);
    node.status = "completed";
    return true;
  }

  for (const child of node.children) {
    if (updateChapterNodeInPlace(child, chNum, nextLeaf)) return true;
  }
  return false;
}

function findBestParentForChapter(root: TreeNode, chNum: number, volumeId: number | null, volumeTitle: string | null): TreeNode | null {
  let bestCovered: { node: TreeNode; span: number; depth: number } | null = null;
  let volumeMatch: TreeNode | null = null;

  const walk = (node: TreeNode, depth: number) => {
    if (node.id !== "root") {
      const parsed = parseChapterRange(node.chapterRange);
      if (parsed && chNum >= parsed.start && chNum <= parsed.end && !(parsed.start === chNum && parsed.end === chNum)) {
        const span = parsed.end - parsed.start;
        if (!bestCovered || span < bestCovered.span || (span === bestCovered.span && depth > bestCovered.depth)) {
          bestCovered = { node, span, depth };
        }
      }
      if (!volumeMatch && volumeId && (node.id === `vol-${volumeId}` || (volumeTitle && node.title.includes(volumeTitle)))) {
        volumeMatch = node;
      }
    }
    node.children.forEach((c) => walk(c, depth + 1));
  };

  walk(root, 0);
  if (bestCovered) return (bestCovered as { node: TreeNode }).node;
  return volumeMatch;
}

function insertChildSortedByChapter(parent: TreeNode, leaf: TreeNode, chNum: number) {
  const idx = parent.children.findIndex((c) => {
    const r = parseChapterRange(c.chapterRange);
    return r ? r.start > chNum : false;
  });
  if (idx === -1) parent.children.push(leaf);
  else parent.children.splice(idx, 0, leaf);

  // 扩展父节点的 chapterRange 以涵盖新章节
  const parentRange = parseChapterRange(parent.chapterRange);
  if (parentRange) {
    const nextStart = Math.min(parentRange.start, chNum);
    const nextEnd = Math.max(parentRange.end, chNum);
    parent.chapterRange = nextStart === nextEnd ? String(nextStart) : `${nextStart}-${nextEnd}`;
  }
}

function extractFuturePlannedNodes(existingTree: TreeNode | null, maxWrittenChapter: number): TreeNode[] {
  if (!existingTree || !Array.isArray(existingTree.children)) return [];
  return existingTree.children.filter((child) => {
    const r = parseChapterRange(child.chapterRange);
    if (r && r.start > maxWrittenChapter) return true;
    if (!r && child.status === "planned") return true;
    return false;
  });
}

async function saveMasterTree(envDb: any, workId: number, userId: string, tree: TreeNode) {
  const now = Date.now();
  await envDb
    .prepare(
      `INSERT INTO work_master_outlines (work_id, user_id, tree_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(work_id) DO UPDATE SET tree_json = excluded.tree_json, updated_at = excluded.updated_at`
    )
    .bind(workId, userId, JSON.stringify(tree), now)
    .run();
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody<{
      workId?: number | string;
      mode?: "single" | "all";
      chapterId?: number | string;
      mergeMode?: "merge" | "replace";
      autoSave?: boolean;
    }>(req);
    if (!parsedBody.ok) return parsedBody.response;

    const workId = Number(parsedBody.data.workId);
    const mode = parsedBody.data.mode === "single" ? "single" : "all";
    const mergeMode = parsedBody.data.mergeMode === "replace" ? "replace" : "merge";
    const autoSave = parsedBody.data.autoSave !== undefined ? Boolean(parsedBody.data.autoSave) : mode === "single";

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const existingMasterRow: any = await env.DB.prepare(
      "SELECT tree_json FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1"
    )
      .bind(workId, user.userId)
      .first()
      .catch(() => null);

    let existingTree: TreeNode | null = null;
    if (existingMasterRow?.tree_json) {
      try {
        existingTree = normalizeTreeNode(JSON.parse(existingMasterRow.tree_json), "root");
      } catch {}
    }

    // =========================================================================
    // 模式 1：单章反推映射至总纲树（优先复用已有章节大纲，必要时仅调用 1 次轻提取）
    // =========================================================================
    if (mode === "single") {
      const chapterId = Number(parsedBody.data.chapterId);
      if (!chapterId || isNaN(chapterId)) {
        return NextResponse.json({ success: false, message: "缺少有效的 chapterId" }, { status: 400 });
      }

      const [chapter, existingOutline, volumeList] = await Promise.all([
        db.select().from(chapters).where(and(eq(chapters.id, chapterId), eq(chapters.workId, workId))).get(),
        db.select().from(outlines).where(and(eq(outlines.workId, workId), eq(outlines.chapterId, chapterId))).get(),
        db.select({ id: chapters.id, title: chapters.title }).from(chapters).where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 1))).all(),
      ]);

      if (!chapter || chapter.isVolume === 1) {
        return NextResponse.json({ success: false, message: "未找到该正文章节" }, { status: 404 });
      }

      const chapterText = (chapter.content || "").trim();
      const chNum = Number(chapter.chapterNumber || 1);
      let leafTitle = existingOutline?.title || `第${chNum}章 · ${chapter.title}`;
      let leafNote = "";
      let chapterOutlineExtracted = false;

      if (existingOutline && chapter.outlineExtracted === 1 && (existingOutline.event || existingOutline.summary)) {
        leafNote = [
          existingOutline.event || existingOutline.summary || "",
          existingOutline.twist ? `转折：${existingOutline.twist}` : "",
          existingOutline.suspense ? `伏笔：${existingOutline.suspense}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      } else if (chapterText.length >= 20) {
        // 尚无最新章节大纲时，先提取 1 次并同步落库 outlines(category='chapter') + 标记 outline_extracted=1
        const excerpt =
          chapterText.length > 5600
            ? `${chapterText.slice(0, 3600)}\n\n……（中段略）……\n\n${chapterText.slice(-2000)}`
            : chapterText;

        const extractMessages: ChatMessage[] = [
          {
            role: "system",
            content: `你是严谨的小说编审。请根据单章正文提炼章节核心事件，供项目总纲节点树与后续推演衔接。
严禁输出废话套话，仅输出合法 JSON 对象：
{
  "title": "第${chNum}章 · <14字以内核心事件简称>",
  "event": "<100~200字具体剧情经过与章末落点>",
  "twist": "<核心冲突或转折，无则空字符串>",
  "nextGoal": "<结尾下一步行动目标>",
  "suspense": "<埋下伏笔或悬念，无则空字符串>"
}`,
          },
          { role: "user", content: `书名：《${work.title}》\n章节：第${chNum}章《${chapter.title}》\n\n${excerpt}` },
        ];

        const raw = await callCloudflareAi(env.AI, extractMessages, {
          taskType: "structured",
          temperature: 0.2,
          maxTokens: 2048,
        });
        const parsed = parseStructuredJson<any>(raw, null);
        const eventText = String(parsed?.event || parsed?.summary || chapter.summary || "").trim();
        if (!eventText) {
          return NextResponse.json({ success: false, message: "未能从本章正文提炼出有效剧情，请稍后重试" }, { status: 500 });
        }

        leafTitle = String(parsed?.title || `第${chNum}章 · ${chapter.title}`).trim();
        const twistText = String(parsed?.twist || "").trim();
        const nextGoalText = String(parsed?.nextGoal || "").trim();
        const suspenseText = String(parsed?.suspense || "").trim();
        leafNote = [eventText, twistText ? `转折：${twistText}` : "", suspenseText ? `伏笔：${suspenseText}` : ""]
          .filter(Boolean)
          .join("\n");

        const outlinePayload: any = {
          workId,
          category: "chapter",
          chapterId,
          chapterNumber: chNum,
          title: leafTitle,
          summary: eventText,
          event: eventText,
          twist: twistText,
          nextGoal: nextGoalText,
          suspense: suspenseText,
          content: eventText,
          status: "completed",
          isFromChapter: 1,
          type: "scene",
          wordCountEstimate: chapter.wordCount || chapterText.replace(/\s+/g, "").length,
          orderIndex: chNum,
          updatedAt: new Date(),
        };
        if (existingOutline) {
          await db.update(outlines).set(outlinePayload).where(eq(outlines.id, existingOutline.id));
        } else {
          await db.insert(outlines).values({ ...outlinePayload, createdAt: new Date() });
        }
        await env.DB.prepare(
          "UPDATE chapters SET outline_extracted = 1, summary = CASE WHEN summary IS NULL OR TRIM(summary) = '' THEN ? ELSE summary END, updated_at = ? WHERE id = ? AND work_id = ?"
        )
          .bind(eventText.slice(0, 500), Math.floor(Date.now() / 1000), chapterId, workId)
          .run();
        chapterOutlineExtracted = true;
      } else {
        return NextResponse.json({ success: false, message: "本章正文过短（不足 20 字），请先撰写内容后再反推" }, { status: 400 });
      }

      const tree: TreeNode = existingTree || {
        id: "root",
        title: work.title || "项目总纲",
        tag: "总纲",
        note: work.description || "",
        status: "in_progress",
        children: [],
      };

      const leafNode: TreeNode = {
        id: `ch-${chNum}`,
        title: leafTitle,
        tag: "章节",
        chapterRange: String(chNum),
        status: "completed",
        note: leafNote,
        children: [],
      };

      const updatedInPlace = updateChapterNodeInPlace(tree, chNum, leafNode);
      if (!updatedInPlace) {
        const vol = chapter.volumeId ? volumeList.find((v) => v.id === chapter.volumeId) : null;
        const parentNode = findBestParentForChapter(tree, chNum, chapter.volumeId ?? null, vol?.title || null);
        if (parentNode) {
          insertChildSortedByChapter(parentNode, leafNode, chNum);
        } else {
          const volNodeId = vol ? `vol-${vol.id}` : "vol-reversed";
          let container = tree.children.find((c) => c.id === volNodeId);
          if (!container) {
            container = {
              id: volNodeId,
              title: vol ? vol.title : "已写章节反推",
              tag: "分卷",
              chapterRange: String(chNum),
              status: "in_progress",
              note: vol ? `映射自章节目录分卷「${vol.title}」` : "由已有正文章节反推映射生成",
              children: [],
            };
            tree.children.push(container);
          }
          insertChildSortedByChapter(container, leafNode, chNum);
        }
      }

      if (autoSave) {
        await saveMasterTree(env.DB, workId, user.userId, tree);
      }

      return NextResponse.json({
        success: true,
        result: {
          tree,
          saved: autoSave,
          mappedChaptersCount: 1,
          nodeCount: countTreeNodes(tree),
          chapterOutlineExtracted,
        },
        message: `已将第 ${chNum} 章反推同步至项目总纲节点树！`,
      });
    }

    // =========================================================================
    // 模式 2：一键反推全书/已有章节为三层项目总纲节点树（分卷/阶段 -> 剧情弧 -> 章节细纲）
    // =========================================================================
    const [allChapterRows, chapterOutlines] = await Promise.all([
      db
        .select({
          id: chapters.id,
          volumeId: chapters.volumeId,
          isVolume: chapters.isVolume,
          chapterNumber: chapters.chapterNumber,
          title: chapters.title,
          subtitle: chapters.subtitle,
          summary: chapters.summary,
          wordCount: chapters.wordCount,
          contentHead: sql<string>`substr(${chapters.content}, 1, 260)`,
          contentTail: sql<string>`CASE WHEN length(${chapters.content}) > 520 THEN substr(${chapters.content}, -240) ELSE '' END`,
        })
        .from(chapters)
        .where(eq(chapters.workId, workId))
        .orderBy(asc(chapters.chapterNumber), asc(chapters.createdAt))
        .all(),
      db
        .select()
        .from(outlines)
        .where(and(eq(outlines.workId, workId), eq(outlines.category, "chapter")))
        .orderBy(asc(outlines.chapterNumber), asc(outlines.orderIndex))
        .all(),
    ]);

    const volumes = allChapterRows.filter((c) => c.isVolume === 1);
    const bodyChapters = allChapterRows
      .filter((c) => c.isVolume !== 1 && ((c.wordCount || 0) >= 20 || (c.contentHead || "").trim().length >= 20 || Boolean(c.summary?.trim())))
      .slice(0, 50);

    if (bodyChapters.length === 0) {
      return NextResponse.json({ success: false, message: "暂无包含有效正文或摘要的章节，请先撰写章节内容" }, { status: 400 });
    }

    const outlineByChapterId = new Map<number, (typeof chapterOutlines)[number]>();
    const outlineByChapterNum = new Map<number, (typeof chapterOutlines)[number]>();
    chapterOutlines.forEach((o) => {
      if (o.chapterId) outlineByChapterId.set(o.chapterId, o);
      if (o.chapterNumber) outlineByChapterNum.set(o.chapterNumber, o);
    });

    const volumeNameMap = new Map<number, string>();
    volumes.forEach((v) => volumeNameMap.set(v.id, v.title));

    const chapterDigestLines = bodyChapters.map((ch) => {
      const chNum = Number(ch.chapterNumber || 1);
      const ol = outlineByChapterId.get(ch.id) || outlineByChapterNum.get(chNum);
      const volLabel = ch.volumeId && volumeNameMap.has(ch.volumeId) ? `[所属分卷:${volumeNameMap.get(ch.volumeId)}]` : "[未分卷]";
      const brief = ol
        ? [ol.event || ol.summary || "", ol.twist ? `转折:${ol.twist}` : "", ol.suspense ? `伏笔:${ol.suspense}` : ""]
            .filter(Boolean)
            .join("；")
            .slice(0, 200)
        : (ch.summary?.trim() || `${(ch.contentHead || "").replace(/\s+/g, " ").trim()}${ch.contentTail ? ` ... ${(ch.contentTail || "").replace(/\s+/g, " ").trim()}` : ""}`).slice(0, 200);

      return `- 第${chNum}章《${ch.title}${ch.subtitle ? `·${ch.subtitle}` : ""}》${volLabel}: ${brief || "（仅有标题）"}`;
    });

    const maxWrittenChapter = bodyChapters.reduce((m, c) => Math.max(m, Number(c.chapterNumber || 0)), 0);

    const systemPrompt = `你是一位精通长篇小说架构的总编剧。请严格依据作者已经写出的章节内容与分卷结构，反向归纳生成一棵清晰的【项目总纲层级节点树】，以便作者直观复盘已写剧情并在后续章节推演中无缝衔接。

【层级与结构铁律】：
1. 根节点（id="root"）：整部作品书名，note 概括目前已写内容的主线推进脉络。
2. 一级节点（分卷 / 宏观阶段）：若作者章节已有明确分卷，必须优先对齐其分卷标题；未分卷章节按剧情阶段自动归纳为 1~4 个阶段。每个一级节点必须标注准确的 chapterRange（如 "1-12"）。
3. 二级节点（核心剧情弧 / 章节事件组）：将同一卷内因果紧密相连的 2~5 章归为一个剧情弧（若该卷只有 1~3 章也可直接放章节节点），写清本阶段核心冲突与结果，标注对应 chapterRange。
4. 三级节点（单章细纲节点）：每个已写章节映射为 1 个叶子节点，id 固定为 "ch-<章号>"，tag 固定为 "章节"，chapterRange 固定为 "<章号>"，status 固定为 "completed"，title 为 "第X章 · 事件简称"，note 概括本章核心事实、转折与留下的伏笔（40~100字）。
5. 必须覆盖提供的全部已写章节，100% 忠于已有章节事实，严禁脑补未发生的剧情。
6. 仅输出合法 JSON 对象，严禁输出 Markdown 代码块或任何额外解释：
{
  "id": "root",
  "title": "${work.title}",
  "tag": "总纲",
  "note": "<已写剧情主线总述>",
  "status": "in_progress",
  "children": [
    {
      "id": "vol-1",
      "title": "<第一卷/阶段名>",
      "tag": "分卷",
      "chapterRange": "1-${maxWrittenChapter}",
      "status": "in_progress",
      "note": "<本卷核心矛盾与阶段推进>",
      "children": [
        {
          "id": "arc-1-1",
          "title": "<剧情弧名>",
          "tag": "主线",
          "chapterRange": "1-3",
          "status": "completed",
          "note": "<本弧起承转合>",
          "children": [
            {
              "id": "ch-1",
              "title": "第1章 · <核心事件>",
              "tag": "章节",
              "chapterRange": "1",
              "status": "completed",
              "note": "<本章具体事实与伏笔>",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `作品：《${work.title}》（题材：${work.tag || "小说"}，简介：${work.description || "无"}）\n已写章节清单（共 ${bodyChapters.length} 章，至第 ${maxWrittenChapter} 章）：\n${chapterDigestLines.join("\n")}\n\n请直接输出反推的层级总纲节点树 JSON：`,
      },
    ];

    const isValidTree = (obj: any) => Boolean(obj && typeof obj === "object" && Array.isArray(obj.children) && obj.children.length > 0);
    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.35,
      maxTokens: 6144,
    });
    let parsed = parseStructuredJson<any>(raw, null);
    if (!isValidTree(parsed)) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.3,
          maxTokens: 5120,
        });
        const retryParsed = parseStructuredJson<any>(retryRaw, null);
        if (isValidTree(retryParsed)) parsed = retryParsed;
      } catch {}
    }

    if (!isValidTree(parsed)) {
      return NextResponse.json({ success: false, message: "AI 反推总纲节点树失败，请稍后重试" }, { status: 500 });
    }

    const reversedTree = normalizeTreeNode({ ...parsed, id: "root", title: parsed.title || work.title }, "root");

    // 增量合并模式：保留既有总纲树中尚未写作的未来 planned 阶段节点，避免覆盖作者手写规划
    if (mergeMode === "merge" && existingTree) {
      const futurePlanned = extractFuturePlannedNodes(existingTree, maxWrittenChapter);
      if (futurePlanned.length > 0) {
        const usedIds = new Set<string>();
        const collectIds = (n: TreeNode) => {
          usedIds.add(n.id);
          n.children.forEach(collectIds);
        };
        collectIds(reversedTree);

        futurePlanned.forEach((fNode, idx) => {
          const cloned = normalizeTreeNode(fNode, `future-${idx + 1}`);
          if (usedIds.has(cloned.id)) cloned.id = `future-${Date.now()}-${idx}`;
          reversedTree.children.push(cloned);
        });
      }
      if (existingTree.note && !reversedTree.note) {
        reversedTree.note = existingTree.note;
      }
    }

    if (autoSave) {
      await saveMasterTree(env.DB, workId, user.userId, reversedTree);
    }

    return NextResponse.json({
      success: true,
      result: {
        tree: reversedTree,
        saved: autoSave,
        mappedChaptersCount: bodyChapters.length,
        nodeCount: countTreeNodes(reversedTree),
      },
      message: autoSave
        ? `已根据 ${bodyChapters.length} 个已有章节反推并更新项目总纲树！`
        : `已根据 ${bodyChapters.length} 个已有章节生成总纲树预览`,
    });
  } catch (error: any) {
    console.error("[API /api/ai/outline/master/reverse-from-chapters] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "反推总纲节点树异常" }, { status: 500 });
  }
});
