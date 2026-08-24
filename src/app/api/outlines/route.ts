import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, outlines, works } from "@/db";
import { eq, and, asc } from "drizzle-orm";

/**
 * 校验作品是否属于当前用户
 */
async function checkWorkOwnership(db: any, workId: string, userId: string) {
  const work = await db
    .select()
    .from(works)
    .where(and(eq(works.id, workId), eq(works.userId, userId)))
    .get();
  return !!work;
}

/**
 * 获取指定作品的大纲节点列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const workId = req.nextUrl.searchParams.get("workId");
    if (!workId) {
      return NextResponse.json(
        { success: false, message: "workId 不能为空" },
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

    return NextResponse.json({
      success: true,
      result: list,
      message: "获取大纲列表成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "获取大纲失败" },
      { status: 500 }
    );
  }
});

/**
 * 新增节点
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId,
      parentId,
      type,
      title,
      goal,
      conflict,
      characters,
      locations,
      expectedOutcome,
      linkedChapters,
      orderIndex,
    } = body;

    if (!workId || !workId.trim()) {
      return NextResponse.json(
        { success: false, message: "作品ID不能为空" },
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
      workId: workId.trim(),
      parentId: parentId || null,
      type: type || "scene",
      title: title.trim(),
      goal: goal.trim(),
      conflict: conflict?.trim() || "",
      characters: characters?.trim() || "",
      locations: locations?.trim() || "",
      expectedOutcome: expectedOutcome?.trim() || "",
      linkedChapters: linkedChapters?.trim() || "",
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
      goal,
      conflict,
      characters,
      locations,
      expectedOutcome,
      linkedChapters,
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
      goal: goal !== undefined ? goal.trim() : node.goal,
      conflict: conflict !== undefined ? conflict.trim() : node.conflict,
      characters: characters !== undefined ? characters.trim() : node.characters,
      locations: locations !== undefined ? locations.trim() : node.locations,
      expectedOutcome: expectedOutcome !== undefined ? expectedOutcome.trim() : node.expectedOutcome,
      linkedChapters: linkedChapters !== undefined ? linkedChapters.trim() : node.linkedChapters,
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
