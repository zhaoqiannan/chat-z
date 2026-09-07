import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, characterRelations, characters } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

async function ensureRelationsTable(db: any) {
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS character_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL,
      source_char_id INTEGER NOT NULL,
      source_char_name TEXT NOT NULL,
      target_char_id INTEGER NOT NULL,
      target_char_name TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      relation_tag TEXT DEFAULT 'friendly',
      description TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );`);
  } catch (_) {}
}

/**
 * 获取作品的角色关系列表及关联角色数据 (GET)
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureRelationsTable(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const relationsList = await db
      .select()
      .from(characterRelations)
      .where(eq(characterRelations.workId, workId))
      .orderBy(desc(characterRelations.id))
      .all();

    const charList = await db
      .select({
        id: characters.id,
        name: characters.name,
        avatarUrl: characters.avatarUrl,
        roleType: characters.roleType,
        faction: characters.faction,
      })
      .from(characters)
      .where(eq(characters.workId, workId))
      .all();

    return NextResponse.json({
      success: true,
      result: {
        relations: relationsList || [],
        characters: charList || [],
      },
    });
  } catch (err: any) {
    console.error("GET relations error:", err);
    return NextResponse.json({ success: false, message: err?.message || "获取角色关系失败" }, { status: 500 });
  }
});

/**
 * 新建角色关系 (POST)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureRelationsTable(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      sourceCharId: rawSourceId,
      sourceCharName,
      targetCharId: rawTargetId,
      targetCharName,
      relationType,
      relationTag,
      description,
    } = body;

    const workId = Number(rawWorkId);
    const sourceCharId = Number(rawSourceId);
    const targetCharId = Number(rawTargetId);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的作品 ID" }, { status: 400 });
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

    let sName = String(sourceCharName || "").trim();
    let tName = String(targetCharName || "").trim();

    if (!sName || !tName) {
      const [sChar, tChar] = await Promise.all([
        db.select({ name: characters.name }).from(characters).where(eq(characters.id, sourceCharId)).get(),
        db.select({ name: characters.name }).from(characters).where(eq(characters.id, targetCharId)).get(),
      ]);
      if (sChar?.name) sName = sChar.name;
      if (tChar?.name) tName = tChar.name;
    }

    const record = {
      workId,
      sourceCharId,
      sourceCharName: sName || "未命名角色A",
      targetCharId,
      targetCharName: tName || "未命名角色B",
      relationType: String(relationType).trim(),
      relationTag: String(relationTag || "friendly").trim(),
      description: String(description || "").trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(characterRelations).values(record).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || record,
      message: "创建关系成功",
    });
  } catch (err: any) {
    console.error("POST relation error:", err);
    return NextResponse.json({ success: false, message: err?.message || "创建角色关系失败" }, { status: 500 });
  }
});

/**
 * 编辑角色关系 (PUT)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureRelationsTable(db);

    const body = await req.json();
    const { id: rawId, relationType, relationTag, description } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的关系 id" }, { status: 400 });
    }

    const updatedData: Record<string, any> = { updatedAt: new Date() };
    if (relationType !== undefined) updatedData.relationType = String(relationType).trim();
    if (relationTag !== undefined) updatedData.relationTag = String(relationTag).trim();
    if (description !== undefined) updatedData.description = String(description).trim();

    await db.update(characterRelations).set(updatedData).where(eq(characterRelations.id, id));

    return NextResponse.json({
      success: true,
      message: "更新关系成功",
    });
  } catch (err: any) {
    console.error("PUT relation error:", err);
    return NextResponse.json({ success: false, message: err?.message || "更新角色关系失败" }, { status: 500 });
  }
});

/**
 * 删除角色关系 (DELETE)
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureRelationsTable(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少关系 ID" }, { status: 400 });
    }

    await db.delete(characterRelations).where(eq(characterRelations.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除角色关系成功",
    });
  } catch (err: any) {
    console.error("DELETE relation error:", err);
    return NextResponse.json({ success: false, message: err?.message || "删除角色关系失败" }, { status: 500 });
  }
});
