// API: 灵感随笔与小说笔记管理（自动迁移补齐字段、多维分类、置顶、归档与实体关联）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, notes } from "@/db";
import { eq, and, desc } from "drizzle-orm";

const ensureNotesColumns = async (db: any) => {
  try {
    await db.run(`ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE notes ADD COLUMN pinned_at INTEGER`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE notes ADD COLUMN is_archived INTEGER DEFAULT 0`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE notes ADD COLUMN linked_chapter_ids TEXT`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE notes ADD COLUMN linked_entity_ids TEXT`);
  } catch (_) {}
};

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureNotesColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const category = searchParams.get("category") || "all";
    const keyword = searchParams.get("keyword")?.trim();

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const allNotes = await db.select().from(notes).where(eq(notes.workId, workId)).orderBy(desc(notes.isPinned), desc(notes.pinnedAt), desc(notes.updatedAt)).all();

    const counts = {
      all: allNotes.filter((n) => !n.isArchived).length,
      idea: allNotes.filter((n) => !n.isArchived && n.category === "idea").length,
      plot: allNotes.filter((n) => !n.isArchived && n.category === "plot").length,
      character: allNotes.filter((n) => !n.isArchived && n.category === "character").length,
      world: allNotes.filter((n) => !n.isArchived && n.category === "world").length,
      research: allNotes.filter((n) => !n.isArchived && n.category === "research").length,
      archived: allNotes.filter((n) => Boolean(n.isArchived)).length,
    };

    let filtered = allNotes;

    if (category === "archived") {
      filtered = filtered.filter((n) => Boolean(n.isArchived));
    } else {
      filtered = filtered.filter((n) => !n.isArchived);
      if (category !== "all") {
        filtered = filtered.filter((n) => n.category === category);
      }
    }

    if (keyword) {
      const lower = keyword.toLowerCase();
      filtered = filtered.filter((n) => n.title.toLowerCase().includes(lower) || n.content.toLowerCase().includes(lower));
    }

    return NextResponse.json({
      success: true,
      result: {
        list: filtered,
        counts,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "获取笔记列表失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureNotesColumns(db);

    const body = await req.json();
    const { workId: rawWorkId, title, content, category, isPinned, linkedChapterIds, linkedEntityIds } = body;
    const workId = Number(rawWorkId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    const record = {
      workId,
      title: (title || "未命名笔记").trim(),
      content: content || "",
      category: category || "idea",
      isPinned: isPinned ? 1 : 0,
      pinnedAt: isPinned ? new Date() : null,
      isArchived: 0,
      linkedChapterIds: linkedChapterIds || null,
      linkedEntityIds: linkedEntityIds || null,
      isTodo: 0,
      isCompleted: 0,
      priority: "medium",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(notes).values(record).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || record,
      message: "创建笔记成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "创建笔记失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureNotesColumns(db);

    const body = await req.json();
    const { id: rawId, title, content, category, isPinned, isArchived, linkedChapterIds, linkedEntityIds } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的笔记 id" }, { status: 400 });
    }

    const updatedData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updatedData.title = title.trim();
    if (content !== undefined) updatedData.content = content;
    if (category !== undefined) updatedData.category = category;
    if (isPinned !== undefined) {
      updatedData.isPinned = isPinned ? 1 : 0;
      updatedData.pinnedAt = isPinned ? new Date() : null;
    }
    if (isArchived !== undefined) updatedData.isArchived = isArchived ? 1 : 0;
    if (linkedChapterIds !== undefined) updatedData.linkedChapterIds = linkedChapterIds;
    if (linkedEntityIds !== undefined) updatedData.linkedEntityIds = linkedEntityIds;

    const res = await db.update(notes).set(updatedData).where(eq(notes.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: res,
      message: "更新笔记成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "更新笔记失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureNotesColumns(db);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少待删除的笔记 id" }, { status: 400 });
    }

    await db.delete(notes).where(eq(notes.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除笔记成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "删除笔记失败" }, { status: 500 });
  }
});
