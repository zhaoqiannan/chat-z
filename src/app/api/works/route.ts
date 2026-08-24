import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works } from "@/db";
import { desc, eq } from "drizzle-orm";

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

    const newWork = {
      id: crypto.randomUUID(),
      userId: user.userId,
      title: title.trim(),
      tag: tag.trim(),
      expectedWords: expectedWords?.trim() || "50,000",
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
