// API: 批量将作者勾选确认的新增/追加世界观设定安全写入对应资料库表，自动绑定外键 ID 并标记章节 world_extracted=1
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import {
  getDb,
  chapters,
  characters,
  locations,
  factions,
  items,
  worldRules,
  characterRelations,
  timelines,
  timelineEvents,
} from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";

function normKey(val?: string | null): string {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function appendUnique(existing?: string | null, addition?: string | null, sep = "\n"): string | undefined {
  const add = String(addition || "").trim();
  if (!add) return existing || undefined;
  const base = String(existing || "").trim();
  if (!base) return add;
  if (base.includes(add)) return base;
  return `${base}${sep}${add}`;
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody<{
      workId?: number | string;
      scannedChapterIds?: Array<number | string>;
      selected?: {
        characters?: any[];
        locations?: any[];
        factions?: any[];
        items?: any[];
        rules?: any[];
        relations?: any[];
        timelineEvents?: any[];
      };
    }>(req);
    if (!parsedBody.ok) return parsedBody.response;

    const workId = Number(parsedBody.data.workId);
    const scannedChapterIds = Array.isArray(parsedBody.data.scannedChapterIds)
      ? parsedBody.data.scannedChapterIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    const selected = parsedBody.data.selected || {};

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效的 workId" }, { status: 400 });
    }

    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    // 预加载现有角色与地点映射表，用于自动绑定 leaderId / locationId / ownerId / sourceCharId / targetCharId
    const [existingChars, existingLocs] = await Promise.all([
      db.select().from(characters).where(eq(characters.workId, workId)).all(),
      db.select().from(locations).where(eq(locations.workId, workId)).all(),
    ]);

    const charByName = new Map<string, { id: number; name: string }>();
    const charById = new Map<number, (typeof existingChars)[number]>();
    for (const c of existingChars) {
      charByName.set(normKey(c.name), { id: c.id, name: c.name });
      charById.set(c.id, c);
    }

    const locByName = new Map<string, { id: number; name: string }>();
    const locById = new Map<number, (typeof existingLocs)[number]>();
    for (const l of existingLocs) {
      locByName.set(normKey(l.name), { id: l.id, name: l.name });
      locById.set(l.id, l);
    }

    const appliedCounts = {
      characters: 0,
      locations: 0,
      factions: 0,
      items: 0,
      rules: 0,
      relations: 0,
      timelineEvents: 0,
    };

    const now = new Date();

    // 1. 角色同步（新增或追加更新）
    for (const c of Array.isArray(selected.characters) ? selected.characters : []) {
      const name = String(c?.name || "").trim();
      if (!name) continue;
      const existingRow =
        (c.existingId ? charById.get(Number(c.existingId)) : undefined) ||
        (() => {
          const hit = charByName.get(normKey(name));
          return hit ? charById.get(hit.id) : undefined;
        })();

      if (existingRow) {
        await db
          .update(characters)
          .set({
            alias: appendUnique(existingRow.alias, c.alias, " / "),
            identity: existingRow.identity || String(c.identity || "").trim() || null,
            faction: existingRow.faction || String(c.faction || "").trim() || null,
            personality: appendUnique(existingRow.personality, c.personality, "；"),
            abilities: appendUnique(existingRow.abilities, c.abilities, "；"),
            appearance: appendUnique(existingRow.appearance, c.appearance, "；"),
            experiences: appendUnique(existingRow.experiences, c.description, "\n"),
            appearanceChapters: appendUnique(existingRow.appearanceChapters, c.sourceChapter, "、"),
            updatedAt: now,
          })
          .where(and(eq(characters.id, existingRow.id), eq(characters.workId, workId)))
          .run();
        appliedCounts.characters += 1;
      } else {
        const inserted = await db
          .insert(characters)
          .values({
            workId,
            name,
            alias: String(c.alias || "").trim() || null,
            gender: String(c.gender || "").trim() || "未知",
            identity: String(c.identity || "").trim() || null,
            roleType: String(c.roleType || "supporting"),
            faction: String(c.faction || "").trim() || null,
            personality: String(c.personality || "").trim() || null,
            abilities: String(c.abilities || "").trim() || null,
            appearance: String(c.appearance || "").trim() || null,
            description: String(c.description || "").trim() || null,
            appearanceChapters: String(c.sourceChapter || "").trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();
        if (inserted) {
          charByName.set(normKey(inserted.name), { id: inserted.id, name: inserted.name });
          charById.set(inserted.id, inserted);
          appliedCounts.characters += 1;
        }
      }
    }

    // 2. 地点同步
    for (const l of Array.isArray(selected.locations) ? selected.locations : []) {
      const name = String(l?.name || "").trim();
      if (!name) continue;
      const existingRow =
        (l.existingId ? locById.get(Number(l.existingId)) : undefined) ||
        (() => {
          const hit = locByName.get(normKey(name));
          return hit ? locById.get(hit.id) : undefined;
        })();

      if (existingRow) {
        await db
          .update(locations)
          .set({
            region: existingRow.region || String(l.region || "").trim() || null,
            geography: appendUnique(existingRow.geography, l.geography, "\n"),
            features: appendUnique(existingRow.features, l.features, "；"),
            governingFaction: existingRow.governingFaction || String(l.governingFaction || "").trim() || null,
            description: appendUnique(existingRow.description, l.description, "\n"),
            updatedAt: now,
          })
          .where(and(eq(locations.id, existingRow.id), eq(locations.workId, workId)))
          .run();
        appliedCounts.locations += 1;
      } else {
        const inserted = await db
          .insert(locations)
          .values({
            workId,
            name,
            region: String(l.region || "").trim() || null,
            type: String(l.type || "city"),
            geography: String(l.geography || "").trim() || null,
            features: String(l.features || "").trim() || null,
            governingFaction: String(l.governingFaction || "").trim() || null,
            description: String(l.description || "").trim() || null,
            posX: 25 + Math.floor(Math.random() * 50),
            posY: 25 + Math.floor(Math.random() * 50),
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();
        if (inserted) {
          locByName.set(normKey(inserted.name), { id: inserted.id, name: inserted.name });
          locById.set(inserted.id, inserted);
          appliedCounts.locations += 1;
        }
      }
    }

    // 3. 阵营同步（自动绑定领袖角色 ID 与据点地点 ID）
    const existingFacs =
      Array.isArray(selected.factions) && selected.factions.length > 0
        ? await db.select().from(factions).where(eq(factions.workId, workId)).all()
        : [];
    const facById = new Map(existingFacs.map((f) => [f.id, f]));
    const facByName = new Map(existingFacs.map((f) => [normKey(f.name), f]));

    for (const f of Array.isArray(selected.factions) ? selected.factions : []) {
      const name = String(f?.name || "").trim();
      if (!name) continue;
      const existingRow = (f.existingId ? facById.get(Number(f.existingId)) : undefined) || facByName.get(normKey(name));
      const leaderHit = f.leader ? charByName.get(normKey(f.leader)) : undefined;
      const locHit = f.controlledLocations ? locByName.get(normKey(f.controlledLocations)) : undefined;

      if (existingRow) {
        await db
          .update(factions)
          .set({
            leader: existingRow.leader || String(f.leader || "").trim() || null,
            leaderId: existingRow.leaderId || leaderHit?.id || null,
            doctrine: appendUnique(existingRow.doctrine, f.doctrine, "\n"),
            controlledLocations: appendUnique(existingRow.controlledLocations, f.controlledLocations, "、"),
            locationId: existingRow.locationId || locHit?.id || null,
            description: appendUnique(existingRow.description, f.description, "\n"),
            updatedAt: now,
          })
          .where(and(eq(factions.id, existingRow.id), eq(factions.workId, workId)))
          .run();
      } else {
        await db
          .insert(factions)
          .values({
            workId,
            name,
            leader: String(f.leader || "").trim() || null,
            leaderId: leaderHit?.id || null,
            alignment: String(f.alignment || "neutral"),
            scale: String(f.scale || "p3"),
            doctrine: String(f.doctrine || "").trim() || null,
            controlledLocations: String(f.controlledLocations || "").trim() || null,
            locationId: locHit?.id || null,
            description: String(f.description || "").trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      appliedCounts.factions += 1;
    }

    // 4. 物品道具同步（自动绑定持有者角色 ID，保留代价/副作用字段）
    const existingItems =
      Array.isArray(selected.items) && selected.items.length > 0
        ? await db.select().from(items).where(eq(items.workId, workId)).all()
        : [];
    const itemById = new Map(existingItems.map((i) => [i.id, i]));
    const itemByName = new Map(existingItems.map((i) => [normKey(i.name), i]));

    for (const i of Array.isArray(selected.items) ? selected.items : []) {
      const name = String(i?.name || "").trim();
      if (!name) continue;
      const existingRow = (i.existingId ? itemById.get(Number(i.existingId)) : undefined) || itemByName.get(normKey(name));
      const ownerHit = i.ownerName ? charByName.get(normKey(i.ownerName)) : undefined;

      if (existingRow) {
        await db
          .update(items)
          .set({
            ownerId: existingRow.ownerId || ownerHit?.id || null,
            ownerName: existingRow.ownerName || String(i.ownerName || "").trim() || null,
            currentHolder: String(i.ownerName || "").trim() || existingRow.currentHolder || null,
            effects: appendUnique(existingRow.effects, i.effects, "\n") || existingRow.effects,
            drawbacks: appendUnique(existingRow.drawbacks, i.drawbacks, "\n"),
            description: appendUnique(existingRow.description, i.description, "\n"),
            updatedAt: now,
          })
          .where(and(eq(items.id, existingRow.id), eq(items.workId, workId)))
          .run();
      } else {
        await db
          .insert(items)
          .values({
            workId,
            name,
            category: String(i.category || "treasure"),
            tier: String(i.tier || "").trim() || null,
            ownerId: ownerHit?.id || null,
            ownerName: String(i.ownerName || "").trim() || null,
            currentHolder: String(i.ownerName || "").trim() || null,
            effects: String(i.effects || i.description || "待补充效果").trim(),
            drawbacks: String(i.drawbacks || "").trim() || null,
            description: String(i.description || "").trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      appliedCounts.items += 1;
    }

    // 5. 世界规则同步
    const existingRules =
      Array.isArray(selected.rules) && selected.rules.length > 0
        ? await db.select().from(worldRules).where(eq(worldRules.workId, workId)).all()
        : [];
    const ruleById = new Map(existingRules.map((r) => [r.id, r]));
    const ruleByName = new Map(existingRules.map((r) => [normKey(r.name), r]));

    for (const r of Array.isArray(selected.rules) ? selected.rules : []) {
      const name = String(r?.name || "").trim();
      if (!name) continue;
      const existingRow = (r.existingId ? ruleById.get(Number(r.existingId)) : undefined) || ruleByName.get(normKey(name));

      if (existingRow) {
        await db
          .update(worldRules)
          .set({
            mechanisms: appendUnique(existingRow.mechanisms, r.mechanisms, "\n"),
            drawbacks: appendUnique(existingRow.drawbacks, r.drawbacks, "\n"),
            taboos: appendUnique(existingRow.taboos, r.taboos, "\n"),
            description: appendUnique(existingRow.description, r.description, "\n"),
            updatedAt: now,
          })
          .where(and(eq(worldRules.id, existingRow.id), eq(worldRules.workId, workId)))
          .run();
      } else {
        await db
          .insert(worldRules)
          .values({
            workId,
            name,
            category: String(r.category || "power_system"),
            mechanisms: String(r.mechanisms || "").trim() || null,
            drawbacks: String(r.drawbacks || "").trim() || null,
            taboos: String(r.taboos || "").trim() || null,
            description: String(r.description || "").trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      appliedCounts.rules += 1;
    }

    // 6. 人物关系同步（若关系两端人物尚未建卡，自动补建轻量角色卡确保关系图谱外键完整）
    const ensureCharacterForRelation = async (charName: string): Promise<{ id: number; name: string }> => {
      const hit = charByName.get(normKey(charName));
      if (hit) return hit;
      const inserted = await db
        .insert(characters)
        .values({
          workId,
          name: charName,
          roleType: "supporting",
          gender: "未知",
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      const entry = { id: inserted.id, name: inserted.name };
      charByName.set(normKey(inserted.name), entry);
      return entry;
    };

    for (const rel of Array.isArray(selected.relations) ? selected.relations : []) {
      const sourceName = String(rel?.sourceCharName || "").trim();
      const targetName = String(rel?.targetCharName || "").trim();
      const relationType = String(rel?.relationType || "").trim();
      if (!sourceName || !targetName || !relationType || normKey(sourceName) === normKey(targetName)) continue;

      if (rel.existingId) {
        await db
          .update(characterRelations)
          .set({
            relationType,
            relationTag: String(rel.relationTag || "friendly"),
            description: String(rel.description || "").trim() || null,
            updatedAt: now,
          })
          .where(and(eq(characterRelations.id, Number(rel.existingId)), eq(characterRelations.workId, workId)))
          .run();
      } else {
        const src = await ensureCharacterForRelation(sourceName);
        const tgt = await ensureCharacterForRelation(targetName);
        await db
          .insert(characterRelations)
          .values({
            workId,
            sourceCharId: src.id,
            sourceCharName: src.name,
            targetCharId: tgt.id,
            targetCharName: tgt.name,
            relationType,
            relationTag: String(rel.relationTag || "friendly"),
            description: String(rel.description || "").trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
      appliedCounts.relations += 1;
    }

    // 7. 时间线大事件同步（自动挂载至主时间线，无时间线则自动建默认主线）
    const selectedEvents = Array.isArray(selected.timelineEvents) ? selected.timelineEvents : [];
    if (selectedEvents.length > 0) {
      const existingTimelines = await db
        .select()
        .from(timelines)
        .where(eq(timelines.workId, workId))
        .orderBy(desc(timelines.isMain))
        .all();

      let targetTimelineId = existingTimelines[0]?.id;
      if (!targetTimelineId) {
        const createdTimeline = await db
          .insert(timelines)
          .values({
            workId,
            title: "主线编年史",
            description: "由章节剧情自动沉淀的主线大事件时间轴",
            isMain: 1,
            color: "#00c9ff",
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();
        targetTimelineId = createdTimeline.id;
      }

      const lastEvent = await db
        .select({ sortOrder: timelineEvents.sortOrder })
        .from(timelineEvents)
        .where(eq(timelineEvents.timelineId, targetTimelineId))
        .orderBy(desc(timelineEvents.sortOrder))
        .limit(1)
        .get();
      let nextOrder = (lastEvent?.sortOrder || 0) + 1;

      for (const ev of selectedEvents) {
        const title = String(ev?.title || "").trim();
        if (!title) continue;
        await db
          .insert(timelineEvents)
          .values({
            workId,
            timelineId: targetTimelineId,
            timePoint: String(ev.timePoint || ev.sourceChapter || "剧情节点").trim(),
            sortOrder: nextOrder++,
            title,
            location: String(ev.location || "").trim() || null,
            characters: String(ev.characters || "").trim() || null,
            impactLevel: String(ev.impactLevel || "major"),
            description: String(ev.description || "").trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        appliedCounts.timelineEvents += 1;
      }
    }

    // 8. 标记本次已扫描章节为 world_extracted = 1（下次扫描增量跳过，节省 AI 额度）
    if (scannedChapterIds.length > 0) {
      await db
        .update(chapters)
        .set({ worldExtracted: 1 })
        .where(and(eq(chapters.workId, workId), inArray(chapters.id, scannedChapterIds)))
        .run();
    }

    const totalApplied = Object.values(appliedCounts).reduce((sum, v) => sum + v, 0);

    return NextResponse.json({
      success: true,
      result: {
        appliedCounts,
        totalApplied,
      },
      message:
        totalApplied > 0
          ? `已成功同步 ${totalApplied} 条设定到资料库`
          : "已标记本次章节为已扫描",
    });
  } catch (error: any) {
    console.error("[API /api/ai/world/apply-extracted POST] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "同步设定失败" }, { status: 500 });
  }
});
