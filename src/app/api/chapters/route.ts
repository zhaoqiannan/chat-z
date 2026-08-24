import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, works } from "@/db";
import { eq, and, asc, desc, max, sql } from "drizzle-orm";

/**
 * 校验作品归属权
 */
async function checkWorkOwnership(db: any, workId: string, userId: string) {
  const work = await db
    .select()
    .from(works)
    .where(and(eq(works.id, workId), eq(works.userId, userId)))
    .get();
  return work;
}

/**
 * 重新计算并更新作品的总字数
 */
async function recountWorkWords(db: any, workId: string) {
  const allChapters = await db
    .select({ wordCount: chapters.wordCount })
    .from(chapters)
    .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0)));

  const totalWords = allChapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);

  await db
    .update(works)
    .set({ wordCount: totalWords, updatedAt: new Date() })
    .where(eq(works.id, workId));
}

/**
 * 获取指定作品的章节与卷列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const workId = req.nextUrl.searchParams.get("workId");
    if (!workId) {
      return NextResponse.json(
        { success: false, message: "workId 不能为空" },
        { status: 400 }
      );
    }

    const work = await checkWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无访问权限" },
        { status: 403 }
      );
    }

    const list = await db
      .select()
      .from(chapters)
      .where(eq(chapters.workId, workId))
      .orderBy(desc(chapters.isVolume), asc(chapters.chapterNumber), asc(chapters.createdAt));

    return NextResponse.json({
      success: true,
      result: list,
      message: "获取章节列表成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "获取章节失败" },
      { status: 500 }
    );
  }
});

/**
 * 新建卷或章节 (自动计算顺序章节号)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId,
      volumeId,
      isVolume,
      title,
      content,
      status,
      summary,
    } = body;

    if (!workId || !workId.trim()) {
      return NextResponse.json(
        { success: false, message: "作品ID不能为空" },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, message: "标题不能为空" },
        { status: 400 }
      );
    }

    const work = await checkWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json(
        { success: false, message: "无权操作该作品" },
        { status: 403 }
      );
    }

    const isVol = Boolean(isVolume);
    let autoChapterNumber = 1;

    // 如果是章节，自动顺序递增计算 chapter_number
    if (!isVol) {
      const existingChapters = await db
        .select({ chapterNumber: chapters.chapterNumber })
        .from(chapters)
        .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0)))
        .orderBy(desc(chapters.chapterNumber))
        .limit(1);

      if (existingChapters.length > 0 && typeof existingChapters[0].chapterNumber === "number") {
        autoChapterNumber = existingChapters[0].chapterNumber + 1;
      }
    }

    const textContent = content || "";
    const wordCount = textContent.replace(/\s+/g, "").length;

    const newChapter = {
      id: crypto.randomUUID(),
      workId: workId.trim(),
      volumeId: volumeId || null,
      isVolume: isVol ? 1 : 0,
      title: title.trim(),
      content: textContent,
      wordCount: isVol ? 0 : wordCount,
      chapterNumber: autoChapterNumber,
      status: status || "not_started",
      summary: summary?.trim() || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(chapters).values(newChapter);

    // 重新统计作品总字数
    if (!isVol && wordCount > 0) {
      await recountWorkWords(db, workId);
    }

    return NextResponse.json({
      success: true,
      result: newChapter,
      message: isVol ? "新建卷成功" : `成功新建第 ${autoChapterNumber} 章`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "创建章节失败" },
      { status: 500 }
    );
  }
});

/**
 * 编辑章节或卷
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id, title, content, status, summary, volumeId, chapterNumber } = body;

    if (!id || !id.trim()) {
      return NextResponse.json(
        { success: false, message: "章节ID不能为空" },
        { status: 400 }
      );
    }

    const chapter = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, id))
      .get();

    if (!chapter) {
      return NextResponse.json(
        { success: false, message: "章节不存在" },
        { status: 404 }
      );
    }

    const work = await checkWorkOwnership(db, chapter.workId, user.userId);
    if (!work) {
      return NextResponse.json(
        { success: false, message: "无权编辑该章节" },
        { status: 403 }
      );
    }

    const textContent = content !== undefined ? content : chapter.content;
    const wordCount = chapter.isVolume ? 0 : (textContent || "").replace(/\s+/g, "").length;

    const updatedData = {
      title: title !== undefined ? title.trim() : chapter.title,
      content: textContent,
      wordCount,
      status: status || chapter.status,
      summary: summary !== undefined ? summary.trim() : chapter.summary,
      volumeId: volumeId !== undefined ? volumeId : chapter.volumeId,
      chapterNumber: typeof chapterNumber === "number" ? chapterNumber : chapter.chapterNumber,
      updatedAt: new Date(),
    };

    await db.update(chapters).set(updatedData).where(eq(chapters.id, id));

    // 重新统计作品字数
    if (!chapter.isVolume) {
      await recountWorkWords(db, chapter.workId);
    }

    return NextResponse.json({
      success: true,
      result: { id, ...updatedData },
      message: "更新章节成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "更新章节失败" },
      { status: 500 }
    );
  }
});

/**
 * 删除章节或卷
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    let id = req.nextUrl.searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id || !id.trim()) {
      return NextResponse.json(
        { success: false, message: "ID不能为空" },
        { status: 400 }
      );
    }

    const chapter = await db
      .select()
      .from(chapters)
      .where(eq(chapters.id, id))
      .get();

    if (!chapter) {
      return NextResponse.json(
        { success: false, message: "章节不存在" },
        { status: 404 }
      );
    }

    const work = await checkWorkOwnership(db, chapter.workId, user.userId);
    if (!work) {
      return NextResponse.json(
        { success: false, message: "无权删除该章节" },
        { status: 403 }
      );
    }

    // 如果删除的是卷，将其下的子章节 volume_id 置为空
    if (chapter.isVolume) {
      await db
        .update(chapters)
        .set({ volumeId: null })
        .where(eq(chapters.volumeId, id));
    }

    await db.delete(chapters).where(eq(chapters.id, id));

    // 重新统计作品总字数
    if (!chapter.isVolume) {
      await recountWorkWords(db, chapter.workId);
    }

    return NextResponse.json({
      success: true,
      message: chapter.isVolume ? "删除卷成功" : "删除章节成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "删除章节失败" },
      { status: 500 }
    );
  }
});
