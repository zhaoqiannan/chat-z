// API: 项目总纲树状数据读写（独立表 work_master_outlines，零侵入现有表结构）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works } from "@/db";
import { eq, and, sql } from "drizzle-orm";

async function ensureMasterOutlineTable(db: any) {
  await db.run(sql`CREATE TABLE IF NOT EXISTS work_master_outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id INTEGER NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    tree_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
}

function buildDefaultTree(workTitle: string, description?: string | null) {
  return {
    id: "root",
    title: workTitle || "项目总纲",
    tag: "总纲",
    note: description || "",
    status: "in_progress",
    children: [
      {
        id: "node-1",
        title: "第一阶段：开篇与立意",
        tag: "主线",
        note: "交代主角初始困境、核心金手指/驱动力与第一个冲突钩子",
        chapterRange: "1-20",
        status: "planned",
        children: [],
      },
      {
        id: "node-2",
        title: "第二阶段：冲突升级与转折",
        tag: "主线",
        note: "世界观展开、关键配角与反派登场、核心矛盾激化",
        chapterRange: "21-60",
        status: "planned",
        children: [],
      },
      {
        id: "node-3",
        title: "第三阶段：高潮与终局",
        tag: "高潮",
        note: "回收核心伏笔、终极对决与主题升华",
        chapterRange: "61-100",
        status: "planned",
        children: [],
      },
    ],
  };
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    await ensureMasterOutlineTable(db);

    const [row, writtenChaptersRes]: any[] = await Promise.all([
      env.DB.prepare(
        "SELECT tree_json, updated_at FROM work_master_outlines WHERE work_id = ? AND user_id = ? LIMIT 1"
      )
        .bind(workId, user.userId)
        .first(),
      env.DB.prepare(
        "SELECT chapter_number FROM chapters WHERE work_id = ? AND is_volume = 0 AND COALESCE(word_count, 0) > 0 ORDER BY chapter_number ASC"
      )
        .bind(workId)
        .all(),
    ]);

    const writtenChapterNumbers: number[] = Array.from(
      new Set(
        (writtenChaptersRes?.results || [])
          .map((r: any) => Number(r.chapter_number))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      )
    );

    if (row && row.tree_json) {
      try {
        const tree = JSON.parse(row.tree_json);
        return NextResponse.json({
          success: true,
          result: { tree, updatedAt: row.updated_at, isDefault: false, writtenChapterNumbers },
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      result: {
        tree: buildDefaultTree(work.title, work.description),
        updatedAt: null,
        isDefault: true,
        writtenChapterNumbers,
      },
    });
  } catch (error: any) {
    console.error("[API /api/outlines/master GET] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取项目总纲失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const tree = body.tree;

    if (!workId || isNaN(workId) || !tree || typeof tree !== "object") {
      return NextResponse.json({ success: false, message: "参数不完整" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    await ensureMasterOutlineTable(db);

    const now = Date.now();
    const treeJson = JSON.stringify(tree);

    await env.DB.prepare(
      `INSERT INTO work_master_outlines (work_id, user_id, tree_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(work_id) DO UPDATE SET tree_json = excluded.tree_json, updated_at = excluded.updated_at`
    )
      .bind(workId, user.userId, treeJson, now)
      .run();

    return NextResponse.json({
      success: true,
      result: { updatedAt: now },
      message: "项目总纲已保存",
    });
  } catch (error: any) {
    console.error("[API /api/outlines/master PUT] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "保存项目总纲失败" }, { status: 500 });
  }
});
