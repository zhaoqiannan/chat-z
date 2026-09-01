// API: 记忆碎片灵感知识库（创建碎片、搜索列表与删除管理）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, memoryFragments } from "@/db";
import { eq, and, desc, like, or } from "drizzle-orm";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const keyword = searchParams.get("keyword")?.trim();

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "workId 无效" }, { status: 400 });
    }

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS memory_fragments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        chapter_id INTEGER,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_type TEXT DEFAULT 'ai_chat',
        tags TEXT,
        created_at INTEGER
      )`);
    } catch (_) {}

    let query = db.select().from(memoryFragments).where(and(eq(memoryFragments.workId, workId), eq(memoryFragments.userId, user.userId))).$dynamic();

    const list = await query.orderBy(desc(memoryFragments.createdAt)).all();

    const filtered = keyword
      ? list.filter((f) => f.title.toLowerCase().includes(keyword.toLowerCase()) || f.content.toLowerCase().includes(keyword.toLowerCase()) || (f.tags && f.tags.toLowerCase().includes(keyword.toLowerCase())))
      : list;

    return NextResponse.json({ success: true, result: filtered });
  } catch (error: any) {
    console.error("Get memory fragments error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取记忆碎片失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const chapterId = body.chapterId ? Number(body.chapterId) : null;
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const sourceType = String(body.sourceType || "ai_chat");
    const tags = String(body.tags || "");

    if (!workId || !content) {
      return NextResponse.json({ success: false, message: "缺少必要内容或作品ID" }, { status: 400 });
    }

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS memory_fragments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        chapter_id INTEGER,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source_type TEXT DEFAULT 'ai_chat',
        tags TEXT,
        created_at INTEGER
      )`);
    } catch (_) {}

    const res = await db.insert(memoryFragments).values({
      workId,
      chapterId: chapterId || undefined,
      userId: user.userId,
      title: title || (content.slice(0, 20) + (content.length > 20 ? "..." : "")),
      content,
      sourceType,
      tags: tags || undefined,
      createdAt: new Date(),
    }).returning().get();

    return NextResponse.json({ success: true, result: res, message: "已成功存为记忆碎片" });
  } catch (error: any) {
    console.error("Create memory fragment error:", error);
    return NextResponse.json({ success: false, message: error?.message || "保存记忆碎片失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(memoryFragments).where(and(eq(memoryFragments.id, id), eq(memoryFragments.userId, user.userId))).run();

    return NextResponse.json({ success: true, message: "删除记忆碎片成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除碎片失败" }, { status: 500 });
  }
});
