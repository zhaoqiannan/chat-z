import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, outlineAiHistory, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET: 获取指定作品的大纲 AI 推演历史列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const nodeId = searchParams.get("nodeId");

    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的作品ID" },
        { status: 400 }
      );
    }

    // 校验作品归属
    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限访问" },
        { status: 403 }
      );
    }

    const conditions = [eq(outlineAiHistory.workId, workId)];
    if (nodeId) {
      conditions.push(eq(outlineAiHistory.nodeId, nodeId));
    }

    const historyList = await db
      .select()
      .from(outlineAiHistory)
      .where(and(...conditions))
      .orderBy(desc(outlineAiHistory.createdAt))
      .all();

    return NextResponse.json({
      success: true,
      result: historyList,
    });
  } catch (error: any) {
    console.error("Fetch outline AI history error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "获取 AI 历史记录异常" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: 删除指定的 AI 推演历史记录
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "缺少待删除的历史记录ID" },
        { status: 400 }
      );
    }

    // 验证记录存在及作品权限
    const record = await db
      .select()
      .from(outlineAiHistory)
      .where(eq(outlineAiHistory.id, id))
      .get();

    if (!record) {
      return NextResponse.json(
        { success: false, message: "历史记录不存在" },
        { status: 404 }
      );
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, record.workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json(
        { success: false, message: "无权限删除此记录" },
        { status: 403 }
      );
    }

    await db.delete(outlineAiHistory).where(eq(outlineAiHistory.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "历史记录已删除",
    });
  } catch (error: any) {
    console.error("Delete outline AI history error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "删除 AI 历史记录失败" },
      { status: 500 }
    );
  }
});
