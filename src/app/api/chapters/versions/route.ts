// API: 章节纯文本修改历史版本快照管理（多租户归属校验、时间倒序查看、保存快照与安全删除）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapterVersions } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { assertChapterOwnership, parseJsonBody } from "@/utils/ownership";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const chapterId = Number(searchParams.get("chapterId") || searchParams.get("chapter_id"));
    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "chapterId 无效" }, { status: 400 });
    }

    const list = await db
      .select()
      .from(chapterVersions)
      .where(and(eq(chapterVersions.chapterId, chapterId), eq(chapterVersions.userId, user.userId)))
      .orderBy(desc(chapterVersions.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("Get chapter versions error:", error);
    return NextResponse.json({ success: false, message: "获取版本历史失败" }, { status: 500 });
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
    const chapterId = Number(body.chapterId);
    const title = String(body.title || "").trim();
    const content = String(body.content || "");
    const rawWordCount = Number(body.wordCount);
    const wordCount = Number.isFinite(rawWordCount) && rawWordCount >= 0 ? rawWordCount : content.replace(/\s+/g, "").length;
    const versionTag = String(body.versionTag || "手动保存快照");

    if (!workId || !chapterId || isNaN(workId) || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "缺少必要参数 workId 或 chapterId" }, { status: 400 });
    }
    if (!(await assertChapterOwnership(db, chapterId, user.userId, workId))) {
      return NextResponse.json({ success: false, message: "章节不存在或无权操作" }, { status: 403 });
    }

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
    return NextResponse.json({ success: false, message: "保存版本快照失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    let versionId = Number(searchParams.get("id"));
    if (!versionId || isNaN(versionId)) {
      const body = await req.json().catch(() => ({}));
      versionId = Number(body?.id);
    }

    if (!versionId || isNaN(versionId)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(chapterVersions).where(and(eq(chapterVersions.id, versionId), eq(chapterVersions.userId, user.userId))).run();
    return NextResponse.json({ success: true, message: "删除版本记录成功" });
  } catch (error: any) {
    console.error("Delete chapter version error:", error);
    return NextResponse.json({ success: false, message: "删除版本失败" }, { status: 500 });
  }
});
