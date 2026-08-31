import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, materials } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * 素材资料列表查询 (GET)
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const list = await db
      .select()
      .from(materials)
      .where(eq(materials.workId, workId))
      .orderBy(desc(materials.id))
      .all();

    return NextResponse.json({
      success: true,
      result: list,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "获取素材列表失败" }, { status: 500 });
  }
});

/**
 * 新建素材资料 (POST)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { workId: rawWorkId, title, category, content, fileUrl, fileType, fileName, tags } = body;
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
      content: content || "",
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileName: fileName || null,
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

/**
 * 编辑素材 (PUT)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, title, category, content, fileUrl, fileType, fileName, tags } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的素材 id" }, { status: 400 });
    }

    const updatedData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updatedData.title = title.trim();
    if (category !== undefined) updatedData.category = category;
    if (content !== undefined) updatedData.content = content;
    if (fileUrl !== undefined) updatedData.fileUrl = fileUrl;
    if (fileType !== undefined) updatedData.fileType = fileType;
    if (fileName !== undefined) updatedData.fileName = fileName;
    if (tags !== undefined) updatedData.tags = tags;

    await db.update(materials).set(updatedData).where(eq(materials.id, id));

    return NextResponse.json({
      success: true,
      message: "更新素材成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "更新素材失败" }, { status: 500 });
  }
});

/**
 * 删除素材 (DELETE)
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

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
