// API: 素材资料库管理（自动迁移补齐字段、表格数据、多维筛选、AI智能摘要与上下文注入）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, materials } from "@/db";
import { eq, and, desc } from "drizzle-orm";

const ensureMaterialsColumns = async (db: any) => {
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN status TEXT DEFAULT 'processed'`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN file_size TEXT`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN ai_summary TEXT`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN source_url TEXT`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN extracted_lore TEXT`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN include_in_ai_context INTEGER DEFAULT 1`);
  } catch (_) {}
  try {
    await db.run(`ALTER TABLE materials ADD COLUMN linked_target TEXT`);
  } catch (_) {}
};

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureMaterialsColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const keyword = searchParams.get("keyword")?.trim();
    const fileType = searchParams.get("fileType");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const allList = await db.select().from(materials).where(eq(materials.workId, workId)).orderBy(desc(materials.updatedAt)).all();

    let filtered = allList;

    if (fileType && fileType !== "all") {
      filtered = filtered.filter((m) => m.fileType === fileType);
    }
    if (status && status !== "all") {
      filtered = filtered.filter((m) => m.status === status);
    }
    if (tag && tag !== "all") {
      filtered = filtered.filter((m) => m.tags && m.tags.includes(tag));
    }
    if (keyword) {
      const lower = keyword.toLowerCase();
      filtered = filtered.filter((m) => m.title.toLowerCase().includes(lower) || (m.fileName && m.fileName.toLowerCase().includes(lower)) || (m.tags && m.tags.toLowerCase().includes(lower)) || (m.aiSummary && m.aiSummary.toLowerCase().includes(lower)));
    }

    return NextResponse.json({
      success: true,
      result: filtered,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "获取素材列表失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureMaterialsColumns(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      title,
      category,
      status,
      content,
      fileUrl,
      fileType,
      fileName,
      fileSize,
      aiSummary,
      sourceUrl,
      extractedLore,
      includeInAiContext,
      linkedTarget,
      tags,
    } = body;
    const workId = Number(rawWorkId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: "素材标题不能为空" }, { status: 400 });
    }

    const record = {
      workId,
      title: title.trim(),
      category: category || "knowledge",
      status: status || "processed",
      content: content || "",
      fileUrl: fileUrl || null,
      fileType: fileType || "document",
      fileName: fileName || title.trim(),
      fileSize: fileSize || null,
      aiSummary: aiSummary || null,
      sourceUrl: sourceUrl || null,
      extractedLore: extractedLore || null,
      includeInAiContext: includeInAiContext !== undefined ? (includeInAiContext ? 1 : 0) : 1,
      linkedTarget: linkedTarget || null,
      tags: tags || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(materials).values(record).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || record,
      message: "创建素材成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "创建素材失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureMaterialsColumns(db);

    const body = await req.json();
    const {
      id: rawId,
      title,
      category,
      status,
      content,
      fileUrl,
      fileType,
      fileName,
      fileSize,
      aiSummary,
      sourceUrl,
      extractedLore,
      includeInAiContext,
      linkedTarget,
      tags,
    } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的素材 id" }, { status: 400 });
    }

    const updatedData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updatedData.title = title.trim();
    if (category !== undefined) updatedData.category = category;
    if (status !== undefined) updatedData.status = status;
    if (content !== undefined) updatedData.content = content;
    if (fileUrl !== undefined) updatedData.fileUrl = fileUrl;
    if (fileType !== undefined) updatedData.fileType = fileType;
    if (fileName !== undefined) updatedData.fileName = fileName;
    if (fileSize !== undefined) updatedData.fileSize = fileSize;
    if (aiSummary !== undefined) updatedData.aiSummary = aiSummary;
    if (sourceUrl !== undefined) updatedData.sourceUrl = sourceUrl;
    if (extractedLore !== undefined) updatedData.extractedLore = extractedLore;
    if (includeInAiContext !== undefined) updatedData.includeInAiContext = includeInAiContext ? 1 : 0;
    if (linkedTarget !== undefined) updatedData.linkedTarget = linkedTarget;
    if (tags !== undefined) updatedData.tags = tags;

    const res = await db.update(materials).set(updatedData).where(eq(materials.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: res,
      message: "更新素材成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "更新素材失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureMaterialsColumns(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(materials).where(eq(materials.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除素材成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "删除素材失败" }, { status: 500 });
  }
});
