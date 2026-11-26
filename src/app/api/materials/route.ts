// API: 素材资料库管理（多租户归属校验、URL 安全校验、级联清理上传文件）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, materials, uploadedFiles } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { assertWorkOwnership, isSafeUrl, parseJsonBody } from "@/utils/ownership";

function extractUploadedFileId(fileUrl?: string | null): number | null {
  if (!fileUrl) return null;
  const m = String(fileUrl).trim().match(/^\/api\/files\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const keyword = searchParams.get("keyword")?.trim();
    const fileType = searchParams.get("fileType");
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }
    if (!(await assertWorkOwnership(db, workId, user.userId))) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const allList = await db
      .select()
      .from(materials)
      .where(eq(materials.workId, workId))
      .orderBy(desc(materials.isPinned), desc(materials.updatedAt))
      .all();

    let filtered = allList;
    if (fileType && fileType !== "all") filtered = filtered.filter((m) => m.fileType === fileType);
    if (status && status !== "all") filtered = filtered.filter((m) => m.status === status);
    if (tag && tag !== "all") filtered = filtered.filter((m) => m.tags && m.tags.includes(tag));
    if (keyword) {
      const lower = keyword.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(lower)) ||
          (m.fileName && m.fileName.toLowerCase().includes(lower)) ||
          (m.tags && m.tags.toLowerCase().includes(lower)) ||
          (m.aiSummary && m.aiSummary.toLowerCase().includes(lower)) ||
          (m.content && m.content.toLowerCase().includes(lower)) ||
          (m.extractedLore && m.extractedLore.toLowerCase().includes(lower))
      );
    }

    return NextResponse.json({ success: true, result: filtered });
  } catch (err: any) {
    console.error("GET materials error:", err);
    return NextResponse.json({ success: false, message: "获取素材列表失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const {
      workId: rawWorkId, title, category, status, content, fileUrl, fileType, fileName,
      fileSize, aiSummary, aiPrompt, sourceUrl, extractedLore, isPinned, includeInAiContext, linkedTarget, tags,
    } = parsedBody.data;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "无效的 workId" }, { status: 400 });
    }
    if (!(await assertWorkOwnership(db, workId, user.userId))) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      return NextResponse.json({ success: false, message: "素材标题不能为空" }, { status: 400 });
    }
    if (fileUrl && !isSafeUrl(fileUrl)) {
      return NextResponse.json({ success: false, message: "非法的文件链接协议" }, { status: 400 });
    }
    if (sourceUrl && !isSafeUrl(sourceUrl)) {
      return NextResponse.json({ success: false, message: "非法的来源链接协议" }, { status: 400 });
    }

    const record = {
      workId,
      title: cleanTitle,
      category: category || "knowledge",
      status: status || "processed",
      content: content || "",
      fileUrl: fileUrl ? String(fileUrl).trim() : null,
      fileType: fileType || "document",
      fileName: fileName || cleanTitle,
      fileSize: fileSize || null,
      aiSummary: aiSummary || null,
      aiPrompt: aiPrompt || null,
      sourceUrl: sourceUrl ? String(sourceUrl).trim() : null,
      extractedLore: extractedLore || null,
      isPinned: isPinned !== undefined ? (isPinned ? 1 : 0) : 0,
      includeInAiContext: includeInAiContext !== undefined ? (includeInAiContext ? 1 : 0) : 1,
      linkedTarget: linkedTarget || null,
      tags: tags || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(materials).values(record).returning().get();
    return NextResponse.json({ success: true, result: inserted || record, message: "创建素材成功" });
  } catch (err: any) {
    console.error("POST materials error:", err);
    return NextResponse.json({ success: false, message: "创建素材失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const {
      id: rawId, title, category, status, content, fileUrl, fileType, fileName,
      fileSize, aiSummary, aiPrompt, sourceUrl, extractedLore, isPinned, includeInAiContext, linkedTarget, tags,
    } = parsedBody.data;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的素材 id" }, { status: 400 });
    }

    const existingMat = await db.select().from(materials).where(eq(materials.id, id)).get();
    if (!existingMat) {
      return NextResponse.json({ success: false, message: "素材不存在" }, { status: 404 });
    }
    if (!(await assertWorkOwnership(db, existingMat.workId, user.userId))) {
      return NextResponse.json({ success: false, message: "无权操作该素材" }, { status: 403 });
    }

    if (fileUrl && !isSafeUrl(fileUrl)) {
      return NextResponse.json({ success: false, message: "非法的文件链接协议" }, { status: 400 });
    }
    if (sourceUrl && !isSafeUrl(sourceUrl)) {
      return NextResponse.json({ success: false, message: "非法的来源链接协议" }, { status: 400 });
    }

    const updatedData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updatedData.title = String(title).trim();
    if (category !== undefined) updatedData.category = category;
    if (status !== undefined) updatedData.status = status;
    if (content !== undefined) updatedData.content = content;
    if (fileUrl !== undefined) updatedData.fileUrl = fileUrl ? String(fileUrl).trim() : null;
    if (fileType !== undefined) updatedData.fileType = fileType;
    if (fileName !== undefined) updatedData.fileName = fileName;
    if (fileSize !== undefined) updatedData.fileSize = fileSize;
    if (aiSummary !== undefined) updatedData.aiSummary = aiSummary;
    if (aiPrompt !== undefined) updatedData.aiPrompt = aiPrompt;
    if (sourceUrl !== undefined) updatedData.sourceUrl = sourceUrl ? String(sourceUrl).trim() : null;
    if (extractedLore !== undefined) updatedData.extractedLore = extractedLore;
    if (isPinned !== undefined) updatedData.isPinned = isPinned ? 1 : 0;
    if (includeInAiContext !== undefined) updatedData.includeInAiContext = includeInAiContext ? 1 : 0;
    if (linkedTarget !== undefined) updatedData.linkedTarget = linkedTarget;
    if (tags !== undefined) updatedData.tags = tags;

    const res = await db.update(materials).set(updatedData).where(eq(materials.id, id)).returning().get();
    return NextResponse.json({ success: true, result: res, message: "更新素材成功" });
  } catch (err: any) {
    console.error("PUT materials error:", err);
    return NextResponse.json({ success: false, message: "更新素材失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));
    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    const existingMat = await db.select().from(materials).where(eq(materials.id, id)).get();
    if (!existingMat) {
      return NextResponse.json({ success: false, message: "素材不存在" }, { status: 404 });
    }
    if (!(await assertWorkOwnership(db, existingMat.workId, user.userId))) {
      return NextResponse.json({ success: false, message: "无权操作该素材" }, { status: 403 });
    }

    await db.delete(materials).where(eq(materials.id, id)).run();

    const uploadedFileId = extractUploadedFileId(existingMat.fileUrl);
    if (uploadedFileId) {
      try {
        await db.delete(uploadedFiles).where(and(eq(uploadedFiles.id, uploadedFileId), eq(uploadedFiles.userId, user.userId))).run();
      } catch {}
    }

    return NextResponse.json({ success: true, message: "删除素材成功" });
  } catch (err: any) {
    console.error("DELETE materials error:", err);
    return NextResponse.json({ success: false, message: "删除素材失败" }, { status: 500 });
  }
});
