// API: 故事大纲与情节点管理（极简自然篇章、情节点增删改查、排序与批量写入）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, outlines, works } from "@/db";
import { eq, and, asc } from "drizzle-orm";

async function checkWorkOwnership(db: any, workId: number, userId: string) {
  const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, userId))).get();
  return !!work;
}

function parseLinkedChapters(val: any): number[] {
  if (Array.isArray(val)) {
    return val.map((n) => Number(n)).filter((n) => !isNaN(n) && n > 0);
  }
  if (typeof val === "string" && val.trim()) {
    const rangeMatch = val.match(/(\d+)\s*[-~至到]\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const res: number[] = [];
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        res.push(i);
      }
      return res;
    }
    const numbers = val.match(/\d+/g);
    if (numbers) {
      return numbers.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0);
    }
  }
  return [];
}

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

    const list = await db.select().from(outlines).where(eq(outlines.workId, workId)).orderBy(asc(outlines.orderIndex), asc(outlines.createdAt));

    const nodeMap: Record<string, any> = {};
    const tree: any[] = [];

    list.forEach((item: any) => {
      nodeMap[item.id] = { ...item, children: [] };
    });

    list.forEach((item: any) => {
      if (item.parentId && nodeMap[item.parentId]) {
        nodeMap[item.parentId].children.push(nodeMap[item.id]);
      } else {
        tree.push(nodeMap[item.id]);
      }
    });

    return NextResponse.json({
      success: true,
      result: tree,
      flatList: list,
      message: "获取大纲成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取大纲失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();

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
        const item = {
          id: nodeData.id || crypto.randomUUID(),
          workId,
          parentId: nodeData.parentId || null,
          volumeId: nodeData.volumeId || null,
          type: nodeData.type || "scene",
          pointType: nodeData.pointType || null,
          title: (nodeData.title || "未命名节点").trim(),
          content: nodeData.content?.trim() || nodeData.eventDescription?.trim() || "",
          goal: nodeData.goal?.trim() || (nodeData.title || "推进剧情").trim(),
          conflict: nodeData.conflict?.trim() || "",
          eventDescription: nodeData.eventDescription?.trim() || nodeData.content?.trim() || "",
          expectedOutcome: nodeData.expectedOutcome?.trim() || "",
          characters: nodeData.characters?.trim() || "",
          locations: nodeData.locations?.trim() || "",
          foreshadowing: nodeData.foreshadowing?.trim() || "",
          linkedChapters: parseLinkedChapters(nodeData.linkedChapters),
          remarks: nodeData.remarks?.trim() || "",
          orderIndex: typeof nodeData.orderIndex === "number" ? nodeData.orderIndex : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.insert(outlines).values(item);
        createdList.push(item);
      }

      return NextResponse.json({
        success: true,
        result: createdList,
        message: `成功批量创建 ${createdList.length} 个大纲节点`,
      });
    }

    const {
      workId: rawWorkId,
      parentId,
      volumeId,
      type,
      pointType,
      title,
      content,
      goal,
      conflict,
      eventDescription,
      characters,
      locations,
      foreshadowing,
      expectedOutcome,
      linkedChapters,
      remarks,
      orderIndex,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的作品ID" }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: "节点标题不能为空" }, { status: 400 });
    }

    const isOwner = await checkWorkOwnership(db, workId, user.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: "无权操作该作品" }, { status: 403 });
    }

    let nextOrder = typeof orderIndex === "number" ? orderIndex : 0;
    if (orderIndex === undefined) {
      const brothers = await db.select().from(outlines).where(and(eq(outlines.workId, workId), parentId ? eq(outlines.parentId, parentId) : eq(outlines.type, type || "scene"))).all();
      nextOrder = brothers.length;
    }

    const newNodeId = crypto.randomUUID();
    const finalContent = content?.trim() || eventDescription?.trim() || "";
    const finalGoal = goal?.trim() || title.trim();

    const insertPayload = {
      id: newNodeId,
      workId,
      parentId: parentId || null,
      volumeId: volumeId || null,
      type: type || "scene",
      pointType: pointType || null,
      title: title.trim(),
      content: finalContent,
      goal: finalGoal,
      conflict: conflict?.trim() || "",
      eventDescription: finalContent,
      expectedOutcome: expectedOutcome?.trim() || "",
      characters: characters?.trim() || "",
      locations: locations?.trim() || "",
      foreshadowing: foreshadowing?.trim() || "",
      linkedChapters: parseLinkedChapters(linkedChapters),
      remarks: remarks?.trim() || "",
      orderIndex: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(outlines).values(insertPayload);

    return NextResponse.json({
      success: true,
      result: insertPayload,
      message: "大纲节点创建成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "创建大纲节点失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      id,
      title,
      content,
      goal,
      conflict,
      eventDescription,
      characters,
      locations,
      foreshadowing,
      expectedOutcome,
      linkedChapters,
      remarks,
      orderIndex,
      type,
      pointType,
      parentId,
      volumeId,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "缺少节点 ID" }, { status: 400 });
    }

    const existingNode = await db.select().from(outlines).where(eq(outlines.id, id)).get();
    if (!existingNode) {
      return NextResponse.json({ success: false, message: "大纲节点不存在" }, { status: 404 });
    }

    const isOwner = await checkWorkOwnership(db, existingNode.workId, user.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: "无权修改该节点" }, { status: 403 });
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updatePayload.title = title.trim();
    if (content !== undefined) {
      updatePayload.content = content.trim();
      updatePayload.eventDescription = content.trim();
    }
    if (goal !== undefined) updatePayload.goal = goal.trim();
    if (conflict !== undefined) updatePayload.conflict = conflict.trim();
    if (eventDescription !== undefined && content === undefined) {
      updatePayload.eventDescription = eventDescription.trim();
      updatePayload.content = eventDescription.trim();
    }
    if (characters !== undefined) updatePayload.characters = characters.trim();
    if (locations !== undefined) updatePayload.locations = locations.trim();
    if (foreshadowing !== undefined) updatePayload.foreshadowing = foreshadowing.trim();
    if (expectedOutcome !== undefined) updatePayload.expectedOutcome = expectedOutcome.trim();
    if (remarks !== undefined) updatePayload.remarks = remarks.trim();
    if (orderIndex !== undefined) updatePayload.orderIndex = orderIndex;
    if (type !== undefined) updatePayload.type = type;
    if (pointType !== undefined) updatePayload.pointType = pointType;
    if (parentId !== undefined) updatePayload.parentId = parentId || null;
    if (volumeId !== undefined) updatePayload.volumeId = volumeId || null;
    if (linkedChapters !== undefined) {
      updatePayload.linkedChapters = parseLinkedChapters(linkedChapters);
    }

    await db.update(outlines).set(updatePayload).where(eq(outlines.id, id));

    return NextResponse.json({
      success: true,
      result: { ...existingNode, ...updatePayload },
      message: "大纲节点更新成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "更新大纲节点失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "缺少待删除节点 ID" }, { status: 400 });
    }

    const existingNode = await db.select().from(outlines).where(eq(outlines.id, id)).get();
    if (!existingNode) {
      return NextResponse.json({ success: false, message: "节点不存在" }, { status: 404 });
    }

    const isOwner = await checkWorkOwnership(db, existingNode.workId, user.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: "无权删除该节点" }, { status: 403 });
    }

    await db.delete(outlines).where(eq(outlines.id, id));

    return NextResponse.json({
      success: true,
      message: "大纲节点删除成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除大纲节点失败" }, { status: 500 });
  }
});
