import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { works, chapters } from "@/db";

/**
 * 校验作品归属当前登录用户，防止跨租户 IDOR 越权
 */
export async function assertWorkOwnership(db: any, workId: number, userId: string) {
  if (!workId || isNaN(workId)) return null;
  return db
    .select()
    .from(works)
    .where(and(eq(works.id, workId), eq(works.userId, userId)))
    .get();
}

/**
 * 校验章节归属当前登录用户（可选同时校验归属指定 workId）
 */
export async function assertChapterOwnership(
  db: any,
  chapterId: number,
  userId: string,
  expectedWorkId?: number
) {
  if (!chapterId || isNaN(chapterId)) return null;
  const chapter = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .get();
  if (!chapter) return null;
  if (expectedWorkId && chapter.workId !== expectedWorkId) return null;
  const work = await assertWorkOwnership(db, chapter.workId, userId);
  if (!work) return null;
  return { chapter, work };
}

/**
 * 校验外部或站内 URL 协议安全（禁止 javascript: / data: / vbscript: 等危险协议）
 */
export function isSafeUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 安全解析请求 JSON Body，畸形 JSON 统一返回 400 而非 500
 */
export async function parseJsonBody<T = Record<string, any>>(
  req: NextRequest
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = await req.json();
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        response: NextResponse.json({ success: false, message: "无效的请求体格式" }, { status: 400 }),
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "请求体不是合法的 JSON" }, { status: 400 }),
    };
  }
}
