import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, timelines, timelineEvents } from "@/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const rawTimelineId = searchParams.get("timelineId");
    const requestedTimelineId = rawTimelineId ? Number(rawTimelineId) : null;
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    let timelineList = await db
      .select()
      .from(timelines)
      .where(eq(timelines.workId, workId))
      .orderBy(desc(timelines.isMain), desc(timelines.id))
      .all();

    if (timelineList.length === 0) {
      const defaultTimeline = await db
        .insert(timelines)
        .values({
          workId,
          title: "主线编年史",
          description: "记录故事主线发展的核心关键节点",
          isMain: 1,
          color: "#00c9ff",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();
      if (defaultTimeline) timelineList = [defaultTimeline];
    }

    const activeTimelineId =
      requestedTimelineId && !isNaN(requestedTimelineId) && timelineList.some((tl) => tl.id === requestedTimelineId)
        ? requestedTimelineId
        : timelineList[0]?.id ?? null;

    const eventsList = activeTimelineId
      ? await db
          .select()
          .from(timelineEvents)
          .where(and(eq(timelineEvents.workId, workId), eq(timelineEvents.timelineId, activeTimelineId)))
          .orderBy(asc(timelineEvents.sortOrder), asc(timelineEvents.id))
          .all()
      : [];

    return NextResponse.json({
      success: true,
      result: { timelines: timelineList, events: eventsList, activeTimelineId },
    });
  } catch (err: any) {
    console.error("GET timelines error:", err);
    return NextResponse.json({ success: false, message: "获取时间线失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;
    const workId = Number(body.workId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }
    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    if (body.type === "timeline") {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json({ success: false, message: "时间线名称不能为空" }, { status: 400 });
      }
      const inserted = await db
        .insert(timelines)
        .values({
          workId,
          title,
          description: String(body.description || ""),
          color: String(body.color || "#00c9ff"),
          isMain: body.isMain ? 1 : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();
      return NextResponse.json({ success: true, result: inserted, message: "创建时间线成功" });
    }

    const timelineId = Number(body.timelineId);
    const title = String(body.title || "").trim();
    const timePoint = String(body.timePoint || "").trim();
    if (!timelineId || !title || !timePoint) {
      return NextResponse.json({ success: false, message: "时间点与事件标题不能为空" }, { status: 400 });
    }

    const targetTimeline = await db
      .select({ id: timelines.id })
      .from(timelines)
      .where(and(eq(timelines.id, timelineId), eq(timelines.workId, workId)))
      .get();
    if (!targetTimeline) {
      return NextResponse.json({ success: false, message: "所属时间线不存在或不属于当前作品" }, { status: 400 });
    }

    const insertedEvent = await db
      .insert(timelineEvents)
      .values({
        timelineId,
        workId,
        timePoint,
        title,
        location: String(body.location || ""),
        characters: String(body.characters || ""),
        impactLevel: String(body.impactLevel || "major"),
        description: String(body.description || ""),
        sortOrder: Number(body.sortOrder) || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();
    return NextResponse.json({ success: true, result: insertedEvent, message: "创建节点成功" });
  } catch (err: any) {
    console.error("POST timelines error:", err);
    return NextResponse.json({ success: false, message: "创建失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;
    const id = Number(body.id);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    if (body.type === "timeline") {
      const existing = await db.select().from(timelines).where(eq(timelines.id, id)).get();
      if (!existing) return NextResponse.json({ success: false, message: "时间线不存在" }, { status: 404 });
      if (!(await assertWorkOwnership(db, existing.workId, user.userId))) {
        return NextResponse.json({ success: false, message: "无权操作该时间线" }, { status: 403 });
      }

      const data: Record<string, any> = { updatedAt: new Date() };
      if (body.title !== undefined) data.title = String(body.title).trim();
      if (body.description !== undefined) data.description = String(body.description);
      if (body.color !== undefined) data.color = String(body.color);
      if (body.isMain !== undefined) data.isMain = body.isMain ? 1 : 0;

      await db.update(timelines).set(data).where(eq(timelines.id, id));
      return NextResponse.json({ success: true, message: "更新时间线成功" });
    }

    const existingEvent = await db.select().from(timelineEvents).where(eq(timelineEvents.id, id)).get();
    if (!existingEvent) return NextResponse.json({ success: false, message: "事件节点不存在" }, { status: 404 });
    if (!(await assertWorkOwnership(db, existingEvent.workId, user.userId))) {
      return NextResponse.json({ success: false, message: "无权操作该事件节点" }, { status: 403 });
    }

    const eventData: Record<string, any> = { updatedAt: new Date() };
    if (body.timePoint !== undefined) eventData.timePoint = String(body.timePoint).trim();
    if (body.title !== undefined) eventData.title = String(body.title).trim();
    if (body.location !== undefined) eventData.location = String(body.location);
    if (body.characters !== undefined) eventData.characters = String(body.characters);
    if (body.impactLevel !== undefined) eventData.impactLevel = String(body.impactLevel);
    if (body.description !== undefined) eventData.description = String(body.description);
    if (body.sortOrder !== undefined) eventData.sortOrder = Number(body.sortOrder) || 0;
    if (body.timelineId !== undefined) {
      const nextTlId = Number(body.timelineId);
      const tlOk = await db.select({ id: timelines.id }).from(timelines).where(and(eq(timelines.id, nextTlId), eq(timelines.workId, existingEvent.workId))).get();
      if (!tlOk) return NextResponse.json({ success: false, message: "目标时间线不属于当前作品" }, { status: 400 });
      eventData.timelineId = nextTlId;
    }

    await db.update(timelineEvents).set(eventData).where(eq(timelineEvents.id, id));
    return NextResponse.json({ success: true, message: "更新事件节点成功" });
  } catch (err: any) {
    console.error("PUT timelines error:", err);
    return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const id = Number(searchParams.get("id"));
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    if (type === "timeline") {
      const existing = await db.select().from(timelines).where(eq(timelines.id, id)).get();
      if (!existing) return NextResponse.json({ success: false, message: "时间线不存在" }, { status: 404 });
      if (!(await assertWorkOwnership(db, existing.workId, user.userId))) {
        return NextResponse.json({ success: false, message: "无权删除该时间线" }, { status: 403 });
      }
      await env.DB.batch([
        env.DB.prepare("DELETE FROM timeline_events WHERE timeline_id = ?").bind(id),
        env.DB.prepare("DELETE FROM timelines WHERE id = ?").bind(id),
      ]);
      return NextResponse.json({ success: true, message: "删除时间线及节点成功" });
    }

    const existingEvent = await db.select().from(timelineEvents).where(eq(timelineEvents.id, id)).get();
    if (!existingEvent) return NextResponse.json({ success: false, message: "事件节点不存在" }, { status: 404 });
    if (!(await assertWorkOwnership(db, existingEvent.workId, user.userId))) {
      return NextResponse.json({ success: false, message: "无权删除该事件节点" }, { status: 403 });
    }

    await db.delete(timelineEvents).where(eq(timelineEvents.id, id)).run();
    return NextResponse.json({ success: true, message: "删除事件节点成功" });
  } catch (err: any) {
    console.error("DELETE timelines error:", err);
    return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 });
  }
});
