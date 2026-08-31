import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, locations, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET: 获取指定作品的地点列表或单条地点
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const locId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

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

    if (locId) {
      const loc = await db
        .select()
        .from(locations)
        .where(and(eq(locations.id, locId), eq(locations.workId, workId)))
        .get();
      return NextResponse.json({ success: true, result: loc });
    }

    const list = await db
      .select()
      .from(locations)
      .where(eq(locations.workId, workId))
      .orderBy(desc(locations.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("GET locations error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "获取地点失败" },
      { status: 500 }
    );
  }
});

/**
 * POST: 创建新地点
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      alias,
      region,
      posX,
      posY,
      type,
      climate,
      terrain,
      features,
      specialties,
      governingFaction,
      plotPoints,
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
      region: region?.trim() || null,
      posX: typeof posX === "number" ? Math.round(posX) : 50,
      posY: typeof posY === "number" ? Math.round(posY) : 50,
      type: type || "city",
      climate: climate?.trim() || null,
      terrain: terrain?.trim() || null,
      features: features?.trim() || null,
      specialties: specialties?.trim() || null,
      governingFaction: governingFaction?.trim() || null,
      plotPoints: plotPoints?.trim() || null,
      description: description?.trim() || null,
      imageUrl: imageUrl || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(locations).values(newLocData).returning().get();

    let resultLoc: any = inserted;
    if (!resultLoc || !resultLoc.id) {
      resultLoc = await db
        .select()
        .from(locations)
        .where(eq(locations.workId, workId))
        .orderBy(desc(locations.id))
        .limit(1)
        .get();
    }

    return NextResponse.json({
      success: true,
      result: resultLoc || newLocData,
      message: "创建地点成功",
    });
  } catch (error: any) {
    console.error("POST locations error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "创建地点失败" },
      { status: 500 }
    );
  }
});

/**
 * PUT: 编辑地点（包含更新地图画布拖拽坐标）
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, ...updateData } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少地点ID" }, { status: 400 });
    }

    const payload = {
      ...updateData,
      updatedAt: new Date(),
    };

    await db.update(locations).set(payload).where(eq(locations.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "编辑地点成功",
    });
  } catch (error: any) {
    console.error("PUT locations error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "编辑地点失败" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: 删除地点
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少地点ID" }, { status: 400 });
    }

    await db.delete(locations).where(eq(locations.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除地点成功",
    });
  } catch (error: any) {
    console.error("DELETE locations error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "删除地点失败" },
      { status: 500 }
    );
  }
});
