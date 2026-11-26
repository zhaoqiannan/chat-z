import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, characterRelations, characters } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const [relationsList, charList] = await Promise.all([
      db.select().from(characterRelations).where(eq(characterRelations.workId, workId)).orderBy(desc(characterRelations.id)).all(),
      db
        .select({
          id: characters.id,
          name: characters.name,
          avatarUrl: characters.avatarUrl,
          roleType: characters.roleType,
          faction: characters.faction,
        })
        .from(characters)
        .where(eq(characters.workId, workId))
        .all(),
    ]);

    return NextResponse.json({
      success: true,
      result: { relations: relationsList || [], characters: charList || [] },
    });
  } catch (err: any) {
    console.error("GET relations error:", err);
    return NextResponse.json({ success: false, message: "获取角色关系失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { workId: rawWorkId, sourceCharId: rawSourceId, sourceCharName, targetCharId: rawTargetId, targetCharName, relationType, relationTag, description } = parsedBody.data;

    const workId = Number(rawWorkId);
    const sourceCharId = Number(rawSourceId);
    const targetCharId = Number(rawTargetId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的作品 ID" }, { status: 400 });
    }
    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }
    if (!sourceCharId || !targetCharId) {
      return NextResponse.json({ success: false, message: "请选择关联的两位角色" }, { status: 400 });
    }
    if (sourceCharId === targetCharId) {
      return NextResponse.json({ success: false, message: "角色不能与自身建立关联关系" }, { status: 400 });
    }
    if (!relationType || !String(relationType).trim()) {
      return NextResponse.json({ success: false, message: "关系类型不能为空" }, { status: 400 });
    }

    // 校验两位角色均归属当前作品，防止跨作品绑定/名称泄露
    const [sChar, tChar] = await Promise.all([
      db.select({ id: characters.id, name: characters.name }).from(characters).where(and(eq(characters.id, sourceCharId), eq(characters.workId, workId))).get(),
      db.select({ id: characters.id, name: characters.name }).from(characters).where(and(eq(characters.id, targetCharId), eq(characters.workId, workId))).get(),
    ]);
    if (!sChar || !tChar) {
      return NextResponse.json({ success: false, message: "所选角色不属于当前作品" }, { status: 400 });
    }

    const record = {
      workId,
      sourceCharId,
      sourceCharName: String(sourceCharName || sChar.name || "未命名角色A").trim(),
      targetCharId,
      targetCharName: String(targetCharName || tChar.name || "未命名角色B").trim(),
      relationType: String(relationType).trim(),
      relationTag: String(relationTag || "friendly").trim(),
      description: String(description || "").trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(characterRelations).values(record).returning().get();
    return NextResponse.json({ success: true, result: inserted || record, message: "创建关系成功" });
  } catch (err: any) {
    console.error("POST relation error:", err);
    return NextResponse.json({ success: false, message: "创建角色关系失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { id: rawId, relationType, relationTag, description } = parsedBody.data;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的关系 id" }, { status: 400 });
    }

    const existing = await db.select().from(characterRelations).where(eq(characterRelations.id, id)).get();
    if (!existing) {
      return NextResponse.json({ success: false, message: "角色关系不存在" }, { status: 404 });
    }
    const work = await assertWorkOwnership(db, existing.workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "无权操作该角色关系" }, { status: 403 });
    }

    const updatedData: Record<string, any> = { updatedAt: new Date() };
    if (relationType !== undefined) updatedData.relationType = String(relationType).trim();
    if (relationTag !== undefined) updatedData.relationTag = String(relationTag).trim();
    if (description !== undefined) updatedData.description = String(description).trim();

    await db.update(characterRelations).set(updatedData).where(eq(characterRelations.id, id));
    return NextResponse.json({ success: true, message: "更新关系成功" });
  } catch (err: any) {
    console.error("PUT relation error:", err);
    return NextResponse.json({ success: false, message: "更新角色关系失败" }, { status: 500 });
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
      return NextResponse.json({ success: false, message: "缺少关系 ID" }, { status: 400 });
    }

    const existing = await db.select().from(characterRelations).where(eq(characterRelations.id, id)).get();
    if (!existing) {
      return NextResponse.json({ success: false, message: "角色关系不存在" }, { status: 404 });
    }
    const work = await assertWorkOwnership(db, existing.workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "无权删除该角色关系" }, { status: 403 });
    }

    await db.delete(characterRelations).where(eq(characterRelations.id, id)).run();
    return NextResponse.json({ success: true, message: "删除角色关系成功" });
  } catch (err: any) {
    console.error("DELETE relation error:", err);
    return NextResponse.json({ success: false, message: "删除角色关系失败" }, { status: 500 });
  }
});
