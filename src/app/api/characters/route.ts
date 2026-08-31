import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, characters, works } from "@/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET: 获取指定作品的角色列表或单条角色
 */
export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const charId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "缺少有效作品ID" },
        { status: 400 }
      );
    }

    // 校验作品归属
    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限访问" },
        { status: 403 }
      );
    }

    if (charId) {
      const char = await db
        .select()
        .from(characters)
        .where(and(eq(characters.id, charId), eq(characters.workId, workId)))
        .get();
      return NextResponse.json({ success: true, result: char });
    }

    const list = await db
      .select()
      .from(characters)
      .where(eq(characters.workId, workId))
      .orderBy(desc(characters.createdAt))
      .all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    console.error("GET characters error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "获取角色失败" },
      { status: 500 }
    );
  }
});

/**
 * POST: 创建新角色
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      name,
      alias,
      gender,
      age,
      identity,
      faction,
      roleType,
      appearance,
      avatarUrl,
      personality,
      description,
      experiences,
      relationships,
      organizations,
      abilities,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "角色姓名不能为空" }, { status: 400 });
    }

    const newCharData = {
      workId,
      name: name.trim(),
      alias: alias?.trim() || null,
      gender: gender?.trim() || "未知",
      age: age?.trim() || null,
      identity: identity?.trim() || null,
      faction: faction?.trim() || null,
      roleType: roleType || "major",
      appearance: appearance?.trim() || null,
      avatarUrl: avatarUrl || null,
      personality: personality?.trim() || null,
      description: description?.trim() || null,
      experiences: experiences?.trim() || null,
      relationships: Array.isArray(relationships) ? relationships : [],
      organizations: organizations?.trim() || null,
      abilities: abilities?.trim() || null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(characters).values(newCharData).returning().get();

    let resultChar: any = inserted;
    if (!resultChar || !resultChar.id) {
      resultChar = await db
        .select()
        .from(characters)
        .where(eq(characters.workId, workId))
        .orderBy(desc(characters.id))
        .limit(1)
        .get();
    }

    return NextResponse.json({
      success: true,
      result: resultChar || newCharData,
      message: "创建角色成功",
    });
  } catch (error: any) {
    console.error("POST characters error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "创建角色失败" },
      { status: 500 }
    );
  }
});

/**
 * PUT: 编辑角色
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, ...updateData } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少角色ID" }, { status: 400 });
    }

    const payload = {
      ...updateData,
      updatedAt: new Date(),
    };

    await db.update(characters).set(payload).where(eq(characters.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "编辑角色成功",
    });
  } catch (error: any) {
    console.error("PUT characters error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "编辑角色失败" },
      { status: 500 }
    );
  }
});

/**
 * DELETE: 删除角色
 */
export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少角色ID" }, { status: 400 });
    }

    await db.delete(characters).where(eq(characters.id, id)).run();

    return NextResponse.json({
      success: true,
      message: "删除角色成功",
    });
  } catch (error: any) {
    console.error("DELETE characters error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "删除角色失败" },
      { status: 500 }
    );
  }
});
