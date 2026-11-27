// API: 剧情推演历史记录管理（多租户归属校验、历史查询与删除）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, plotDeductions } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const workId = Number(req.nextUrl.searchParams.get("workId"));
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少 workId" }, { status: 400 });
    }

    const list = await db
      .select()
      .from(plotDeductions)
      .where(and(eq(plotDeductions.workId, workId), eq(plotDeductions.userId, user.userId)))
      .orderBy(desc(plotDeductions.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list, message: "获取剧情推演记录成功" });
  } catch (error: any) {
    console.error("GET plot-deductions error:", error);
    return NextResponse.json({ success: false, message: "获取推演记录失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { workId: rawWorkId, startPoint, targetPoint, involvedCharacters, pacePreference, stepCount, generatedPaths, selectedPathIndex } = parsedBody.data;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }
    if (!(await assertWorkOwnership(db, workId, user.userId))) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const newRecord = {
      workId,
      userId: user.userId,
      startPoint: String(startPoint || "").trim(),
      targetPoint: String(targetPoint || "").trim(),
      involvedCharacters: involvedCharacters ? String(involvedCharacters).trim() : null,
      pacePreference: pacePreference || "standard",
      stepCount: Number(stepCount) || 3,
      generatedPaths: Array.isArray(generatedPaths) ? generatedPaths : [],
      selectedPathIndex: typeof selectedPathIndex === "number" ? selectedPathIndex : null,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(plotDeductions).values(newRecord).returning().get();
    return NextResponse.json({ success: true, result: inserted || newRecord, message: "保存剧情推演记录成功" });
  } catch (error: any) {
    console.error("POST plot-deductions error:", error);
    return NextResponse.json({ success: false, message: "保存推演记录失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    let id = Number(req.nextUrl.searchParams.get("id"));
    if (!id || isNaN(id)) {
      const parsedBody = await parseJsonBody<{ id?: number | string }>(req);
      if (parsedBody.ok) {
        id = Number(parsedBody.data?.id);
      }
    }
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少待删除记录 ID" }, { status: 400 });
    }

    await db.delete(plotDeductions).where(and(eq(plotDeductions.id, id), eq(plotDeductions.userId, user.userId))).run();
    return NextResponse.json({ success: true, message: "删除推演记录成功" });
  } catch (error: any) {
    console.error("DELETE plot-deductions error:", error);
    return NextResponse.json({ success: false, message: "删除推演记录失败" }, { status: 500 });
  }
});
