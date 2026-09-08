import { dailyWordStats } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import dayjs from "dayjs";

/**
 * 记录用户当日新增字数（带表结构自动安全检查与 Upsert）
 */
export async function trackDailyWords(
  db: any,
  userId: string,
  wordsDelta: number
) {
  if (wordsDelta <= 0) return;

  const todayStr = dayjs().format("YYYY-MM-DD");

  try {
    // 检查今天是否已有记录
    const existing = await db
      .select()
      .from(dailyWordStats)
      .where(
        and(
          eq(dailyWordStats.userId, userId),
          eq(dailyWordStats.statDate, todayStr)
        )
      )
      .get();

    if (existing) {
      await db
        .update(dailyWordStats)
        .set({
          wordsAdded: sql`${dailyWordStats.wordsAdded} + ${wordsDelta}`,
          updatedAt: new Date(),
        })
        .where(eq(dailyWordStats.id, existing.id));
    } else {
      await db.insert(dailyWordStats).values({
        userId,
        statDate: todayStr,
        wordsAdded: wordsDelta,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (err: any) {
    if (err?.message?.includes("no such table: daily_word_stats")) {
      try {
        await db.run(`
          CREATE TABLE IF NOT EXISTS daily_word_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            stat_date TEXT NOT NULL,
            words_added INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (unixepoch() * 1000),
            updated_at INTEGER DEFAULT (unixepoch() * 1000)
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_word_stats_user_date ON daily_word_stats (user_id, stat_date);
        `);
        await db.insert(dailyWordStats).values({
          userId,
          statDate: todayStr,
          wordsAdded: wordsDelta,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (innerErr) {
        console.warn("写入 daily_word_stats 失败:", innerErr);
      }
    } else {
      console.warn("更新 daily_word_stats 失败:", err);
    }
  }
}
