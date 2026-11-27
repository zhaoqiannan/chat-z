// API: 一键扫描章节正文，单次 AI 调用统一提取 7 大世界观设定（角色/地点/阵营/物品/规则/关系/时间线）并与现有库智能去重比对
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
  timelineEvents,
} from "@/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";
import { assertWorkOwnership, parseJsonBody } from "@/utils/ownership";

const MAX_CHAPTERS_PER_SCAN = 5;

function normKey(val?: string | null): string {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function trimText(val: unknown, maxLen: number): string {
  return String(val || "").trim().slice(0, maxLen);
}

function buildExcerptForScan(content: string, perChapterLimit: number): string {
  const clean = content.trim();
  if (clean.length <= perChapterLimit) return clean;
  const headLen = Math.floor(perChapterLimit * 0.55);
  const tailLen = perChapterLimit - headLen;
  return `${clean.slice(0, headLen)}\n……（中段略）……\n${clean.slice(-tailLen)}`;
}

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody<{
      workId?: number | string;
      chapterIds?: Array<number | string>;
      onlyUnscanned?: boolean;
    }>(req);
    if (!parsedBody.ok) return parsedBody.response;

    const workId = Number(parsedBody.data.workId);
    const requestedIds = Array.isArray(parsedBody.data.chapterIds)
      ? parsedBody.data.chapterIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    const onlyUnscanned = parsedBody.data.onlyUnscanned !== false;

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少有效的 workId" }, { status: 400 });
    }

    const work = await assertWorkOwnership(db, workId, user.userId);
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 403 });
    }

    const [
      candidateChapters,
      existingChars,
      existingLocs,
      existingFacs,
      existingItems,
      existingRules,
      existingRels,
      existingEvents,
    ] = await Promise.all([
      requestedIds.length > 0
        ? db
            .select({
              id: chapters.id,
              chapterNumber: chapters.chapterNumber,
              title: chapters.title,
              content: chapters.content,
              wordCount: chapters.wordCount,
              worldExtracted: chapters.worldExtracted,
            })
            .from(chapters)
            .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0), inArray(chapters.id, requestedIds.slice(0, MAX_CHAPTERS_PER_SCAN))))
            .orderBy(asc(chapters.chapterNumber), asc(chapters.id))
            .all()
        : db
            .select({
              id: chapters.id,
              chapterNumber: chapters.chapterNumber,
              title: chapters.title,
              content: chapters.content,
              wordCount: chapters.wordCount,
              worldExtracted: chapters.worldExtracted,
            })
            .from(chapters)
            .where(eq(chapters.workId, workId))
            .orderBy(asc(chapters.chapterNumber), asc(chapters.id))
            .all(),
      db.select({ id: characters.id, name: characters.name, identity: characters.identity, abilities: characters.abilities }).from(characters).where(eq(characters.workId, workId)).all(),
      db.select({ id: locations.id, name: locations.name, region: locations.region, type: locations.type }).from(locations).where(eq(locations.workId, workId)).all(),
      db.select({ id: factions.id, name: factions.name, leader: factions.leader, alignment: factions.alignment }).from(factions).where(eq(factions.workId, workId)).all(),
      db.select({ id: items.id, name: items.name, ownerName: items.ownerName, effects: items.effects }).from(items).where(eq(items.workId, workId)).all(),
      db.select({ id: worldRules.id, name: worldRules.name, category: worldRules.category }).from(worldRules).where(eq(worldRules.workId, workId)).all(),
      db
        .select({
          id: characterRelations.id,
          sourceCharName: characterRelations.sourceCharName,
          targetCharName: characterRelations.targetCharName,
          relationType: characterRelations.relationType,
        })
        .from(characterRelations)
        .where(eq(characterRelations.workId, workId))
        .all(),
      db.select({ id: timelineEvents.id, title: timelineEvents.title, timePoint: timelineEvents.timePoint }).from(timelineEvents).where(eq(timelineEvents.workId, workId)).all(),
    ]);

    const filteredChapters = candidateChapters
      .filter((ch) => {
        const clean = (ch.content || "").trim();
        if (clean.length < 20) return false;
        if (requestedIds.length === 0 && onlyUnscanned && ch.worldExtracted === 1) return false;
        return true;
      })
      .slice(0, MAX_CHAPTERS_PER_SCAN);

    if (filteredChapters.length === 0) {
      return NextResponse.json({
        success: true,
        result: {
          scannedChapters: [],
          candidates: {
            characters: [],
            locations: [],
            factions: [],
            items: [],
            rules: [],
            relations: [],
            timelineEvents: [],
          },
          totalCount: 0,
        },
        message: "暂无需要扫描的未同步正文章节",
      });
    }

    const perChapterLimit = filteredChapters.length <= 2 ? 4200 : Math.floor(10500 / filteredChapters.length);
    const chaptersText = filteredChapters
      .map(
        (ch) =>
          `=== 第${ch.chapterNumber || 1}章《${ch.title}》 ===\n${buildExcerptForScan(ch.content || "", perChapterLimit)}`
      )
      .join("\n\n");

    const existingDigest = [
      existingChars.length > 0 ? `已有角色：${existingChars.map((c) => c.name).slice(0, 50).join("、")}` : "",
      existingLocs.length > 0 ? `已有地点：${existingLocs.map((l) => l.name).slice(0, 40).join("、")}` : "",
      existingFacs.length > 0 ? `已有阵营：${existingFacs.map((f) => f.name).slice(0, 30).join("、")}` : "",
      existingItems.length > 0 ? `已有物品：${existingItems.map((i) => i.name).slice(0, 40).join("、")}` : "",
      existingRules.length > 0 ? `已有规则：${existingRules.map((r) => r.name).slice(0, 25).join("、")}` : "",
      existingRels.length > 0
        ? `已有关系：${existingRels.map((r) => `${r.sourceCharName}-${r.targetCharName}(${r.relationType})`).slice(0, 30).join("；")}`
        : "",
      existingEvents.length > 0 ? `已有时间线事件：${existingEvents.map((e) => e.title).slice(0, 25).join("、")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `你是一位严谨的长篇小说世界观设定档案管理员。
请仔细阅读作者提供的章节正文，一次性精准提取其中**新出现或有重大新设定补充**的 7 类世界观要素：
1. characters（角色）：仅提取有明确姓名或称号的具名角色，忽略“路人甲/店小二/一名侍卫”等无名龙套。
2. locations（地点）：具体城池、宗门、秘境、建筑、山脉、区域等。
3. factions（势力阵营）：宗门、帮派、国家、家族、组织、公司等。
4. items（物品法宝/关键道具）：武器、法宝、丹药、秘籍、信物、关键科技装备等。
5. rules（世界法则/力量体系/社会禁忌）：修炼境界、魔法/科技运行机理、必须遵守的禁忌或代价。
6. relations（人物关系）：章节中明确体现的两人之间关系（如师徒、敌对、血亲、恋人、同盟、上下级、救命恩人等）。
7. timelineEvents（时间线大事件）：对主线有实质推动的关键历史/剧情事件，忽略琐碎日常。

【增量去重铁律（极其重要）】：
- 参考下方【现有设定库已有名称】：
  - 如果正文中出现的是**全新实体**，请完整提取其字段；
  - 如果实体**已存在于设定库**，**只有当本章正文披露了实质性新设定**（如新能力/新身份/新代价/关系逆转）时才列入并只写新增亮点；如果只是常规出场没有新信息，**绝不要重复输出**！
- 绝不凭空编造正文中没写到的设定；某个分类如果没有新发现，直接输出空数组 []。
- 严格仅输出合法 JSON，严禁 Markdown 代码块或任何解释：
{
  "characters": [
    {
      "name": "姓名",
      "alias": "别名或称号（无则空串）",
      "gender": "男/女/未知",
      "identity": "身份职业",
      "roleType": "protagonist|major|supporting|antagonist|mob",
      "faction": "所属势力名（无则空串）",
      "personality": "性格特征简述",
      "abilities": "能力/功法/特长",
      "appearance": "外貌特征",
      "description": "本章披露的核心背景或新经历（40~100字）",
      "sourceChapter": "第X章"
    }
  ],
  "locations": [
    {
      "name": "地点名",
      "region": "所属大区域",
      "type": "city|sect|dungeon|natural|landmark",
      "geography": "地形环境或建筑特点",
      "features": "风土或标志特点",
      "governingFaction": "控制势力",
      "description": "地点设定简述",
      "sourceChapter": "第X章"
    }
  ],
  "factions": [
    {
      "name": "阵营名",
      "leader": "领袖姓名",
      "alignment": "positive|negative|neutral",
      "scale": "p1~p5",
      "doctrine": "宗旨信条或行事风格",
      "controlledLocations": "据点或控制范围",
      "description": "阵营设定简述",
      "sourceChapter": "第X章"
    }
  ],
  "items": [
    {
      "name": "物品名",
      "category": "treasure|weapon|consumable|material|tech|book|curse|misc",
      "tier": "品阶等级",
      "ownerName": "当前持有者姓名",
      "effects": "核心效果与作用（必填）",
      "drawbacks": "副作用/使用代价/限制（有则必填）",
      "description": "来历或补充说明",
      "sourceChapter": "第X章"
    }
  ],
  "rules": [
    {
      "name": "法则或体系名",
      "category": "power_system|physics_magic|society_law|taboo|custom",
      "mechanisms": "底层运转机制",
      "drawbacks": "代价或限制",
      "taboos": "禁忌或触发后果",
      "description": "补充说明",
      "sourceChapter": "第X章"
    }
  ],
  "relations": [
    {
      "sourceCharName": "角色A姓名",
      "targetCharName": "角色B姓名",
      "relationType": "具体关系名称（如师徒/死敌/同盟）",
      "relationTag": "friendly|hostile|romantic|family|neutral",
      "description": "关系渊源简述",
      "sourceChapter": "第X章"
    }
  ],
  "timelineEvents": [
    {
      "timePoint": "时间点（如第3天夜/天元历三年/本章中段）",
      "title": "事件标题（8~20字）",
      "location": "发生地点",
      "characters": "涉及人物（逗号分隔）",
      "impactLevel": "climax|major|normal|minor",
      "description": "事件核心经过与后果（40~100字）",
      "sourceChapter": "第X章"
    }
  ]
}`;

    const userPrompt = `【作品】：《${work.title}》（题材：${work.tag || "小说"}）
${existingDigest ? `\n【现有设定库已有名称（避免无意义重复，仅当有新设定增量时才输出更新）】：\n${existingDigest}\n` : ""}
【待扫描章节正文（共 ${filteredChapters.length} 章）】：
${chaptersText}

请一次性输出 7 大分类的增量设定提取 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.25,
      maxTokens: 5120,
    });

    let parsed = parseStructuredJson<any>(raw, null);
    if (!parsed || typeof parsed !== "object") {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "fast",
          temperature: 0.2,
          maxTokens: 4096,
        });
        parsed = parseStructuredJson<any>(retryRaw, null);
      } catch {}
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ success: false, message: "AI 设定扫描解析失败，请稍后重试" }, { status: 500 });
    }

    // 构建现有实体索引，进行精准的 new / update 分类与去重
    const charMap = new Map(existingChars.map((c) => [normKey(c.name), c]));
    const locMap = new Map(existingLocs.map((l) => [normKey(l.name), l]));
    const facMap = new Map(existingFacs.map((f) => [normKey(f.name), f]));
    const itemMap = new Map(existingItems.map((i) => [normKey(i.name), i]));
    const ruleMap = new Map(existingRules.map((r) => [normKey(r.name), r]));
    const relMap = new Map<string, (typeof existingRels)[number]>();
    for (const r of existingRels) {
      const k1 = `${normKey(r.sourceCharName)}::${normKey(r.targetCharName)}`;
      const k2 = `${normKey(r.targetCharName)}::${normKey(r.sourceCharName)}`;
      relMap.set(k1, r);
      relMap.set(k2, r);
    }
    const eventTitleSet = new Set(existingEvents.map((e) => normKey(e.title)));

    const seenChars = new Set<string>();
    const charCandidates = (Array.isArray(parsed.characters) ? parsed.characters : [])
      .map((c: any, idx: number) => {
        const name = trimText(c?.name, 40);
        const key = normKey(name);
        if (!key || seenChars.has(key)) return null;
        seenChars.add(key);
        const existing = charMap.get(key);
        const validRoleTypes = ["protagonist", "major", "supporting", "antagonist", "mob"];
        const roleType = validRoleTypes.includes(String(c?.roleType)) ? String(c.roleType) : "supporting";
        return {
          tempId: `char-${idx}-${key}`,
          status: existing ? ("update" as const) : ("new" as const),
          existingId: existing?.id,
          existingSummary: existing
            ? [existing.identity, existing.abilities ? `能力:${existing.abilities.slice(0, 30)}` : ""].filter(Boolean).join(" · ")
            : undefined,
          name,
          alias: trimText(c?.alias, 60),
          gender: trimText(c?.gender, 16) || "未知",
          identity: trimText(c?.identity, 80),
          roleType,
          faction: trimText(c?.faction, 60),
          personality: trimText(c?.personality, 200),
          abilities: trimText(c?.abilities, 200),
          appearance: trimText(c?.appearance, 200),
          description: trimText(c?.description, 400),
          sourceChapter: trimText(c?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const seenLocs = new Set<string>();
    const locCandidates = (Array.isArray(parsed.locations) ? parsed.locations : [])
      .map((l: any, idx: number) => {
        const name = trimText(l?.name, 60);
        const key = normKey(name);
        if (!key || seenLocs.has(key)) return null;
        seenLocs.add(key);
        const existing = locMap.get(key);
        return {
          tempId: `loc-${idx}-${key}`,
          status: existing ? ("update" as const) : ("new" as const),
          existingId: existing?.id,
          existingSummary: existing ? [existing.region, existing.type].filter(Boolean).join(" · ") : undefined,
          name,
          region: trimText(l?.region, 60),
          type: trimText(l?.type, 24) || "city",
          geography: trimText(l?.geography, 240),
          features: trimText(l?.features, 240),
          governingFaction: trimText(l?.governingFaction, 60),
          description: trimText(l?.description, 400),
          sourceChapter: trimText(l?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const seenFacs = new Set<string>();
    const facCandidates = (Array.isArray(parsed.factions) ? parsed.factions : [])
      .map((f: any, idx: number) => {
        const name = trimText(f?.name, 60);
        const key = normKey(name);
        if (!key || seenFacs.has(key)) return null;
        seenFacs.add(key);
        const existing = facMap.get(key);
        const validAlign = ["positive", "negative", "neutral"];
        const alignment = validAlign.includes(String(f?.alignment)) ? String(f.alignment) : "neutral";
        return {
          tempId: `fac-${idx}-${key}`,
          status: existing ? ("update" as const) : ("new" as const),
          existingId: existing?.id,
          existingSummary: existing ? [existing.leader ? `领袖:${existing.leader}` : "", existing.alignment].filter(Boolean).join(" · ") : undefined,
          name,
          leader: trimText(f?.leader, 40),
          alignment,
          scale: trimText(f?.scale, 16) || "p3",
          doctrine: trimText(f?.doctrine, 240),
          controlledLocations: trimText(f?.controlledLocations, 120),
          description: trimText(f?.description, 400),
          sourceChapter: trimText(f?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const seenItems = new Set<string>();
    const itemCandidates = (Array.isArray(parsed.items) ? parsed.items : [])
      .map((i: any, idx: number) => {
        const name = trimText(i?.name, 60);
        const key = normKey(name);
        if (!key || seenItems.has(key)) return null;
        seenItems.add(key);
        const existing = itemMap.get(key);
        return {
          tempId: `item-${idx}-${key}`,
          status: existing ? ("update" as const) : ("new" as const),
          existingId: existing?.id,
          existingSummary: existing ? [existing.ownerName ? `持有:${existing.ownerName}` : "", existing.effects?.slice(0, 30)].filter(Boolean).join(" · ") : undefined,
          name,
          category: trimText(i?.category, 24) || "treasure",
          tier: trimText(i?.tier, 32),
          ownerName: trimText(i?.ownerName, 40),
          effects: trimText(i?.effects, 260) || trimText(i?.description, 200) || "待补充功能效果",
          drawbacks: trimText(i?.drawbacks, 240),
          description: trimText(i?.description, 400),
          sourceChapter: trimText(i?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const seenRules = new Set<string>();
    const ruleCandidates = (Array.isArray(parsed.rules) ? parsed.rules : [])
      .map((r: any, idx: number) => {
        const name = trimText(r?.name, 80);
        const key = normKey(name);
        if (!key || seenRules.has(key)) return null;
        seenRules.add(key);
        const existing = ruleMap.get(key);
        return {
          tempId: `rule-${idx}-${key}`,
          status: existing ? ("update" as const) : ("new" as const),
          existingId: existing?.id,
          existingSummary: existing?.category || undefined,
          name,
          category: trimText(r?.category, 32) || "power_system",
          mechanisms: trimText(r?.mechanisms, 400),
          drawbacks: trimText(r?.drawbacks, 240),
          taboos: trimText(r?.taboos, 240),
          description: trimText(r?.description, 400),
          sourceChapter: trimText(r?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const seenRels = new Set<string>();
    const relCandidates = (Array.isArray(parsed.relations) ? parsed.relations : [])
      .map((r: any, idx: number) => {
        const sourceCharName = trimText(r?.sourceCharName, 40);
        const targetCharName = trimText(r?.targetCharName, 40);
        const relationType = trimText(r?.relationType, 40);
        const sk = normKey(sourceCharName);
        const tk = normKey(targetCharName);
        if (!sk || !tk || sk === tk || !relationType) return null;
        const pairKey = [sk, tk].sort().join("::");
        if (seenRels.has(pairKey)) return null;
        seenRels.add(pairKey);

        const existing = relMap.get(`${sk}::${tk}`);
        // 若关系类型完全一致，视为已有关系，自动跳过
        if (existing && normKey(existing.relationType) === normKey(relationType)) {
          return null;
        }
        const validTags = ["friendly", "hostile", "romantic", "family", "neutral"];
        const relationTag = validTags.includes(String(r?.relationTag)) ? String(r.relationTag) : "friendly";
        return {
          tempId: `rel-${idx}-${pairKey}`,
          status: existing ? ("update" as const) : ("new" as const),
          existingId: existing?.id,
          existingSummary: existing ? `原关系：${existing.relationType}` : undefined,
          sourceCharName,
          targetCharName,
          relationType,
          relationTag,
          description: trimText(r?.description, 240),
          sourceChapter: trimText(r?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const seenEvents = new Set<string>();
    const eventCandidates = (Array.isArray(parsed.timelineEvents) ? parsed.timelineEvents : [])
      .map((e: any, idx: number) => {
        const title = trimText(e?.title, 80);
        const key = normKey(title);
        if (!key || seenEvents.has(key) || eventTitleSet.has(key)) return null;
        seenEvents.add(key);
        const validLevels = ["climax", "major", "normal", "minor"];
        const impactLevel = validLevels.includes(String(e?.impactLevel)) ? String(e.impactLevel) : "major";
        return {
          tempId: `event-${idx}-${key}`,
          status: "new" as const,
          timePoint: trimText(e?.timePoint, 60) || trimText(e?.sourceChapter, 24) || "剧情阶段",
          title,
          location: trimText(e?.location, 60),
          characters: trimText(e?.characters, 120),
          impactLevel,
          description: trimText(e?.description, 320),
          sourceChapter: trimText(e?.sourceChapter, 24),
        };
      })
      .filter(Boolean);

    const totalCount =
      charCandidates.length +
      locCandidates.length +
      facCandidates.length +
      itemCandidates.length +
      ruleCandidates.length +
      relCandidates.length +
      eventCandidates.length;

    return NextResponse.json({
      success: true,
      result: {
        scannedChapters: filteredChapters.map((c) => ({
          id: c.id,
          chapterNumber: c.chapterNumber || 1,
          title: c.title,
          wordCount: c.wordCount || 0,
        })),
        candidates: {
          characters: charCandidates,
          locations: locCandidates,
          factions: facCandidates,
          items: itemCandidates,
          rules: ruleCandidates,
          relations: relCandidates,
          timelineEvents: eventCandidates,
        },
        totalCount,
      },
      message:
        totalCount > 0
          ? `已扫描 ${filteredChapters.length} 章，发现 ${totalCount} 条可沉淀/更新的世界观设定`
          : `已扫描 ${filteredChapters.length} 章，暂未发现新的世界观设定`,
    });
  } catch (error: any) {
    console.error("[API /api/ai/world/extract-from-chapters POST] Error:", error);
    return NextResponse.json({ success: false, message: error?.message || "扫描设定异常" }, { status: 500 });
  }
});
