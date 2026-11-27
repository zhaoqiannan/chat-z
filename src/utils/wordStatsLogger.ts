import { dailyWordStats } from "@/db";
import { sql } from "drizzle-orm";

export function getChinaDateStr(offsetDays = 0): string {
  const now = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return now.toISOString().slice(0, 10);
}

export function getChinaDayOfWeek(): number {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return now.getUTCDay();
}

/**
 * 原子更新用户当日净增字数（支持正负增量，下限保护为 0，单条 ON CONFLICT Upsert）
 */
export async function trackDailyWords(db: any, userId: string, wordsDelta: number) {
  if (!userId || !Number.isFinite(wordsDelta) || wordsDelta === 0) return;
  const todayStr = getChinaDateStr();
  const now = new Date();
  const initialWords = Math.max(0, wordsDelta);

  try {
    await db
      .insert(dailyWordStats)
      .values({
        userId,
        statDate: todayStr,
        wordsAdded: initialWords,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyWordStats.userId, dailyWordStats.statDate],
        set: {
          wordsAdded: sql`MAX(0, ${dailyWordStats.wordsAdded} + ${wordsDelta})`,
          updatedAt: now,
        },
      })
      .run();
  } catch (err) {
    console.warn("更新 daily_word_stats 失败:", err);
  }
}
