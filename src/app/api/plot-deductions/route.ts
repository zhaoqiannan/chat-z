// API: 剧情推演历史记录管理（推演方案持久化、历史查询、采纳标记与删除，含表结构热自愈）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, plotDeductions, works } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

async function ensurePlotDeductionsTable(db: any) {
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS plot_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      start_point TEXT NOT NULL,
      target_point TEXT NOT NULL,
      involved_characters TEXT,
      pace_preference TEXT DEFAULT 'standard',
      step_count INTEGER DEFAULT 3,
      generated_paths TEXT,
      selected_path_index INTEGER,
      status TEXT DEFAULT 'completed',
      created_at INTEGER,
      updated_at INTEGER
    );`);
  } catch (_) {}
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensurePlotDeductionsTable(db);

    const rawWorkId = req.nextUrl.searchParams.get("workId");
    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少 workId" }, { status: 400 });
    }

    const list = await db.select().from(plotDeductions).where(and(eq(plotDeductions.workId, workId), eq(plotDeductions.userId, user.userId))).orderBy(desc(plotDeductions.createdAt)).all();

    return NextResponse.json({
      success: true,
      result: list,
      message: "获取剧情推演记录成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取推演记录失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensurePlotDeductionsTable(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      startPoint,
      targetPoint,
      involvedCharacters,
      pacePreference,
      stepCount,
      generatedPaths,
      selectedPathIndex,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const newRecord = {
      workId,
      userId: user.userId,
      startPoint: (startPoint || "").trim(),
      targetPoint: (targetPoint || "").trim(),
      involvedCharacters: involvedCharacters?.trim() || null,
      pacePreference: pacePreference || "standard",
      stepCount: stepCount || 3,
      generatedPaths: Array.isArray(generatedPaths) ? generatedPaths : [],
      selectedPathIndex: typeof selectedPathIndex === "number" ? selectedPathIndex : null,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(plotDeductions).values(newRecord).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || newRecord,
      message: "保存剧情推演记录成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "保存推演记录失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensurePlotDeductionsTable(db);

    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少待删除记录 ID" }, { status: 400 });
    }

    await db.delete(plotDeductions).where(and(eq(plotDeductions.id, id), eq(plotDeductions.userId, user.userId))).run();

    return NextResponse.json({ success: true, message: "删除推演记录成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除推演记录失败" }, { status: 500 });
  }
});
