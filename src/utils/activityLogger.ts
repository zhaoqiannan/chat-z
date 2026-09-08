import { activityLogs } from "@/db";

export interface LogActivityParams {
  userId: string;
  workId?: number | null;
  workTitle?: string | null;
  targetType: "work" | "chapter";
  targetId?: number | null;
  targetTitle?: string | null;
  action: "create" | "update" | "delete";
  description?: string;
}

/**
 * 记录用户动态日志（带表结构自动安全检查）
 */
export async function logUserActivity(db: any, params: LogActivityParams) {
  try {
    await db.insert(activityLogs).values({
      userId: params.userId,
      workId: params.workId || null,
      workTitle: params.workTitle || null,
      targetType: params.targetType,
      targetId: params.targetId || null,
      targetTitle: params.targetTitle || null,
      action: params.action,
      description: params.description || null,
      createdAt: new Date(),
    });
  } catch (err: any) {
    // 如果表尚未创建，自动创建后再写入一次
    if (err?.message?.includes("no such table: activity_logs")) {
      try {
        await db.run(`
          CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            work_id INTEGER,
            work_title TEXT,
            target_type TEXT NOT NULL,
            target_id INTEGER,
            target_title TEXT,
            action TEXT NOT NULL,
            description TEXT,
            created_at INTEGER DEFAULT (unixepoch() * 1000)
          );
        `);
        await db.insert(activityLogs).values({
          userId: params.userId,
          workId: params.workId || null,
          workTitle: params.workTitle || null,
          targetType: params.targetType,
          targetId: params.targetId || null,
          targetTitle: params.targetTitle || null,
          action: params.action,
          description: params.description || null,
          createdAt: new Date(),
        });
      } catch (innerErr) {
        console.warn("写入 activity_logs 失败:", innerErr);
      }
    } else {
      console.warn("写入 activity_logs 失败:", err);
    }
  }
}
