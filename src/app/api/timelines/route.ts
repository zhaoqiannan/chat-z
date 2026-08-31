import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, timelines, timelineEvents } from "@/db";
import { eq, and, asc, desc } from "drizzle-orm";

/**
 * 时间线及事件节点查询 (GET)
 * 支持 ?workId=xxx 获取所有时间线及其节点
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    let timelineList = await db
      .select()
      .from(timelines)
      .where(eq(timelines.workId, workId))
      .orderBy(desc(timelines.isMain), desc(timelines.id))
      .all();

    // 如果还没有任何时间线，默认自动创建一条“主线编年史”
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

      if (defaultTimeline) {
        timelineList = [defaultTimeline];
      }
    }

    const eventsList = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.workId, workId))
      .orderBy(asc(timelineEvents.sortOrder), asc(timelineEvents.id))
      .all();

    return NextResponse.json({
      success: true,
      result: {
        timelines: timelineList,
        events: eventsList,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "获取时间线失败" }, { status: 500 });
  }
});

/**
 * 新建时间线或事件节点 (POST)
 * type: 'timeline' | 'event'
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { type, workId: rawWorkId } = body;
    const workId = Number(rawWorkId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    // 1. 新建时间线
    if (type === "timeline") {
      const { title, description, color, isMain } = body;
      if (!title || !title.trim()) {
        return NextResponse.json({ success: false, message: "时间线名称不能为空" }, { status: 400 });
      }

      const inserted = await db
        .insert(timelines)
        .values({
          workId,
          title: title.trim(),
          description: description || "",
          color: color || "#00c9ff",
          isMain: isMain ? 1 : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();

      return NextResponse.json({ success: true, result: inserted, message: "创建时间线成功" });
    }

    // 2. 新建事件节点
    const { timelineId: rawTimelineId, timePoint, title, location, characters, impactLevel, description, sortOrder } = body;
    const timelineId = Number(rawTimelineId);

    if (!timelineId || !title?.trim() || !timePoint?.trim()) {
      return NextResponse.json({ success: false, message: "时间点与事件标题不能为空" }, { status: 400 });
    }

    const insertedEvent = await db
      .insert(timelineEvents)
      .values({
        timelineId,
        workId,
        timePoint: timePoint.trim(),
        title: title.trim(),
        location: location || "",
        characters: characters || "",
        impactLevel: impactLevel || "major",
        description: description || "",
        sortOrder: Number(sortOrder) || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();

    return NextResponse.json({ success: true, result: insertedEvent, message: "创建节点成功" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "创建失败" }, { status: 500 });
  }
});

/**
 * 编辑时间线或节点 (PUT)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { type, id: rawId } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    if (type === "timeline") {
      const { title, description, color, isMain } = body;
      const data: Record<string, any> = { updatedAt: new Date() };
      if (title !== undefined) data.title = title.trim();
      if (description !== undefined) data.description = description;
      if (color !== undefined) data.color = color;
      if (isMain !== undefined) data.isMain = isMain ? 1 : 0;

      await db.update(timelines).set(data).where(eq(timelines.id, id));
      return NextResponse.json({ success: true, message: "更新时间线成功" });
    }

    // 事件节点更新
    const { timePoint, title, location, characters, impactLevel, description, sortOrder, timelineId } = body;
    const eventData: Record<string, any> = { updatedAt: new Date() };
    if (timePoint !== undefined) eventData.timePoint = timePoint.trim();
    if (title !== undefined) eventData.title = title.trim();
    if (location !== undefined) eventData.location = location;
    if (characters !== undefined) eventData.characters = characters;
    if (impactLevel !== undefined) eventData.impactLevel = impactLevel;
    if (description !== undefined) eventData.description = description;
    if (sortOrder !== undefined) eventData.sortOrder = Number(sortOrder);
    if (timelineId !== undefined) eventData.timelineId = Number(timelineId);

    await db.update(timelineEvents).set(eventData).where(eq(timelineEvents.id, id));
    return NextResponse.json({ success: true, message: "更新事件节点成功" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "更新失败" }, { status: 500 });
  }
});

/**
 * 删除时间线或节点 (DELETE)
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // 'timeline' | 'event'
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    if (type === "timeline") {
      // 级联删除时间线下的所有节点
      await db.delete(timelineEvents).where(eq(timelineEvents.timelineId, id)).run();
      await db.delete(timelines).where(eq(timelines.id, id)).run();
      return NextResponse.json({ success: true, message: "删除时间线及节点成功" });
    }

    await db.delete(timelineEvents).where(eq(timelineEvents.id, id)).run();
    return NextResponse.json({ success: true, message: "删除事件节点成功" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "删除失败" }, { status: 500 });
  }
});
