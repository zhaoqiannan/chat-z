// API: 故事大纲与章节故事轴核心数据接口（数字自增主键、大白话四要素、关联角色标签、关联笔记全文聚合、章节双向对齐）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, outlines, works, characters, notes } from "@/db";
import { eq, and, asc, inArray } from "drizzle-orm";

async function checkWorkOwnership(db: any, workId: number, userId: string) {
  const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, userId))).get();
  return !!work;
}

function parseNumberArray(val: any): number[] {
  if (Array.isArray(val)) {
    return val.map((n) => Number(n)).filter((n) => !isNaN(n) && n > 0);
  }
  if (typeof val === "string" && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map((n) => Number(n)).filter((n) => !isNaN(n) && n > 0);
      }
    } catch (_) {}
    const numbers = val.match(/\d+/g);
    if (numbers) {
      return numbers.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0);
    }
  }
  return [];
}

/**
 * GET /api/outlines?workId=xxx
 * 获取故事大纲列表与故事轴，自动富聚合关联角色的标签数据及关联笔记的全文内容
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rawWorkId = req.nextUrl.searchParams.get("workId");
    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const isOwner = await checkWorkOwnership(db, workId, user.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: "无权访问该作品的大纲" }, { status: 403 });
    }

    // 并行获取大纲列表、角色列表与笔记列表
    const [rawList, allCharacters, allNotes] = await Promise.all([
      db
        .select()
        .from(outlines)
        .where(eq(outlines.workId, workId))
        .orderBy(asc(outlines.orderIndex), asc(outlines.chapterNumber), asc(outlines.id))
        .all(),
      db.select().from(characters).where(eq(characters.workId, workId)).all(),
      db.select().from(notes).where(eq(notes.workId, workId)).all(),
    ]);

    // 构建角色与笔记快速映射 Map
    const charMap = new Map<number, any>();
    allCharacters.forEach((c: any) => {
      const parsedTags: string[] = [];
      if (c.tags) {
        c.tags.split(/[,，、]/).forEach((t: string) => {
          const clean = t.trim();
          if (clean) parsedTags.push(clean);
        });
      }
      if (c.identity) parsedTags.unshift(c.identity.trim());

      charMap.set(c.id, {
        id: c.id,
        name: c.name,
        roleType: c.roleType || "major",
        identity: c.identity || "",
        avatarUrl: c.avatarUrl || null,
        tags: parsedTags,
        characterArc: c.characterArc || "",
      });
    });

    const noteMap = new Map<number, any>();
    allNotes.forEach((n: any) => {
      noteMap.set(n.id, {
        id: n.id,
        title: n.title,
        content: n.content || "",
        category: n.category || "idea",
        isPinned: n.isPinned || 0,
        priority: n.priority || "medium",
        updatedAt: n.updatedAt,
      });
    });

    // 组装聚合后的大纲节点
    const enrichedList = rawList.map((item: any) => {
      const charIds = parseNumberArray(item.linkedCharacterIds);
      const noteIds = parseNumberArray(item.linkedNoteIds);

      const enrichedChars = charIds
        .map((cid) => charMap.get(cid))
        .filter(Boolean);

      const enrichedNotes = noteIds
        .map((nid) => noteMap.get(nid))
        .filter(Boolean);

      return {
        ...item,
        id: Number(item.id),
        workId: Number(item.workId),
        parentId: item.parentId ? Number(item.parentId) : null,
        volumeId: item.volumeId ? Number(item.volumeId) : null,
        chapterId: item.chapterId ? Number(item.chapterId) : null,
        chapterNumber: item.chapterNumber ? Number(item.chapterNumber) : null,
        linkedCharacterIds: charIds,
        linkedNoteIds: noteIds,
        linkedCharacters: enrichedChars,
        linkedNotes: enrichedNotes,
        // 4 要素回退兼容
        event: item.event || item.eventDescription || item.content || "",
        twist: item.twist || item.conflict || "",
        nextGoal: item.nextGoal || item.goal || "",
        suspense: item.suspense || item.foreshadowing || "",
      };
    });

    return NextResponse.json({
      success: true,
      result: enrichedList,
      flatList: enrichedList,
      totalCount: enrichedList.length,
      message: "获取大纲成功",
    });
  } catch (error: any) {
    console.error("[API /api/outlines GET] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取大纲失败" }, { status: 500 });
  }
});

/**
 * POST /api/outlines
 * 创建单个大纲节点或批量插入（支持 A➔B 推演结果写入）
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();

    // 1. 批量插入分支（如来自 A➔B 跨度推演）
    if (body.batch && Array.isArray(body.nodes)) {
      const workId = Number(body.workId);
      if (!workId || isNaN(workId)) {
        return NextResponse.json({ success: false, message: "无效的作品ID" }, { status: 400 });
      }

      const isOwner = await checkWorkOwnership(db, workId, user.userId);
      if (!isOwner) {
        return NextResponse.json({ success: false, message: "无权操作该作品" }, { status: 403 });
      }

      const createdList = [];
      for (const nodeData of body.nodes) {
        const charIds = parseNumberArray(nodeData.linkedCharacterIds);
        const noteIds = parseNumberArray(nodeData.linkedNoteIds);

        const item: any = {
          workId,
          parentId: nodeData.parentId ? Number(nodeData.parentId) : null,
          volumeId: nodeData.volumeId ? Number(nodeData.volumeId) : null,
          chapterId: nodeData.chapterId ? Number(nodeData.chapterId) : null,
          chapterNumber: nodeData.chapterNumber ? Number(nodeData.chapterNumber) : null,
          type: nodeData.type || "scene",
          pointType: nodeData.pointType || null,
          status: nodeData.status || "planned",
          isFromChapter: nodeData.isFromChapter ? 1 : 0,
          title: (nodeData.title || "未命名节点").trim(),
          event: nodeData.event?.trim() || nodeData.content?.trim() || "",
          twist: nodeData.twist?.trim() || nodeData.conflict?.trim() || "",
          nextGoal: nodeData.nextGoal?.trim() || nodeData.goal?.trim() || "",
          suspense: nodeData.suspense?.trim() || nodeData.foreshadowing?.trim() || "",
          content: nodeData.content?.trim() || nodeData.event?.trim() || "",
          wordCountEstimate: typeof nodeData.wordCountEstimate === "number" ? nodeData.wordCountEstimate : 3000,
          linkedCharacterIds: charIds,
          linkedNoteIds: noteIds,
          orderIndex: typeof nodeData.orderIndex === "number" ? nodeData.orderIndex : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const insertRes = await db.insert(outlines).values(item).returning();
        createdList.push(insertRes[0] || item);
      }

      return NextResponse.json({
        success: true,
        result: createdList,
        message: `成功批量创建 ${createdList.length} 个大纲节点`,
      });
    }

    // 2. 单个节点创建
    const {
      workId: rawWorkId,
      parentId,
      volumeId,
      chapterId,
      chapterNumber,
      type = "scene",
      pointType,
      status = "planned",
      isFromChapter = 0,
      title,
      event,
      twist,
      nextGoal,
      suspense,
      content,
      wordCountEstimate = 3000,
      linkedCharacterIds,
      linkedNoteIds,
      orderIndex,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的作品ID" }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: "卡片标题不能为空" }, { status: 400 });
    }

    const isOwner = await checkWorkOwnership(db, workId, user.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: "无权操作该作品" }, { status: 403 });
    }

    let nextOrder = typeof orderIndex === "number" ? orderIndex : 0;
    if (orderIndex === undefined) {
      const existing = await db.select().from(outlines).where(eq(outlines.workId, workId)).all();
      nextOrder = existing.length;
    }

    const charIds = parseNumberArray(linkedCharacterIds);
    const noteIds = parseNumberArray(linkedNoteIds);

    const insertPayload: any = {
      workId,
      parentId: parentId ? Number(parentId) : null,
      volumeId: volumeId ? Number(volumeId) : null,
      chapterId: chapterId ? Number(chapterId) : null,
      chapterNumber: chapterNumber ? Number(chapterNumber) : null,
      type: type || "scene",
      pointType: pointType || null,
      status: status || "planned",
      isFromChapter: isFromChapter ? 1 : 0,
      title: title.trim(),
      event: event?.trim() || content?.trim() || "",
      twist: twist?.trim() || "",
      nextGoal: nextGoal?.trim() || "",
      suspense: suspense?.trim() || "",
      content: content?.trim() || event?.trim() || "",
      wordCountEstimate: typeof wordCountEstimate === "number" ? wordCountEstimate : 3000,
      linkedCharacterIds: charIds,
      linkedNoteIds: noteIds,
      orderIndex: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(outlines).values(insertPayload).returning();

    return NextResponse.json({
      success: true,
      result: inserted[0] || insertPayload,
      message: "大纲节点创建成功",
    });
  } catch (error: any) {
    console.error("[API /api/outlines POST] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "创建大纲节点失败" }, { status: 500 });
  }
});

/**
 * PUT /api/outlines
 * 更新大纲节点
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const id = Number(body.id);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少有效节点 ID" }, { status: 400 });
    }

    const existingNode = await db.select().from(outlines).where(eq(outlines.id, id)).get();
    if (!existingNode) {
      return NextResponse.json({ success: false, message: "大纲节点不存在" }, { status: 404 });
    }

    const isOwner = await checkWorkOwnership(db, existingNode.workId, user.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: "无权操作该大纲节点" }, { status: 403 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.event !== undefined) updateData.event = body.event.trim();
    if (body.twist !== undefined) updateData.twist = body.twist.trim();
    if (body.nextGoal !== undefined) updateData.nextGoal = body.nextGoal.trim();
    if (body.suspense !== undefined) updateData.suspense = body.suspense.trim();
    if (body.content !== undefined) updateData.content = body.content.trim();
    if (body.status !== undefined) updateData.status = body.status;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.pointType !== undefined) updateData.pointType = body.pointType;
    if (body.parentId !== undefined) updateData.parentId = body.parentId ? Number(body.parentId) : null;
    if (body.volumeId !== undefined) updateData.volumeId = body.volumeId ? Number(body.volumeId) : null;
    if (body.chapterId !== undefined) updateData.chapterId = body.chapterId ? Number(body.chapterId) : null;
    if (body.chapterNumber !== undefined) updateData.chapterNumber = body.chapterNumber ? Number(body.chapterNumber) : null;
    if (body.orderIndex !== undefined) updateData.orderIndex = Number(body.orderIndex);
    if (body.wordCountEstimate !== undefined) updateData.wordCountEstimate = Number(body.wordCountEstimate);

    if (body.linkedCharacterIds !== undefined) {
      updateData.linkedCharacterIds = parseNumberArray(body.linkedCharacterIds);
    }
    if (body.linkedNoteIds !== undefined) {
      updateData.linkedNoteIds = parseNumberArray(body.linkedNoteIds);
    }

    await db.update(outlines).set(updateData).where(eq(outlines.id, id));

    const updated = await db.select().from(outlines).where(eq(outlines.id, id)).get();

    return NextResponse.json({
      success: true,
      result: updated,
      message: "大纲节点更新成功",
    });
  } catch (error: any) {
    console.error("[API /api/outlines PUT] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "更新大纲节点失败" }, { status: 500 });
  }
});

/**
 * DELETE /api/outlines?id=xxx 或 /api/outlines?ids=1,2,3
 * 删除单个或批量删除大纲节点
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rawId = req.nextUrl.searchParams.get("id");
    const rawIds = req.nextUrl.searchParams.get("ids");

    let idsToDelete: number[] = [];
    if (rawIds) {
      idsToDelete = rawIds
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
    } else if (rawId) {
      const num = Number(rawId.trim());
      if (!isNaN(num) && num > 0) {
        idsToDelete = [num];
      }
    }

    if (idsToDelete.length === 0) {
      try {
        const text = await req.text();
        if (text && text.trim()) {
          const body = JSON.parse(text);
          if (Array.isArray(body?.ids)) {
            idsToDelete = body.ids.map((s: any) => Number(s)).filter((n: number) => !isNaN(n) && n > 0);
          } else if (typeof body?.ids === "string") {
            idsToDelete = body.ids.split(",").map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n) && n > 0);
          } else if (body?.id) {
            const num = Number(body.id);
            if (!isNaN(num) && num > 0) idsToDelete = [num];
          }
        }
      } catch (_) {}
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ success: false, message: "缺少待删除的节点 ID" }, { status: 400 });
    }

    // 检查所有待删除节点的归属
    const targetNodes = await db.select().from(outlines).where(inArray(outlines.id, idsToDelete)).all();
    if (targetNodes.length === 0) {
      return NextResponse.json({ success: false, message: "未找到指定大纲节点" }, { status: 404 });
    }

    for (const node of targetNodes) {
      const isOwner = await checkWorkOwnership(db, node.workId, user.userId);
      if (!isOwner) {
        return NextResponse.json({ success: false, message: "无权操作部分大纲节点" }, { status: 403 });
      }
    }

    await db.delete(outlines).where(inArray(outlines.id, idsToDelete));

    return NextResponse.json({
      success: true,
      result: { deletedIds: idsToDelete, count: idsToDelete.length },
      message: `成功删除 ${idsToDelete.length} 个大纲节点`,
    });
  } catch (error: any) {
    console.error("[API /api/outlines DELETE] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "删除大纲节点失败" }, { status: 500 });
  }
});
