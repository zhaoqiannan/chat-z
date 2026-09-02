// API: 地点地标管理（自动补齐上级地点、背景、地貌描述、风土设定、气候特点并支持增删改查）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, locations, works } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

const ensureLocationColumns = async (db: any) => {
  try {
    await db.run(sql`ALTER TABLE locations ADD COLUMN parent_id INTEGER;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE locations ADD COLUMN parent_name TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE locations ADD COLUMN background TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE locations ADD COLUMN geography TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE locations ADD COLUMN customs TEXT;`);
  } catch (_) {}
};

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureLocationColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const locId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (locId) {
      const loc = await db.select().from(locations).where(and(eq(locations.id, locId), eq(locations.workId, workId))).get();
      return NextResponse.json({ success: true, result: loc });
    }

    const list = await db.select().from(locations).where(eq(locations.workId, workId)).orderBy(desc(locations.createdAt)).all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取地点失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureLocationColumns(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      alias,
      parentId,
      parentName,
      background,
      geography,
      customs,
      climate,
      region,
      posX,
      posY,
      type,
      description,
      imageUrl,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "地点名称不能为空" }, { status: 400 });
    }

    const newLocData = {
      workId,
      name: name.trim(),
      alias: alias?.trim() || null,
      parentId: parentId ? Number(parentId) : null,
      parentName: parentName?.trim() || null,
      background: background !== undefined ? (background || null) : null,
      geography: geography !== undefined ? (geography || null) : null,
      customs: customs !== undefined ? (customs || null) : null,
      climate: climate !== undefined ? (climate || null) : null,
      terrain: geography !== undefined ? (geography || null) : null,
      features: customs !== undefined ? (customs || null) : null,
      region: region?.trim() || null,
      posX: typeof posX === "number" ? Math.round(posX) : 50,
      posY: typeof posY === "number" ? Math.round(posY) : 50,
      type: type || "city",
      description: description !== undefined ? (description || null) : (background || null),
      imageUrl: imageUrl || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(locations).values(newLocData).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || newLocData,
      message: "创建地点成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "创建地点失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureLocationColumns(db);

    const body = await req.json();
    const {
      id: rawId,
      name,
      alias,
      parentId,
      parentName,
      background,
      geography,
      customs,
      climate,
      region,
      posX,
      posY,
      type,
      description,
      imageUrl,
      extra,
    } = body;

    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少地点ID" }, { status: 400 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (alias !== undefined) updateData.alias = alias?.trim() || null;
    if (parentId !== undefined) updateData.parentId = parentId ? Number(parentId) : null;
    if (parentName !== undefined) updateData.parentName = parentName?.trim() || null;
    if (background !== undefined) updateData.background = background;
    if (geography !== undefined) {
      updateData.geography = geography;
      updateData.terrain = geography;
    }
    if (customs !== undefined) {
      updateData.customs = customs;
      updateData.features = customs;
    }
    if (climate !== undefined) updateData.climate = climate;
    if (region !== undefined) updateData.region = region?.trim() || null;
    if (posX !== undefined) updateData.posX = typeof posX === "number" ? Math.round(posX) : 50;
    if (posY !== undefined) updateData.posY = typeof posY === "number" ? Math.round(posY) : 50;
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (extra !== undefined) updateData.extra = extra;

    const updated = await db.update(locations).set(updateData).where(eq(locations.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: updated,
      message: "编辑地点成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "编辑地点失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureLocationColumns(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少地点ID" }, { status: 400 });
    }

    await db.delete(locations).where(eq(locations.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除地点成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除地点失败" }, { status: 500 });
  }
});
