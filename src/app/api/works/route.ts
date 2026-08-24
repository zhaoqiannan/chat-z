import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters } from "@/db";
import { desc, eq, and } from "drizzle-orm";

/**
 * 获取当前用户的作品列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const userWorks = await db
      .select()
      .from(works)
      .where(eq(works.userId, user.userId))
      .orderBy(desc(works.createdAt));

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
 * 新建作品
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { title, tag, expectedWords, description, cover } = body;

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

    const parsedExpectedWords = typeof expectedWords === "number" ? expectedWords : (parseFloat(String(expectedWords || "50")) || 50.0);

    const newWork = {
      id: crypto.randomUUID(),
      userId: user.userId,
      title: title.trim(),
      tag: tag.trim(),
      expectedWords: parsedExpectedWords,
      wordCount: 0,
      status: "ongoing",
      description: description?.trim() || "",
      cover: cover || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(works).values(newWork);

    return NextResponse.json({
      success: true,
      result: newWork,
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
 * 编辑作品 (校验归属权)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id, title, tag, expectedWords, description, cover, status } = body;

    if (!id || !id.trim()) {
      return NextResponse.json(
        { success: false, message: "作品ID不能为空" },
        { status: 400 }
      );
    }

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

    // 检查作品是否存在且属于当前用户
    const existing = await db
      .select()
      .from(works)
      .where(and(eq(works.id, id), eq(works.userId, user.userId)))
      .get();

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限编辑" },
        { status: 404 }
      );
    }

    const parsedExpectedWords = expectedWords !== undefined
      ? (typeof expectedWords === "number" ? expectedWords : parseFloat(String(expectedWords)) || existing.expectedWords)
      : existing.expectedWords;

    const updatedWork = {
      title: title.trim(),
      tag: tag.trim(),
      expectedWords: parsedExpectedWords,
      description: description !== undefined ? description.trim() : existing.description,
      cover: cover !== undefined ? cover : existing.cover,
      status: status || existing.status,
      updatedAt: new Date(),
    };

    await db
      .update(works)
      .set(updatedWork)
      .where(and(eq(works.id, id), eq(works.userId, user.userId)));

    return NextResponse.json({
      success: true,
      result: { id, ...updatedWork },
      message: "编辑作品成功",
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

    // 支持通过 URL searchParams (如 /api/works/?id=xxx) 或请求 Body 获取 id
    let workId = req.nextUrl.searchParams.get("id");
    if (!workId) {
      try {
        const body = await req.json();
        workId = body?.id;
      } catch {
        // body 为空则忽略
      }
    }

    if (!workId || !workId.trim()) {
      return NextResponse.json(
        { success: false, message: "作品ID不能为空" },
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