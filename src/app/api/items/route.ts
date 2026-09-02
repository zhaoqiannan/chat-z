// API: 物品道具管理（支持自由文本类型、所属角色与关联阵营）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, items, works } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

async function ensureItemColumns(db: any) {
  try {
    await db.run(sql`ALTER TABLE items ADD COLUMN owner_id INTEGER;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE items ADD COLUMN owner_name TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE items ADD COLUMN faction TEXT;`);
  } catch (_) {}
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureItemColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const itemId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (itemId) {
      const item = await db.select().from(items).where(and(eq(items.id, itemId), eq(items.workId, workId))).get();
      return NextResponse.json({ success: true, result: item });
    }

    const list = await db.select().from(items).where(eq(items.workId, workId)).orderBy(desc(items.createdAt)).all();
    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取物品失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureItemColumns(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      category,
      tier,
      ownerId,
      ownerName,
      faction,
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

    const finalEffects = effects?.trim() || description?.trim() || "暂无描述";
    const finalDesc = description?.trim() || effects?.trim() || "暂无描述";

    const newItemData = {
      workId,
      name: name.trim(),
      category: category?.trim() || null,
      tier: tier?.trim() || null,
      ownerId: ownerId ? Number(ownerId) : null,
      ownerName: ownerName?.trim() || currentHolder?.trim() || null,
      appearance: appearance?.trim() || null,
      effects: finalEffects,
      drawbacks: drawbacks?.trim() || null,
      currentHolder: ownerName?.trim() || currentHolder?.trim() || null,
      history: history?.trim() || null,
      description: finalDesc,
      imageUrl: imageUrl || null,
      extra: typeof extra === "object" ? { ...extra, faction } : { faction },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(items).values(newItemData).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || newItemData,
      message: "创建物品成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "创建物品失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureItemColumns(db);

    const body = await req.json();
    const {
      id: rawId,
      name,
      category,
      tier,
      ownerId,
      ownerName,
      faction,
      appearance,
      effects,
      drawbacks,
      currentHolder,
      history,
      description,
      imageUrl,
      extra,
    } = body;

    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少物品ID" }, { status: 400 });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (tier !== undefined) updateData.tier = tier?.trim() || null;
    if (ownerId !== undefined) updateData.ownerId = ownerId ? Number(ownerId) : null;
    if (ownerName !== undefined) {
      updateData.ownerName = ownerName?.trim() || null;
      updateData.currentHolder = ownerName?.trim() || null;
    }
    if (appearance !== undefined) updateData.appearance = appearance?.trim() || null;
    if (effects !== undefined) updateData.effects = effects.trim();
    if (drawbacks !== undefined) updateData.drawbacks = drawbacks?.trim() || null;
    if (currentHolder !== undefined && ownerName === undefined) updateData.currentHolder = currentHolder?.trim() || null;
    if (history !== undefined) updateData.history = history?.trim() || null;
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
      if (effects === undefined) updateData.effects = description.trim();
    }
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (extra !== undefined || faction !== undefined) {
      updateData.extra = { ...(extra || {}), ...(faction ? { faction } : {}) };
    }

    const updated = await db.update(items).set(updateData).where(eq(items.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: updated,
      message: "物品更新成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "更新物品失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureItemColumns(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少物品ID" }, { status: 400 });
    }

    await db.delete(items).where(eq(items.id, id)).run();

    return NextResponse.json({ success: true, message: "物品删除成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除物品失败" }, { status: 500 });
  }
});
