import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, notes } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * 笔记列表查询 (GET)
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

    const list = await db
      .select()
      .from(notes)
      .where(eq(notes.workId, workId))
      .orderBy(desc(notes.id))
      .all();

    return NextResponse.json({
      success: true,
      result: list,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "获取笔记列表失败" }, { status: 500 });
  }
});

/**
 * 新建笔记 (POST)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { workId: rawWorkId, title, content, category, isTodo, priority } = body;
    const workId = Number(rawWorkId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: "笔记标题不能为空" }, { status: 400 });
    }

    const record = {
      workId,
      title: title.trim(),
      content: content || "",
      category: category || "memo",
      isTodo: isTodo ? 1 : 0,
      isCompleted: 0,
      priority: priority || "medium",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(notes).values(record).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || record,
      message: "创建笔记成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "创建笔记失败" }, { status: 500 });
  }
});

/**
 * 编辑笔记 / 切换完成状态 (PUT)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, title, content, category, isTodo, isCompleted, priority } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的笔记 id" }, { status: 400 });
    }

    const updatedData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updatedData.title = title.trim();
    if (content !== undefined) updatedData.content = content;
    if (category !== undefined) updatedData.category = category;
    if (isTodo !== undefined) updatedData.isTodo = isTodo ? 1 : 0;
    if (isCompleted !== undefined) updatedData.isCompleted = isCompleted ? 1 : 0;
    if (priority !== undefined) updatedData.priority = priority;

    await db.update(notes).set(updatedData).where(eq(notes.id, id));

    return NextResponse.json({
      success: true,
      message: "更新笔记成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "更新笔记失败" }, { status: 500 });
  }
});

/**
 * 删除笔记 (DELETE)
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(notes).where(eq(notes.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除笔记成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "删除笔记失败" }, { status: 500 });
  }
});
