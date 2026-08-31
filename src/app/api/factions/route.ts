import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, factions, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET: 获取指定作品的阵营势力列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const factionId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

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

    if (factionId) {
      const faction = await db
        .select()
        .from(factions)
        .where(and(eq(factions.id, factionId), eq(factions.workId, workId)))
        .get();
      return NextResponse.json({ success: true, result: faction });
    }

    const list = await db
      .select()
      .from(factions)
      .where(eq(factions.workId, workId))
      .orderBy(desc(factions.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("GET factions error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "获取阵营失败" },
      { status: 500 }
    );
  }
});

/**
 * POST: 创建新阵营
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      leader,
      badgeUrl,
      scale,
      doctrine,
      controlledLocations,
      alignment,
      relations,
      description,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "阵营名称不能为空" }, { status: 400 });
    }

    const newFactionData = {
      workId,
      name: name.trim(),
      leader: leader?.trim() || null,
      badgeUrl: badgeUrl || null,
      scale: scale?.trim() || null,
      doctrine: doctrine?.trim() || null,
      controlledLocations: controlledLocations?.trim() || null,
      alignment: alignment?.trim() || null,
      relations: Array.isArray(relations) ? relations : [],
      description: description?.trim() || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(factions).values(newFactionData).returning().get();

    let resultFaction: any = inserted;
    if (!resultFaction || !resultFaction.id) {
      resultFaction = await db
        .select()
        .from(factions)
        .where(eq(factions.workId, workId))
        .orderBy(desc(factions.id))
        .limit(1)
        .get();
    }

    return NextResponse.json({
      success: true,
      result: resultFaction || newFactionData,
      message: "创建阵营成功",
    });
  } catch (error: any) {
    console.error("POST factions error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "创建阵营失败" },
      { status: 500 }
    );
  }
});

/**
 * PUT: 编辑阵营
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, ...updateData } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少阵营ID" }, { status: 400 });
    }

    const payload = {
      ...updateData,
      updatedAt: new Date(),
    };

    await db.update(factions).set(payload).where(eq(factions.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "编辑阵营成功",
    });
  } catch (error: any) {
    console.error("PUT factions error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "编辑阵营失败" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: 删除阵营
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少阵营ID" }, { status: 400 });
    }

    await db.delete(factions).where(eq(factions.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除阵营成功",
    });
  } catch (error: any) {
    console.error("DELETE factions error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "删除阵营失败" },
      { status: 500 }
    );
  }
});
