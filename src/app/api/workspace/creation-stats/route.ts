import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, dailyWordStats, works, chapters } from "@/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { getChinaDateStr, getChinaDayOfWeek } from "@/utils/wordStatsLogger";

/**
 * 获取创作统计数据 (今日写作、本周写作、连续写作天数、总字数，统一采用 UTC+8 日期口径)
 */
export const GET = withAuth(async (_req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const todayStr = getChinaDateStr(0);
    const dayOfWeek = getChinaDayOfWeek(); // 0(周日) ~ 6(周六)
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const mondayStr = getChinaDateStr(-daysSinceMonday);

    // 1. 总字数统计 (所有作品 actual word_count 汇总)
    let totalWords = 0;
    try {
      const userWorks = await db
        .select({ wordCount: works.wordCount })
        .from(works)
        .where(eq(works.userId, user.userId));
      totalWords = userWorks.reduce((acc: number, w: any) => acc + (w.wordCount || 0), 0);
    } catch (e) {
      console.warn("计算总字数异常:", e);
    }

    // 2. 今日写作字数
    let todayWords = 0;
    try {
      const todayRecord = await db
        .select({ wordsAdded: dailyWordStats.wordsAdded })
        .from(dailyWordStats)
        .where(
          and(
            eq(dailyWordStats.userId, user.userId),
            eq(dailyWordStats.statDate, todayStr)
          )
        )
        .get();

      if (todayRecord) {
        todayWords = todayRecord.wordsAdded || 0;
      }
    } catch (e) {
      console.warn("查询今日写作异常:", e);
    }

    // 3. 本周写作字数
    let weekWords = 0;
    try {
      const weekRecords = await db
        .select({ wordsAdded: dailyWordStats.wordsAdded })
        .from(dailyWordStats)
        .where(
          and(
            eq(dailyWordStats.userId, user.userId),
            gte(dailyWordStats.statDate, mondayStr)
          )
        );

      weekWords = weekRecords.reduce((acc: number, r: any) => acc + (r.wordsAdded || 0), 0);
    } catch (e) {
      console.warn("查询本周写作异常:", e);
    }

    // 4. 连续写作天数 (Streak) 计算
    let streakDays = 0;
    try {
      const allDaily = await db
        .select({ statDate: dailyWordStats.statDate, wordsAdded: dailyWordStats.wordsAdded })
        .from(dailyWordStats)
        .where(and(eq(dailyWordStats.userId, user.userId), gte(dailyWordStats.wordsAdded, 1)))
        .orderBy(desc(dailyWordStats.statDate))
        .all();

      const activeDates = new Set(allDaily.map((d: any) => d.statDate));

      const yesterdayStr = getChinaDateStr(-1);
      let offsetDays: number | null = 0;

      // 如果今天还没写，检查昨天是否写了；如果昨天写了，连击保留
      if (!activeDates.has(todayStr)) {
        if (activeDates.has(yesterdayStr)) {
          offsetDays = -1;
        } else {
          offsetDays = null;
        }
      }

      if (offsetDays !== null) {
        while (activeDates.has(getChinaDateStr(offsetDays))) {
          streakDays++;
          offsetDays -= 1;
        }
      }
    } catch (e) {
      console.warn("计算连续写作天数异常:", e);
    }

    // 5. 首次使用兜底（如果没有任何 daily_word_stats 数据，但作品已有字数）
    if (totalWords > 0 && todayWords === 0 && weekWords === 0 && streakDays === 0) {
      // 检查最近章节更新时间
      const recentCh = await db
        .select({ updatedAt: chapters.updatedAt, wordCount: chapters.wordCount })
        .from(chapters)
        .where(and(eq(chapters.userId, user.userId), eq(chapters.isVolume, 0)))
        .orderBy(desc(chapters.updatedAt))
        .limit(1)
        .get();

      if (recentCh && recentCh.updatedAt) {
        const updateDate = new Date(new Date(recentCh.updatedAt).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
        if (updateDate === todayStr) {
          todayWords = recentCh.wordCount || 0;
          weekWords = recentCh.wordCount || 0;
          streakDays = 1;
        } else if (updateDate >= mondayStr) {
          weekWords = recentCh.wordCount || 0;
          streakDays = 1;
        }
      }
    }

    const result = [
      {
        id: "week",
        label: "本周写作",
        value: weekWords.toLocaleString(),
        unit: "字",
        color: "#00c9ff",
      },
      {
        id: "today",
        label: "今日写作",
        value: todayWords.toLocaleString(),
        unit: "字",
        color: "#10b981",
      },
      {
        id: "streak",
        label: "连续写作",
        value: streakDays.toString(),
        unit: "天",
        color: "#f59e0b",
      },
      {
        id: "total",
        label: "总字数",
        value: totalWords.toLocaleString(),
        unit: "字",
        color: "#1e293b",
      },
    ];

    return NextResponse.json({
      success: true,
      result,
      message: "获取创作统计成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "获取创作统计失败",
      },
      { status: 500 }
    );
  }
});
