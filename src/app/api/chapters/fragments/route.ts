// API: 记忆碎片灵感知识库（多租户归属校验、创建碎片、搜索列表与删除管理）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, memoryFragments } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";

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

    const list = await db
      .select()
      .from(memoryFragments)
      .where(and(eq(memoryFragments.workId, workId), eq(memoryFragments.userId, user.userId)))
      .orderBy(desc(memoryFragments.createdAt))
      .all();

    const filtered = keyword
      ? list.filter(
        (f) =>
          f.title.toLowerCase().includes(keyword.toLowerCase()) ||
          f.content.toLowerCase().includes(keyword.toLowerCase()) ||
          (f.tags && f.tags.toLowerCase().includes(keyword.toLowerCase()))
      )
      : list;

    return NextResponse.json({ success: true, result: filtered });
  } catch (error: any) {
    console.error("Get memory fragments error:", error);
    return NextResponse.json({ success: false, message: "获取记忆碎片失败" }, { status: 500 });
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
    const chapterId = body.chapterId ? Number(body.chapterId) : null;
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const sourceType = String(body.sourceType || "ai_chat");
    const tags = String(body.tags || "");

    if (!workId || !content) {
      return NextResponse.json({ success: false, message: "缺少必要内容或作品ID" }, { status: 400 });
    }
    if (!(await assertWorkOwnership(db, workId, user.userId))) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const res = await db
      .insert(memoryFragments)
      .values({
        workId,
        chapterId: chapterId || undefined,
        userId: user.userId,
        title: title || content.slice(0, 20) + (content.length > 20 ? "..." : ""),
        content,
        sourceType,
        tags: tags || undefined,
        createdAt: new Date(),
      })
      .returning()
      .get();

    return NextResponse.json({ success: true, result: res, message: "已成功存为记忆碎片" });
  } catch (error: any) {
    console.error("Create memory fragment error:", error);
    return NextResponse.json({ success: false, message: "保存记忆碎片失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    let fragmentId = Number(searchParams.get("id"));
    if (!fragmentId || isNaN(fragmentId)) {
      const body = await req.json().catch(() => ({}));
      fragmentId = Number(body?.id);
    }

    if (!fragmentId || isNaN(fragmentId)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(memoryFragments).where(and(eq(memoryFragments.id, fragmentId), eq(memoryFragments.userId, user.userId))).run();
    return NextResponse.json({ success: true, message: "删除记忆碎片成功" });
  } catch (error: any) {
    console.error("Delete memory fragment error:", error);
    return NextResponse.json({ success: false, message: "删除碎片失败" }, { status: 500 });
  }
});
