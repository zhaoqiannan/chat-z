import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters } from "@/db";
import { desc, eq, and } from "drizzle-orm";

/**
 * 获取当前用户的作品列表或单条作品详情
 * 支持 /api/works/ (获取列表) 或 /api/works/?id=123 (获取单本详情)
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rawId = req.nextUrl.searchParams.get("id");

    // 1. 获取单个作品详情
    if (rawId) {
      const workId = Number(rawId);
      if (!workId || isNaN(workId)) {
        return NextResponse.json(
          { success: false, message: "无效的作品ID" },
          { status: 400 }
        );
      }

      const workDetail = await db
        .select()
        .from(works)
        .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
        .get();

      if (!workDetail) {
        return NextResponse.json(
          { success: false, message: "作品不存在或无权限访问" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        result: workDetail,
        message: "获取作品详情成功",
      });
    }

    // 2. 获取作品列表（置顶优先，置顶时间倒序，创建时间倒序）
    const userWorks = await db
      .select()
      .from(works)
      .where(eq(works.userId, user.userId))
      .orderBy(desc(works.isPinned), desc(works.pinnedAt), desc(works.createdAt));

    return NextResponse.json({
      success: true,
      result: userWorks,
      message: "获取作品列表成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "获取作品列表失败",
      },
      { status: 500 }
    );
  }
});

/**
 * 新建作品 (自增数字 ID, INT 目标字数, 支持置顶, 预计章节数)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { title, tag, expectedWords, expectedChapters, description, cover, isPinned } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, message: "作品名称不能为空" },
        { status: 400 }
      );
    }

    if (!tag || !tag.trim()) {
      return NextResponse.json(
        { success: false, message: "作品类别不能为空" },
        { status: 400 }
      );
    }

    const parsedExpectedWords = Math.round(Number(expectedWords) || 500000);
    const parsedExpectedChapters = Math.round(Number(expectedChapters) || 100);
    const pinned = isPinned ? 1 : 0;

    const newWorkData = {
      userId: user.userId,
      title: title.trim(),
      tag: tag.trim(),
      expectedWords: parsedExpectedWords,
      expectedChapters: parsedExpectedChapters,
      wordCount: 0,
      chapterCount: 0,
      status: "ongoing",
      description: description?.trim() || "",
      cover: cover || "",
      isPinned: pinned,
      pinnedAt: pinned ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(works).values(newWorkData).returning().get();

    let resultWork: any = inserted;
    if (!resultWork || !resultWork.id) {
      resultWork = await db
        .select()
        .from(works)
        .where(eq(works.userId, user.userId))
        .orderBy(desc(works.id))
        .limit(1)
        .get();
    }

    return NextResponse.json({
      success: true,
      result: resultWork || newWorkData,
      message: "新建作品成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "创建作品失败",
      },
      { status: 500 }
    );
  }
});

/**
 * 编辑作品 (支持全量编辑或单字段如置顶更新)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id, title, tag, expectedWords, expectedChapters, description, cover, status, isPinned } = body;

    const workId = Number(id);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的作品ID" },
        { status: 400 }
      );
    }

    // 检查作品是否存在且属于当前用户
    const existing = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限编辑" },
        { status: 404 }
      );
    }

    const parsedExpectedWords = expectedWords !== undefined
      ? Math.round(Number(expectedWords) || existing.expectedWords || 500000)
      : existing.expectedWords;

    const parsedExpectedChapters = expectedChapters !== undefined
      ? Math.round(Number(expectedChapters) || existing.expectedChapters || 100)
      : existing.expectedChapters;

    // 处理置顶状态与置顶时间
    let nextIsPinned = existing.isPinned;
    let nextPinnedAt = existing.pinnedAt;
    if (isPinned !== undefined) {
      const isPinBool = Boolean(isPinned);
      nextIsPinned = isPinBool ? 1 : 0;
      nextPinnedAt = isPinBool ? new Date() : null;
    }

    const updatedWork = {
      title: title !== undefined ? title.trim() : existing.title,
      tag: tag !== undefined ? tag.trim() : existing.tag,
      expectedWords: parsedExpectedWords,
      expectedChapters: parsedExpectedChapters,
      description: description !== undefined ? description.trim() : existing.description,
      cover: cover !== undefined ? cover : existing.cover,
      status: status || existing.status,
      isPinned: nextIsPinned,
      pinnedAt: nextPinnedAt,
      updatedAt: new Date(),
    };

    await db
      .update(works)
      .set(updatedWork)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)));

    return NextResponse.json({
      success: true,
      result: { id: workId, ...updatedWork },
      message: isPinned !== undefined && title === undefined ? (nextIsPinned ? "置顶成功" : "已取消置顶") : "编辑作品成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "编辑作品失败",
      },
      { status: 500 }
    );
  }
});

/**
 * 删除作品 (级联删除作品及所有章节)
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    let rawId = req.nextUrl.searchParams.get("id");
    if (!rawId) {
      try {
        const body = await req.json();
        rawId = body?.id;
      } catch {}
    }

    const workId = Number(rawId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的作品ID" },
        { status: 400 }
      );
    }

    // 检查归属权
    const existing = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限删除" },
        { status: 404 }
      );
    }

    // 1. 级联删除该作品下的所有章节
    await db.delete(chapters).where(eq(chapters.workId, workId));

    // 2. 删除作品自身
    await db
      .delete(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)));

    return NextResponse.json({
      success: true,
      message: "删除作品成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "删除作品失败",
      },
      { status: 500 }
    );
  }
});