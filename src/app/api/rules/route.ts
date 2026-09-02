// API: 世界规则与设定管理（自由文本类型、角色与阵营关联、极简规则描述）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, worldRules, works } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

async function ensureWorldRuleColumns(db: any) {
  try {
    await db.run(sql`ALTER TABLE world_rules ADD COLUMN characters TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE world_rules ADD COLUMN factions TEXT;`);
  } catch (_) {}
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureWorldRuleColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const ruleId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (ruleId) {
      const rule = await db.select().from(worldRules).where(and(eq(worldRules.id, ruleId), eq(worldRules.workId, workId))).get();
      return NextResponse.json({ success: true, result: rule });
    }

    const list = await db.select().from(worldRules).where(eq(worldRules.workId, workId)).orderBy(desc(worldRules.createdAt)).all();
    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取规则设定失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureWorldRuleColumns(db);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      category,
      characters,
      factions,
      description,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "规则设定名称不能为空" }, { status: 400 });
    }

    const finalDesc = description?.trim() || "暂无描述";

    const newRuleData = {
      workId,
      name: name.trim(),
      category: category?.trim() || null,
      mechanisms: finalDesc,
      description: finalDesc,
      extra: typeof extra === "object" ? { ...extra, characters, factions } : { characters, factions },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(worldRules).values(newRuleData).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted || newRuleData,
      message: "创建规则设定成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "创建规则设定失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureWorldRuleColumns(db);

    const body = await req.json();
    const {
      id: rawId,
      name,
      category,
      characters,
      factions,
      description,
      extra,
    } = body;

    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少规则ID" }, { status: 400 });
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
      updateData.mechanisms = description?.trim() || null;
    }
    if (extra !== undefined || characters !== undefined || factions !== undefined) {
      updateData.extra = { ...(extra || {}), ...(characters ? { characters } : {}), ...(factions ? { factions } : {}) };
    }

    const updated = await db.update(worldRules).set(updateData).where(eq(worldRules.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: updated,
      message: "规则设定更新成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "更新规则设定失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureWorldRuleColumns(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少规则ID" }, { status: 400 });
    }

    await db.delete(worldRules).where(eq(worldRules.id, id)).run();

    return NextResponse.json({ success: true, message: "规则删除成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除规则失败" }, { status: 500 });
  }
});
