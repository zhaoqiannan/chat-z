import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, outlines, works } from "@/db";
import { eq, and, asc } from "drizzle-orm";

/**
 * 校验作品是否属于当前用户
 */
async function checkWorkOwnership(db: any, workId: number, userId: string) {
  const work = await db
    .select()
    .from(works)
    .where(and(eq(works.id, workId), eq(works.userId, userId)))
    .get();
  return !!work;
}

/**
 * 规范解析关联章节为数字数组
 */
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

/**
 * 获取指定作品的大纲节点列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rawWorkId = req.nextUrl.searchParams.get("workId");
    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的 workId" },
        { status: 400 }
      );
    }

    // 校验归属权
    const isOwner = await checkWorkOwnership(db, workId, user.userId);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "无权访问该作品的大纲" },
        { status: 403 }
      );
    }

    const list = await db
      .select()
      .from(outlines)
      .where(eq(outlines.workId, workId))
      .orderBy(asc(outlines.orderIndex), asc(outlines.createdAt));

    // 服务端组装树形结构
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
      message: "获取大纲树结构成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "获取大纲失败" },
      { status: 500 }
    );
  }
});

/**
 * 新增单节点 或 批量新增节点
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();

    // 1. 批量创建模式（用于 AI 采纳）
    if (body.batch && Array.isArray(body.nodes)) {
      const workId = Number(body.workId);
      if (!workId || isNaN(workId)) {
        return NextResponse.json(
          { success: false, message: "无效的作品ID" },
          { status: 400 }
        );
      }

      const isOwner = await checkWorkOwnership(db, workId, user.userId);
      if (!isOwner) {
        return NextResponse.json(
          { success: false, message: "无权操作该作品" },
          { status: 403 }
        );
      }

      const createdList = [];
      for (const nodeData of body.nodes) {
        const item = {
          id: nodeData.id || crypto.randomUUID(),
          workId,
          parentId: nodeData.parentId || null,
          type: nodeData.type || "scene",
          pointType: nodeData.pointType || null,
          title: (nodeData.title || "未命名节点").trim(),
          goal: (nodeData.goal || "达成剧情推进").trim(),
          conflict: nodeData.conflict?.trim() || "",
          eventDescription: nodeData.eventDescription?.trim() || "",
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

    // 2. 单节点创建模式
    const {
      workId: rawWorkId,
      parentId,
      type,
      pointType,
      title,
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
      return NextResponse.json(
        { success: false, message: "无效的作品ID" },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, message: "节点标题不能为空" },
        { status: 400 }
      );
    }

    if (!goal || !goal.trim()) {
      return NextResponse.json(
        { success: false, message: "节点目标为必填项" },
        { status: 400 }
      );
    }

    const isOwner = await checkWorkOwnership(db, workId, user.userId);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "无权操作该作品" },
        { status: 403 }
      );
    }

    const newNode = {
      id: crypto.randomUUID(),
      workId,
      parentId: parentId || null,
      type: type || "scene",
      pointType: pointType || null,
      title: title.trim(),
      goal: goal.trim(),
      conflict: conflict?.trim() || "",
      eventDescription: eventDescription?.trim() || "",
      characters: characters?.trim() || "",
      locations: locations?.trim() || "",
      foreshadowing: foreshadowing?.trim() || "",
      expectedOutcome: expectedOutcome?.trim() || "",
      linkedChapters: parseLinkedChapters(linkedChapters),
      remarks: remarks?.trim() || "",
      orderIndex: typeof orderIndex === "number" ? orderIndex : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(outlines).values(newNode);

    return NextResponse.json({
      success: true,
      result: newNode,
      message: "创建节点成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "创建节点失败" },
      { status: 500 }
    );
  }
});

/**
 * 编辑节点
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      id,
      title,
      type,
      pointType,
      goal,
      conflict,
      eventDescription,
      characters,
      locations,
      foreshadowing,
      expectedOutcome,
      linkedChapters,
      remarks,
      parentId,
      orderIndex,
    } = body;

    if (!id || !id.trim()) {
      return NextResponse.json(
        { success: false, message: "节点ID不能为空" },
        { status: 400 }
      );
    }

    const node = await db
      .select()
      .from(outlines)
      .where(eq(outlines.id, id))
      .get();

    if (!node) {
      return NextResponse.json(
        { success: false, message: "节点不存在" },
        { status: 404 }
      );
    }

    const isOwner = await checkWorkOwnership(db, node.workId, user.userId);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "无权编辑该节点" },
        { status: 403 }
      );
    }

    const updatedNode = {
      title: title !== undefined ? title.trim() : node.title,
      type: type || node.type,
      pointType: pointType !== undefined ? pointType : node.pointType,
      goal: goal !== undefined ? goal.trim() : node.goal,
      conflict: conflict !== undefined ? conflict.trim() : node.conflict,
      eventDescription: eventDescription !== undefined ? eventDescription.trim() : node.eventDescription,
      characters: characters !== undefined ? characters.trim() : node.characters,
      locations: locations !== undefined ? locations.trim() : node.locations,
      foreshadowing: foreshadowing !== undefined ? foreshadowing.trim() : node.foreshadowing,
      expectedOutcome: expectedOutcome !== undefined ? expectedOutcome.trim() : node.expectedOutcome,
      linkedChapters: linkedChapters !== undefined ? parseLinkedChapters(linkedChapters) : node.linkedChapters,
      remarks: remarks !== undefined ? remarks.trim() : node.remarks,
      parentId: parentId !== undefined ? parentId : node.parentId,
      orderIndex: typeof orderIndex === "number" ? orderIndex : node.orderIndex,
      updatedAt: new Date(),
    };

    await db.update(outlines).set(updatedNode).where(eq(outlines.id, id));

    return NextResponse.json({
      success: true,
      result: { id, ...updatedNode },
      message: "更新节点成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "更新节点失败" },
      { status: 500 }
    );
  }
});

/**
 * 删除节点 (递归删除其所有子节点)
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    let id = req.nextUrl.searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id || !id.trim()) {
      return NextResponse.json(
        { success: false, message: "节点ID不能为空" },
        { status: 400 }
      );
    }

    const node = await db
      .select()
      .from(outlines)
      .where(eq(outlines.id, id))
      .get();

    if (!node) {
      return NextResponse.json(
        { success: false, message: "节点不存在" },
        { status: 404 }
      );
    }

    const isOwner = await checkWorkOwnership(db, node.workId, user.userId);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, message: "无权删除该节点" },
        { status: 403 }
      );
    }

    // 递归获取所有后代节点 ID
    const allWorkNodes = await db
      .select()
      .from(outlines)
      .where(eq(outlines.workId, node.workId));

    const idsToDelete: string[] = [id];
    const findChildren = (pid: string) => {
      const children = allWorkNodes.filter((n: any) => n.parentId === pid);
      for (const child of children) {
        idsToDelete.push(child.id);
        findChildren(child.id);
      }
    };
    findChildren(id);

    // 删除所有收集到的节点
    for (const deleteId of idsToDelete) {
      await db.delete(outlines).where(eq(outlines.id, deleteId));
    }

    return NextResponse.json({
      success: true,
      message: `成功删除节点及 ${idsToDelete.length - 1} 个子节点`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "删除节点失败" },
      { status: 500 }
    );
  }
});
