// API: 章节纯文本修改历史版本快照管理（时间倒序查看、保存快照与安全删除）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapterVersions } from "@/db";
import { eq, and, desc } from "drizzle-orm";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const rawChapterId = searchParams.get("chapterId") || searchParams.get("chapter_id");
    const chapterId = Number(rawChapterId);

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "chapterId 无效" }, { status: 400 });
    }

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS chapter_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        chapter_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER DEFAULT 0,
        version_tag TEXT DEFAULT '手动保存快照',
        created_at INTEGER
      )`);
    } catch (_) {}

    const list = await db
      .select()
      .from(chapterVersions)
      .where(and(eq(chapterVersions.chapterId, chapterId), eq(chapterVersions.userId, user.userId)))
      .orderBy(desc(chapterVersions.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("Get chapter versions error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取版本历史失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json().catch(() => ({}));
    const workId = Number(body.workId);
    const chapterId = Number(body.chapterId);
    const title = String(body.title || "").trim();
    const content = String(body.content || "");
    const wordCount = Number(body.wordCount ?? content.replace(/\s+/g, "").length);
    const versionTag = String(body.versionTag || "手动保存快照");

    if (!workId || !chapterId || isNaN(workId) || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "缺少必要参数 workId 或 chapterId" }, { status: 400 });
    }

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS chapter_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        chapter_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER DEFAULT 0,
        version_tag TEXT DEFAULT '手动保存快照',
        created_at INTEGER
      )`);
    } catch (_) {}

    const res = await db
      .insert(chapterVersions)
      .values({
        workId,
        chapterId,
        userId: user.userId,
        title: title || "无标题快照",
        content,
        wordCount,
        versionTag,
        createdAt: new Date(),
      })
      .returning()
      .get();

    return NextResponse.json({ success: true, result: res, message: "版本快照已生成" });
  } catch (error: any) {
    console.error("Create chapter version error:", error);
    return NextResponse.json({ success: false, message: error?.message || "保存版本快照失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // 兼容从 Query 参数与 Request Body 两种方式解析 id
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get("id");
    let versionId: number | null = null;

    if (queryId && !isNaN(Number(queryId))) {
      versionId = Number(queryId);
    } else {
      const body = await req.json().catch(() => ({}));
      if (body && body.id && !isNaN(Number(body.id))) {
        versionId = Number(body.id);
      }
    }

    if (!versionId || isNaN(versionId)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db
      .delete(chapterVersions)
      .where(and(eq(chapterVersions.id, versionId), eq(chapterVersions.userId, user.userId)))
      .run();

    return NextResponse.json({ success: true, message: "删除版本记录成功" });
  } catch (error: any) {
    console.error("Delete chapter version error:", error);
    return NextResponse.json({ success: false, message: error?.message || "删除版本失败" }, { status: 500 });
  }
});
