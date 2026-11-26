import { dailyWordStats } from "@/db";
import { sql } from "drizzle-orm";

function getChinaDateStr(): string {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

/**
 * 原子累加用户当日新增字数（单条 ON CONFLICT Upsert，消除并发冲突与双语句报错）
 */
export async function trackDailyWords(db: any, userId: string, wordsDelta: number) {
  if (!userId || wordsDelta <= 0) return;
  const todayStr = getChinaDateStr();
  const now = new Date();

  try {
    await db
      .insert(dailyWordStats)
      .values({
        userId,
        statDate: todayStr,
        wordsAdded: wordsDelta,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyWordStats.userId, dailyWordStats.statDate],
        set: {
          wordsAdded: sql`${dailyWordStats.wordsAdded} + ${wordsDelta}`,
          updatedAt: now,
        },
      })
      .run();
  } catch (err) {
    console.warn("更新 daily_word_stats 失败:", err);
  }
}
