// API: 势力与阵营管理（支持领袖关联、控制区域地点关联、规模P0-P10与发展走势）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, factions, works } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

async function ensureFactionColumns(db: any) {
  try {
    await db.run(sql`ALTER TABLE factions ADD COLUMN leader_id INTEGER;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE factions ADD COLUMN location_id INTEGER;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE factions ADD COLUMN trend TEXT;`);
  } catch (_) {}
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureFactionColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const factionId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (factionId) {
      const faction = await db.select().from(factions).where(and(eq(factions.id, factionId), eq(factions.workId, workId))).get();
      return NextResponse.json({ success: true, result: faction });
    }

    const list = await db.select().from(factions).where(eq(factions.workId, workId)).orderBy(desc(factions.createdAt)).all();
    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取阵营失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureFactionColumns(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      leader,
      leaderId,
      badgeUrl,
      scale = "p3",
      doctrine,
      controlledLocations,
      locationId,
      alignment = "neutral",
      trend,
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
      leaderId: leaderId ? Number(leaderId) : null,
      badgeUrl: badgeUrl || null,
      scale: scale?.trim() || "p3",
      doctrine: doctrine?.trim() || null,
      controlledLocations: controlledLocations?.trim() || null,
      locationId: locationId ? Number(locationId) : null,
      alignment: alignment?.trim() || "neutral",
      trend: trend?.trim() || null,
      relations: Array.isArray(relations) ? relations : [],
      description: description?.trim() || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(factions).values(newFactionData).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || newFactionData,
      message: "创建阵营成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "创建阵营失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureFactionColumns(db);

    const body = await req.json();
    const {
      id: rawId,
      name,
      leader,
      leaderId,
      badgeUrl,
      scale,
      doctrine,
      controlledLocations,
      locationId,
      alignment,
      trend,
      relations,
      description,
      extra,
    } = body;

    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少阵营ID" }, { status: 400 });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (leader !== undefined) updateData.leader = leader?.trim() || null;
    if (leaderId !== undefined) updateData.leaderId = leaderId ? Number(leaderId) : null;
    if (badgeUrl !== undefined) updateData.badgeUrl = badgeUrl || null;
    if (scale !== undefined) updateData.scale = scale?.trim() || "p3";
    if (doctrine !== undefined) updateData.doctrine = doctrine?.trim() || null;
    if (controlledLocations !== undefined) updateData.controlledLocations = controlledLocations?.trim() || null;
    if (locationId !== undefined) updateData.locationId = locationId ? Number(locationId) : null;
    if (alignment !== undefined) updateData.alignment = alignment?.trim() || "neutral";
    if (trend !== undefined) updateData.trend = trend?.trim() || null;
    if (relations !== undefined) updateData.relations = relations;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (extra !== undefined) updateData.extra = extra;

    const updated = await db.update(factions).set(updateData).where(eq(factions.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: updated,
      message: "阵营更新成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "更新阵营失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureFactionColumns(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少阵营ID" }, { status: 400 });
    }

    await db.delete(factions).where(eq(factions.id, id)).run();

    return NextResponse.json({ success: true, message: "阵营删除成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除阵营失败" }, { status: 500 });
  }
});
