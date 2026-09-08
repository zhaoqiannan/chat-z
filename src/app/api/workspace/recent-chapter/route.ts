import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, chapters, works } from "@/db";
import { desc, eq, and } from "drizzle-orm";

/**
 * 获取用户最近编辑的小说与章节
 * 
 * 逻辑：
 * 1. 优先查找该用户最近更新的正文章节 (is_volume = 0)，按 chapters.updatedAt 降序排列取第 1 条，
 *    并关联 works 表获取作品名称、作品总字数等信息。
 * 2. 如果用户还没有写过任何具体章节（例如仅新建了作品），则退化为查找该用户最近更新的作品 (works.updatedAt 降序)。
 * 3. 如果用户没有任何作品，则返回 null。
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // 1. 优先查最近更新的正文章节 (排除分卷文件夹)
    const recentChapters = await db
      .select({
        chapterId: chapters.id,
        chapterTitle: chapters.title,
        chapterNumber: chapters.chapterNumber,
        chapterWordCount: chapters.wordCount,
        chapterUpdatedAt: chapters.updatedAt,
        workId: chapters.workId,
      })
      .from(chapters)
      .where(and(eq(chapters.userId, user.userId), eq(chapters.isVolume, 0)))
      .orderBy(desc(chapters.updatedAt))
      .limit(1);

    if (recentChapters.length > 0) {
      const recentCh = recentChapters[0];
      // 获取对应的作品信息
      const work = await db
        .select({
          id: works.id,
          title: works.title,
          wordCount: works.wordCount,
          expectedWords: works.expectedWords,
        })
        .from(works)
        .where(eq(works.id, recentCh.workId))
        .get();

      if (work) {
        const totalWords = work.wordCount || 0;
        const formattedTotalWords = totalWords.toLocaleString();
        const displayChapterTitle = recentCh.chapterNumber
          ? `第 ${recentCh.chapterNumber} 章 · ${recentCh.chapterTitle}`
          : recentCh.chapterTitle;

        return NextResponse.json({
          success: true,
          result: {
            workId: work.id,
            chapterId: recentCh.chapterId,
            novelTitle: work.title,
            chapterTitle: displayChapterTitle,
            wordCount: formattedTotalWords,
            progressDesc: `已写 ${formattedTotalWords} 字 · 持续创作中`,
          },
        });
      }
    }

    // 2. 兜底：如果暂无章节，查找该用户最近更新的作品
    const recentWork = await db
      .select({
        id: works.id,
        title: works.title,
        wordCount: works.wordCount,
        chapterCount: works.chapterCount,
      })
      .from(works)
      .where(eq(works.userId, user.userId))
      .orderBy(desc(works.updatedAt))
      .limit(1);

    if (recentWork.length > 0) {
      const w = recentWork[0];
      const totalWords = w.wordCount || 0;
      return NextResponse.json({
        success: true,
        result: {
          workId: w.id,
          chapterId: null,
          novelTitle: w.title,
          chapterTitle: "暂无章节，点击前往创作",
          wordCount: totalWords.toLocaleString(),
          progressDesc: `已创建作品 · 尚未添加章节`,
        },
      });
    }

    // 3. 用户没有任何作品与章节
    return NextResponse.json({
      success: true,
      result: null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "获取最近编辑内容失败",
      },
      { status: 500 }
    );
  }
});
