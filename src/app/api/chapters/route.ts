import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, works } from "@/db";
import { eq, and, asc, desc } from "drizzle-orm";

/**
 * 校验作品归属权
 */
async function checkWorkOwnership(db: any, workId: number, userId: string) {
  const work = await db
    .select()
    .from(works)
    .where(and(eq(works.id, workId), eq(works.userId, userId)))
    .get();
  return work;
}

/**
 * 重新计算并更新作品的总字数与正文章节总数
 */
async function recountWorkWords(db: any, workId: number) {
  const allChapters = await db
    .select({ wordCount: chapters.wordCount })
    .from(chapters)
    .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0)));

  const totalWords = allChapters.reduce((sum: number, c: any) => sum + (c.wordCount || 0), 0);
  const totalChapters = allChapters.length;

  await db
    .update(works)
    .set({
      wordCount: totalWords,
      chapterCount: totalChapters,
      updatedAt: new Date(),
    })
    .where(eq(works.id, workId));
}

/**
 * 获取指定作品的章节与卷列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const rawWorkId = req.nextUrl.searchParams.get("workId");
    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的 workId" },
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
 * 新建卷或章节 (自增数字 ID, 自动递增章节号)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      volumeId: rawVolumeId,
      isVolume,
      title,
      content,
      status,
      summary,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的作品ID" },
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
    const volumeId = rawVolumeId ? Number(rawVolumeId) : null;

    const newChapterData = {
      workId,
      userId: user.userId,
      volumeId,
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

    const inserted = await db.insert(chapters).values(newChapterData).returning().get();

    // 重新统计作品总字数与章节总数
    if (!isVol) {
      await recountWorkWords(db, workId);
    }

    return NextResponse.json({
      success: true,
      result: inserted || newChapterData,
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
    const { id: rawId, title, content, status, summary, volumeId: rawVolumeId, chapterNumber } = body;

    const chapterId = Number(rawId);
    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json(
        { success: false, message: "无效的章节ID" },
        { status: 400 }
      );
    }

    const chapter = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.id, chapterId), eq(chapters.userId, user.userId)))
      .get();

    if (!chapter) {
      return NextResponse.json(
        { success: false, message: "章节不存在或无权操作" },
        { status: 404 }
      );
    }

    const textContent = content !== undefined ? content : chapter.content;
    const wordCount = chapter.isVolume ? 0 : (textContent || "").replace(/\s+/g, "").length;
    const volumeId = rawVolumeId !== undefined ? (rawVolumeId ? Number(rawVolumeId) : null) : chapter.volumeId;

    const updatedData = {
      title: title !== undefined ? title.trim() : chapter.title,
      content: textContent,
      wordCount,
      status: status || chapter.status,
      summary: summary !== undefined ? summary.trim() : chapter.summary,
      volumeId,
      chapterNumber: typeof chapterNumber === "number" ? chapterNumber : chapter.chapterNumber,
      updatedAt: new Date(),
    };

    await db.update(chapters).set(updatedData).where(eq(chapters.id, chapterId));

    // 重新统计作品字数
    if (!chapter.isVolume) {
      await recountWorkWords(db, chapter.workId);
    }

    return NextResponse.json({
      success: true,
      result: { id: chapterId, ...updatedData },
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

    let rawId = req.nextUrl.searchParams.get("id");
    if (!rawId) {
      try {
        const body = await req.json();
        rawId = body?.id;
      } catch {}
    }

    const chapterId = Number(rawId);
    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json(
        { success: false, message: "无效的章节ID" },
        { status: 400 }
      );
    }

    const chapter = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.id, chapterId), eq(chapters.userId, user.userId)))
      .get();

    if (!chapter) {
      return NextResponse.json(
        { success: false, message: "章节不存在或无权操作" },
        { status: 404 }
      );
    }

    // 如果删除的是卷，将其下的子章节 volume_id 置为空
    if (chapter.isVolume) {
      await db
        .update(chapters)
        .set({ volumeId: null })
        .where(eq(chapters.volumeId, chapterId));
    }

    await db.delete(chapters).where(eq(chapters.id, chapterId));

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
