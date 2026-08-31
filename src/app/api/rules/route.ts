import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, worldRules, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET: 获取指定作品的规则体系列表
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const ruleId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (ruleId) {
      const rule = await db
        .select()
        .from(worldRules)
        .where(and(eq(worldRules.id, ruleId), eq(worldRules.workId, workId)))
        .get();
      return NextResponse.json({ success: true, result: rule });
    }

    const list = await db
      .select()
      .from(worldRules)
      .where(eq(worldRules.workId, workId))
      .orderBy(desc(worldRules.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("GET rules error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "获取规则体系失败" },
      { status: 500 }
    );
  }
});

/**
 * POST: 创建新规则体系
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      category,
      levelTree,
      mechanisms,
      taboos,
      description,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "法则体系名称不能为空" }, { status: 400 });
    }

    const newRuleData = {
      workId,
      name: name.trim(),
      category: category || "power_system",
      levelTree: Array.isArray(levelTree) ? levelTree : [],
      mechanisms: mechanisms?.trim() || null,
      taboos: taboos?.trim() || null,
      description: description?.trim() || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(worldRules).values(newRuleData).returning().get();

    let resultRule: any = inserted;
    if (!resultRule || !resultRule.id) {
      resultRule = await db
        .select()
        .from(worldRules)
        .where(eq(worldRules.workId, workId))
        .orderBy(desc(worldRules.id))
        .limit(1)
        .get();
    }

    return NextResponse.json({
      success: true,
      result: resultRule || newRuleData,
      message: "创建法则体系成功",
    });
  } catch (error: any) {
    console.error("POST rules error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "创建法则体系失败" },
      { status: 500 }
    );
  }
});

/**
 * PUT: 编辑规则体系
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, ...updateData } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少法则体系ID" }, { status: 400 });
    }

    const payload = {
      ...updateData,
      updatedAt: new Date(),
    };

    await db.update(worldRules).set(payload).where(eq(worldRules.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "编辑法则体系成功",
    });
  } catch (error: any) {
    console.error("PUT rules error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "编辑法则体系失败" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: 删除规则体系
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少法则体系ID" }, { status: 400 });
    }

    await db.delete(worldRules).where(eq(worldRules.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除法则体系成功",
    });
  } catch (error: any) {
    console.error("DELETE rules error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "删除法则体系失败" },
      { status: 500 }
    );
  }
});
