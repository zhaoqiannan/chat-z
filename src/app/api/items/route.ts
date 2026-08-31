import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, items, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET: 获取指定作品的物品道具列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const itemId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (itemId) {
      const item = await db
        .select()
        .from(items)
        .where(and(eq(items.id, itemId), eq(items.workId, workId)))
        .get();
      return NextResponse.json({ success: true, result: item });
    }

    const list = await db
      .select()
      .from(items)
      .where(eq(items.workId, workId))
      .orderBy(desc(items.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("GET items error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "获取物品失败" },
      { status: 500 }
    );
  }
});

/**
 * POST: 创建新物品
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      category,
      tier,
      appearance,
      effects,
      drawbacks,
      currentHolder,
      history,
      description,
      imageUrl,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "物品名称不能为空" }, { status: 400 });
    }

    if (!effects || !effects.trim()) {
      return NextResponse.json({ success: false, message: "核心功能与异能机理不能为空" }, { status: 400 });
    }

    const newItemData = {
      workId,
      name: name.trim(),
      category: category || "treasure",
      tier: tier?.trim() || null,
      appearance: appearance?.trim() || null,
      effects: effects.trim(),
      drawbacks: drawbacks?.trim() || null,
      currentHolder: currentHolder?.trim() || null,
      history: history?.trim() || null,
      description: description?.trim() || null,
      imageUrl: imageUrl || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(items).values(newItemData).returning().get();

    let resultItem: any = inserted;
    if (!resultItem || !resultItem.id) {
      resultItem = await db
        .select()
        .from(items)
        .where(eq(items.workId, workId))
        .orderBy(desc(items.id))
        .limit(1)
        .get();
    }

    return NextResponse.json({
      success: true,
      result: resultItem || newItemData,
      message: "创建物品成功",
    });
  } catch (error: any) {
    console.error("POST items error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "创建物品失败" },
      { status: 500 }
    );
  }
});

/**
 * PUT: 编辑物品
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, ...updateData } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少物品ID" }, { status: 400 });
    }

    const payload = {
      ...updateData,
      updatedAt: new Date(),
    };

    await db.update(items).set(payload).where(eq(items.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "编辑物品成功",
    });
  } catch (error: any) {
    console.error("PUT items error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "编辑物品失败" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: 删除物品
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少物品ID" }, { status: 400 });
    }

    await db.delete(items).where(eq(items.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除物品成功",
    });
  } catch (error: any) {
    console.error("DELETE items error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "删除物品失败" },
      { status: 500 }
    );
  }
});
