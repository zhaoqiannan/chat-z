// API: 角色档案库管理（自动迁移补齐字段、增删改查、置顶与个人介绍/背景/灵感片段维护）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, characters, works } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";

const ensureCharacterColumns = async (db: any) => {
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN tags TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN appearance_chapters TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN character_arc TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN is_pinned INTEGER DEFAULT 0;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN pinned_at INTEGER;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN personal_intro TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN background TEXT;`);
  } catch (_) {}
  try {
    await db.run(sql`ALTER TABLE characters ADD COLUMN inspiration_fragments TEXT;`);
  } catch (_) {}
};

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureCharacterColumns(db);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const charId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效作品ID" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    if (charId) {
      const char = await db.select().from(characters).where(and(eq(characters.id, charId), eq(characters.workId, workId))).get();
      return NextResponse.json({ success: true, result: char });
    }

    const list = await db.select().from(characters).where(eq(characters.workId, workId)).orderBy(desc(characters.isPinned), desc(characters.pinnedAt), desc(characters.updatedAt)).all();

    return NextResponse.json({ success: true, result: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "获取角色失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureCharacterColumns(db);

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
      personalIntro,
      description,
      background,
      experiences,
      inspirationFragments,
      relationships,
      organizations,
      abilities,
      tags,
      appearanceChapters,
      characterArc,
      isPinned,
      extra,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "角色姓名不能为空" }, { status: 400 });
    }

    const finalIntro = personalIntro !== undefined ? personalIntro : (description || null);
    const finalBg = background !== undefined ? background : (experiences || null);

    const newCharData = {
      workId,
      name: name.trim(),
      alias: alias?.trim() || null,
      gender: gender?.trim() || "男",
      age: age?.trim() || null,
      identity: identity?.trim() || null,
      faction: faction?.trim() || null,
      roleType: roleType || "major",
      appearance: appearance !== undefined ? (appearance || null) : null,
      avatarUrl: avatarUrl || null,
      personality: personality !== undefined ? (personality || null) : null,
      personalIntro: finalIntro,
      description: finalIntro,
      background: finalBg,
      experiences: finalBg,
      inspirationFragments: inspirationFragments !== undefined ? (inspirationFragments || null) : null,
      relationships: Array.isArray(relationships) ? relationships : [],
      organizations: organizations?.trim() || null,
      abilities: abilities !== undefined ? (abilities || null) : null,
      tags: tags?.trim() || null,
      appearanceChapters: appearanceChapters?.trim() || null,
      characterArc: characterArc !== undefined ? (characterArc || null) : null,
      isPinned: isPinned ? 1 : 0,
      pinnedAt: isPinned ? new Date() : null,
      extra: typeof extra === "object" ? extra : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await db.insert(characters).values(newCharData).returning().get();

    return NextResponse.json({
      success: true,
      result: inserted,
      message: "角色创建成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "创建角色失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureCharacterColumns(db);

    const body = await req.json();
    const {
      id: rawId,
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
      personalIntro,
      description,
      background,
      experiences,
      inspirationFragments,
      relationships,
      organizations,
      abilities,
      tags,
      appearanceChapters,
      characterArc,
      isPinned,
      extra,
    } = body;

    const id = Number(rawId);
    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少角色ID" }, { status: 400 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (alias !== undefined) updateData.alias = alias?.trim() || null;
    if (gender !== undefined) updateData.gender = gender;
    if (age !== undefined) updateData.age = age?.trim() || null;
    if (identity !== undefined) updateData.identity = identity?.trim() || null;
    if (faction !== undefined) updateData.faction = faction?.trim() || null;
    if (roleType !== undefined) updateData.roleType = roleType;
    if (appearance !== undefined) updateData.appearance = appearance;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;
    if (personality !== undefined) updateData.personality = personality;
    if (personalIntro !== undefined) {
      updateData.personalIntro = personalIntro;
      updateData.description = personalIntro;
    } else if (description !== undefined) {
      updateData.personalIntro = description;
      updateData.description = description;
    }
    if (background !== undefined) {
      updateData.background = background;
      updateData.experiences = background;
    } else if (experiences !== undefined) {
      updateData.background = experiences;
      updateData.experiences = experiences;
    }
    if (inspirationFragments !== undefined) updateData.inspirationFragments = inspirationFragments;
    if (relationships !== undefined) updateData.relationships = relationships;
    if (organizations !== undefined) updateData.organizations = organizations?.trim() || null;
    if (abilities !== undefined) updateData.abilities = abilities;
    if (tags !== undefined) updateData.tags = tags?.trim() || null;
    if (appearanceChapters !== undefined) updateData.appearanceChapters = appearanceChapters?.trim() || null;
    if (characterArc !== undefined) updateData.characterArc = characterArc;
    if (isPinned !== undefined) {
      updateData.isPinned = isPinned ? 1 : 0;
      if (isPinned) {
        updateData.pinnedAt = new Date();
      }
    }
    if (extra !== undefined) updateData.extra = extra;

    const updated = await db.update(characters).set(updateData).where(eq(characters.id, id)).returning().get();

    return NextResponse.json({
      success: true,
      result: updated,
      message: "角色更新成功",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "更新角色失败" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureCharacterColumns(db);

    const body = await req.json();
    const id = Number(body.id);
    const isPinned = body.isPinned ? 1 : 0;

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少角色ID" }, { status: 400 });
    }

    await db.update(characters).set({
      isPinned,
      pinnedAt: isPinned ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(characters.id, id)).run();

    return NextResponse.json({ success: true, message: isPinned ? "已置顶角色" : "已取消置顶" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "置顶操作失败" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    await ensureCharacterColumns(db);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) {}
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "缺少角色ID" }, { status: 400 });
    }

    await db.delete(characters).where(eq(characters.id, id)).run();

    return NextResponse.json({ success: true, message: "角色删除成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除角色失败" }, { status: 500 });
  }
});
