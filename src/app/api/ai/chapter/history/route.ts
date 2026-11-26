import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapterAiHistory } from "@/db";
import { eq, desc } from "drizzle-orm";
import { assertChapterOwnership, assertWorkOwnership } from "@/utils/ownership";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const chapterId = Number(searchParams.get("chapterId"));
    const workId = searchParams.get("workId") ? Number(searchParams.get("workId")) : undefined;

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 chapterId" }, { status: 400 });
    }

    const owned = await assertChapterOwnership(db, chapterId, user.userId, workId);
    if (!owned) {
      return NextResponse.json({ success: false, message: "章节不存在或无权访问" }, { status: 403 });
    }

    const list = await db
      .select()
      .from(chapterAiHistory)
      .where(eq(chapterAiHistory.chapterId, chapterId))
      .orderBy(desc(chapterAiHistory.id))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (err: any) {
    console.error("获取章节 AI 历史记录失败:", err);
    return NextResponse.json({ success: false, message: "获取历史记录失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少合法的 id" }, { status: 400 });
    }

    const record = await db.select().from(chapterAiHistory).where(eq(chapterAiHistory.id, id)).get();
    if (!record) {
      return NextResponse.json({ success: false, message: "历史记录不存在" }, { status: 404 });
    }
    if (!(await assertWorkOwnership(db, record.workId, user.userId))) {
      return NextResponse.json({ success: false, message: "无权删除该历史记录" }, { status: 403 });
    }

    await db.delete(chapterAiHistory).where(eq(chapterAiHistory.id, id)).run();
    return NextResponse.json({ success: true, message: "删除历史记录成功" });
  } catch (err: any) {
    console.error("删除章节 AI 历史记录失败:", err);
    return NextResponse.json({ success: false, message: "删除历史记录失败" }, { status: 500 });
  }
});
