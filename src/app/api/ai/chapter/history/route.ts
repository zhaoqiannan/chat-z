import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapterAiHistory, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * 获取指定章节的 AI 创作历史版本列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const chapterId = Number(searchParams.get("chapterId"));
    const workId = Number(searchParams.get("workId"));

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json(
        { success: false, message: "缺少合法的 chapterId" },
        { status: 400 }
      );
    }

    // 鉴权：确认该作品归属当前用户
    if (workId) {
      const work = await db
        .select()
        .from(works)
        .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
        .get();
      if (!work) {
        return NextResponse.json(
          { success: false, message: "作品不存在或无权限" },
          { status: 403 }
        );
      }
    }

    const list = await db
      .select()
      .from(chapterAiHistory)
      .where(eq(chapterAiHistory.chapterId, chapterId))
      .orderBy(desc(chapterAiHistory.id))
      .all();

    return NextResponse.json({
      success: true,
      result: list,
    });
  } catch (err: any) {
    console.error("获取章节 AI 历史记录失败:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "服务器内部错误" },
      { status: 500 }
    );
  }
});

/**
 * 删除指定的章节 AI 历史记录
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "缺少合法的 id" },
        { status: 400 }
      );
    }

    await db.delete(chapterAiHistory).where(eq(chapterAiHistory.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除历史记录成功",
    });
  } catch (err: any) {
    console.error("删除章节 AI 历史记录失败:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "服务器内部错误" },
      { status: 500 }
    );
  }
});
