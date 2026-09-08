import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, activityLogs, chapters, works } from "@/db";
import { desc, eq, and, gte } from "drizzle-orm";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

function formatRelativeTime(date: Date | number | string | null | undefined): string {
  if (!date) return "刚刚";
  const now = dayjs();
  const d = dayjs(date);
  const diffSec = now.diff(d, "second");
  if (diffSec < 60) return "刚刚";
  const diffMin = now.diff(d, "minute");
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHours = now.diff(d, "hour");
  if (diffHours < 24) return `${diffHours}小时前`;
  return "昨天";
}

/**
 * 获取用户最近 24 小时的操作动态 (作品与章节的 add / put / del)
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    let list: any[] = [];

    // 1. 优先从 activity_logs 日志表中查询最近 24 小时的动态
    try {
      const logs = await db
        .select()
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.userId, user.userId),
            gte(activityLogs.createdAt, twentyFourHoursAgo)
          )
        )
        .orderBy(desc(activityLogs.createdAt))
        .all();

      if (logs && logs.length > 0) {
        list = logs.map((item) => {
          let actionLabel = "操作了";
          if (item.action === "create") actionLabel = "新建了";
          else if (item.action === "update") actionLabel = "编辑了";
          else if (item.action === "delete") actionLabel = "删除了";

          const targetTypeName = item.targetType === "work" ? "作品" : "章节";
          const title = `${actionLabel}${targetTypeName}「${item.targetTitle || item.workTitle || "未知"}」`;

          return {
            id: item.id,
            title,
            time: formatRelativeTime(item.createdAt),
            description: item.description || "无详细描述",
            createdAt: item.createdAt,
          };
        });
      }
    } catch (logErr) {
      console.warn("查询 activity_logs 遇到异常，尝试 fallback:", logErr);
    }

    // 2. 如果 activity_logs 表中没有记录（例如刚升级部署阶段），则从 works 和 chapters 的时间字段中智能聚合 24 小时内的变动
    if (list.length === 0) {
      const recentWorks = await db
        .select()
        .from(works)
        .where(
          and(
            eq(works.userId, user.userId),
            gte(works.updatedAt, twentyFourHoursAgo)
          )
        )
        .orderBy(desc(works.updatedAt))
        .limit(10);

      const recentChs = await db
        .select({
          id: chapters.id,
          title: chapters.title,
          isVolume: chapters.isVolume,
          chapterNumber: chapters.chapterNumber,
          wordCount: chapters.wordCount,
          updatedAt: chapters.updatedAt,
          createdAt: chapters.createdAt,
          workId: chapters.workId,
        })
        .from(chapters)
        .where(
          and(
            eq(chapters.userId, user.userId),
            gte(chapters.updatedAt, twentyFourHoursAgo)
          )
        )
        .orderBy(desc(chapters.updatedAt))
        .limit(15);

      // 获取相关的作品名 map
      const workMap = new Map<number, string>();
      for (const w of recentWorks) {
        workMap.set(w.id, w.title);
      }

      for (const ch of recentChs) {
        if (!workMap.has(ch.workId)) {
          const w = await db
            .select({ title: works.title })
            .from(works)
            .where(eq(works.id, ch.workId))
            .get();
          if (w) workMap.set(ch.workId, w.title);
        }

        const isCreate =
          ch.createdAt &&
          ch.updatedAt &&
          Math.abs(new Date(ch.updatedAt).getTime() - new Date(ch.createdAt).getTime()) < 3000;

        const wTitle = workMap.get(ch.workId) || "作品";
        const chName = ch.isVolume
          ? `分卷「${ch.title}」`
          : `第 ${ch.chapterNumber} 章「${ch.title}」`;

        list.push({
          id: `ch-${ch.id}`,
          title: isCreate ? `新建了「${wTitle}」${chName}` : `编辑了「${wTitle}」${chName}`,
          time: formatRelativeTime(ch.updatedAt),
          description: ch.isVolume
            ? "调整了分卷结构与归属"
            : `当前章节约 ${ch.wordCount || 0} 字，持续优化剧情。`,
          createdAt: ch.updatedAt,
        });
      }

      for (const w of recentWorks) {
        const isCreate =
          w.createdAt &&
          w.updatedAt &&
          Math.abs(new Date(w.updatedAt).getTime() - new Date(w.createdAt).getTime()) < 3000;

        list.push({
          id: `work-${w.id}`,
          title: isCreate ? `创建了新作品「${w.title}」` : `更新了作品「${w.title}」设定`,
          time: formatRelativeTime(w.updatedAt),
          description: `分类：${w.tag || "通用"} · 包含 ${w.chapterCount || 0} 章`,
          createdAt: w.updatedAt,
        });
      }

      // 按时间倒序排序
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return NextResponse.json({
      success: true,
      result: list,
      message: "获取最近24小时动态成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "获取近期动态失败",
      },
      { status: 500 }
    );
  }
});
