// 工具：全作品「设定与资料库」智能上下文检索与格式化引擎（正向闭环供所有 AI 推演/写作路由复用）
import {
  getDb,
  characters,
  characterRelations,
  locations,
  factions,
  items,
  worldRules,
  timelineEvents,
  materials,
} from "@/db";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { stripHtml } from "@/utils/text";

export interface WorldLoreExplicitIds {
  charIds?: number[];
  locIds?: number[];
  facIds?: number[];
  itemIds?: number[];
  ruleIds?: number[];
  materialIds?: number[];
}

export interface WorldLoreOptions {
  includeTimeline?: boolean;
  includeMaterials?: boolean;
  includeRelations?: boolean;
  maxChars?: number;
  explicitIds?: WorldLoreExplicitIds;
}

export interface WorldLoreResult {
  text: string;
  charText: string;
  ruleText: string;
}

type DbInstance = ReturnType<typeof getDb>;

function isMentioned(query: string, ...names: Array<string | null | undefined>): boolean {
  if (!query) return false;
  for (const n of names) {
    const clean = (n || "").trim();
    if (clean.length >= 2 && query.includes(clean)) return true;
  }
  return false;
}

function selectByRelevance<T extends { name?: string | null; alias?: string | null }>(
  all: T[],
  queryText: string,
  limit: number,
  fallbackCount: number
): T[] {
  if (all.length === 0) return [];
  const matched = all.filter((item) => isMentioned(queryText, item.name, item.alias));
  if (matched.length > 0) {
    return matched.slice(0, limit);
  }
  return all.slice(0, fallbackCount);
}

/**
 * 统一并行拉取并按需裁剪作品的世界观设定资料，注入到 AI 写作/推演/逻辑推算上下文中。
 * 保证角色、关系网、地点、阵营、物品（含代价限制）、世界规则（含禁忌）、时间线事件、设定素材全部闭环生效。
 */
export async function buildWorldLoreContext(
  db: DbInstance,
  workId: number,
  queryText: string = "",
  options: WorldLoreOptions = {}
): Promise<WorldLoreResult> {
  const {
    includeTimeline = true,
    includeMaterials = true,
    includeRelations = true,
    maxChars = 3200,
    explicitIds = {},
  } = options;

  const charIds = (explicitIds.charIds || []).filter((n) => Number.isFinite(n) && n > 0);
  const locIds = (explicitIds.locIds || []).filter((n) => Number.isFinite(n) && n > 0);
  const facIds = (explicitIds.facIds || []).filter((n) => Number.isFinite(n) && n > 0);
  const itemIds = (explicitIds.itemIds || []).filter((n) => Number.isFinite(n) && n > 0);
  const ruleIds = (explicitIds.ruleIds || []).filter((n) => Number.isFinite(n) && n > 0);
  const materialIds = (explicitIds.materialIds || []).filter((n) => Number.isFinite(n) && n > 0);

  const [
    allChars,
    allRelations,
    allLocs,
    allFacs,
    allItems,
    allRules,
    recentEvents,
    allMaterials,
  ] = await Promise.all([
    charIds.length > 0
      ? db.select().from(characters).where(and(eq(characters.workId, workId), inArray(characters.id, charIds))).all()
      : db
          .select()
          .from(characters)
          .where(eq(characters.workId, workId))
          .orderBy(desc(characters.isPinned), asc(characters.id))
          .limit(40)
          .all(),
    includeRelations
      ? db.select().from(characterRelations).where(eq(characterRelations.workId, workId)).limit(30).all()
      : Promise.resolve([]),
    locIds.length > 0
      ? db.select().from(locations).where(and(eq(locations.workId, workId), inArray(locations.id, locIds))).all()
      : db.select().from(locations).where(eq(locations.workId, workId)).limit(40).all(),
    facIds.length > 0
      ? db.select().from(factions).where(and(eq(factions.workId, workId), inArray(factions.id, facIds))).all()
      : db.select().from(factions).where(eq(factions.workId, workId)).limit(30).all(),
    itemIds.length > 0
      ? db.select().from(items).where(and(eq(items.workId, workId), inArray(items.id, itemIds))).all()
      : db.select().from(items).where(eq(items.workId, workId)).limit(40).all(),
    ruleIds.length > 0
      ? db.select().from(worldRules).where(and(eq(worldRules.workId, workId), inArray(worldRules.id, ruleIds))).all()
      : db
          .select()
          .from(worldRules)
          .where(eq(worldRules.workId, workId))
          .orderBy(desc(worldRules.isPinned), asc(worldRules.id))
          .limit(8)
          .all(),
    includeTimeline
      ? db
          .select()
          .from(timelineEvents)
          .where(eq(timelineEvents.workId, workId))
          .orderBy(desc(timelineEvents.sortOrder), desc(timelineEvents.id))
          .limit(6)
          .all()
      : Promise.resolve([]),
    includeMaterials
      ? materialIds.length > 0
        ? db.select().from(materials).where(and(eq(materials.workId, workId), inArray(materials.id, materialIds))).all()
        : db
            .select()
            .from(materials)
            .where(and(eq(materials.workId, workId), eq(materials.includeInAiContext, 1)))
            .limit(6)
            .all()
      : Promise.resolve([]),
  ]);

  // 1. 角色筛选：显式指定 > 正文/大纲提及 > 主角/置顶 > 其他，最多 10 人
  let selectedChars = allChars;
  if (charIds.length === 0 && allChars.length > 10) {
    const mentioned = allChars.filter((c) => isMentioned(queryText, c.name, c.alias));
    const core = allChars.filter(
      (c) => !mentioned.includes(c) && (c.roleType === "protagonist" || c.isPinned === 1 || c.roleType === "antagonist")
    );
    const others = allChars.filter((c) => !mentioned.includes(c) && !core.includes(c));
    selectedChars = [...mentioned, ...core, ...others].slice(0, 10);
  }
  const selectedCharNames = new Set(selectedChars.map((c) => c.name));

  // 2. 关系网筛选：优先与已选角色直接相关的关系边，最多 12 条
  const prioritizedRelations = allRelations
    .slice()
    .sort((a, b) => {
      const aHit = (selectedCharNames.has(a.sourceCharName) ? 1 : 0) + (selectedCharNames.has(a.targetCharName) ? 1 : 0);
      const bHit = (selectedCharNames.has(b.sourceCharName) ? 1 : 0) + (selectedCharNames.has(b.targetCharName) ? 1 : 0);
      return bHit - aHit;
    })
    .slice(0, 12);

  // 3. 地点 / 阵营 / 物品：若显式指定则全留，否则优先按 queryText 命中，未命中则保底注入前几项核心设定
  const selectedLocs = locIds.length > 0 ? allLocs : selectByRelevance(allLocs, queryText, 5, 3);
  const selectedFacs = facIds.length > 0 ? allFacs : selectByRelevance(allFacs, queryText, 4, 3);
  const selectedItems = itemIds.length > 0 ? allItems : selectByRelevance(allItems, queryText, 5, 4);
  const selectedRules = ruleIds.length > 0 ? allRules : allRules.slice(0, 6);
  const orderedEvents = recentEvents.slice().reverse();

  const charText = selectedChars
    .map((c) => {
      const parts = [
        c.identity || c.roleType ? `身份[${c.identity || c.roleType}]` : "",
        c.personality ? `性格[${c.personality.slice(0, 70)}]` : "",
        c.abilities ? `能力[${c.abilities.slice(0, 70)}]` : "",
        c.characterArc ? `成长线[${c.characterArc.slice(0, 60)}]` : "",
        !c.characterArc && (c.description || c.experiences)
          ? `经历[${(c.description || c.experiences || "").slice(0, 90)}]`
          : "",
      ].filter(Boolean);
      return `- ${c.name}${c.alias ? `（${c.alias}）` : ""}：${parts.join("，") || "待完善"}`;
    })
    .join("\n");

  const ruleText = selectedRules
    .map((r) => {
      const mech = stripHtml(r.mechanisms || r.description).slice(0, 140);
      const taboo = (r.taboos || r.drawbacks || "").trim().slice(0, 90);
      return `- ${r.name}：${mech || "核心法则"}${taboo ? `【禁忌/代价：${taboo}】` : ""}`;
    })
    .join("\n");

  const blocks: string[] = [];

  if (charText) {
    blocks.push(`【核心角色档案（人物动作与台词需贴合性格与身份，严防 OOC）】：\n${charText}`);
  }

  if (prioritizedRelations.length > 0) {
    const relLines = prioritizedRelations
      .map(
        (r) =>
          `- ${r.sourceCharName} → ${r.targetCharName}：${r.relationType}${r.description ? `（${r.description.slice(0, 60)}）` : ""}`
      )
      .join("\n");
    blocks.push(`【人物关系网】：\n${relLines}`);
  }

  if (ruleText) {
    blocks.push(`【世界法则与禁忌（严禁违背规则与战力上限）】：\n${ruleText}`);
  }

  if (selectedLocs.length > 0) {
    const locLines = selectedLocs
      .map((l) => {
        const desc = (l.geography || l.features || l.climate || l.terrain || l.description || "").slice(0, 90);
        const plot = l.plotPoints ? `，剧情关联[${l.plotPoints.slice(0, 60)}]` : "";
        return `- ${l.name}${l.region ? `（${l.region}）` : ""}：${desc || l.type || "关键地点"}${plot}`;
      })
      .join("\n");
    blocks.push(`【关联地点与地理环境】：\n${locLines}`);
  }

  if (selectedFacs.length > 0) {
    const facLines = selectedFacs
      .map(
        (f) =>
          `- ${f.name}：领袖[${f.leader || "未知"}]，立场[${f.alignment || "中立"}]，宗旨[${(f.doctrine || f.description || "无").slice(0, 80)}]`
      )
      .join("\n");
    blocks.push(`【关联势力阵营】：\n${facLines}`);
  }

  if (selectedItems.length > 0) {
    const itemLines = selectedItems
      .map(
        (i) =>
          `- ${i.name}${i.tier ? `（${i.tier}）` : ""}：效果[${(i.effects || i.description || "无").slice(0, 80)}]${
            i.drawbacks ? `，代价限制[${i.drawbacks.slice(0, 80)}]` : ""
          }${i.ownerName || i.currentHolder ? `，持有者[${i.ownerName || i.currentHolder}]` : ""}`
      )
      .join("\n");
    blocks.push(`【关联物品与法宝道具】：\n${itemLines}`);
  }

  if (orderedEvents.length > 0) {
    const eventLines = orderedEvents
      .map(
        (e) =>
          `- [${e.timePoint}] ${e.title}${e.location ? `（${e.location}）` : ""}${
            e.description ? `：${e.description.slice(0, 80)}` : ""
          }`
      )
      .join("\n");
    blocks.push(`【既定时间线节点（严禁违背既有时间顺序）】：\n${eventLines}`);
  }

  if (allMaterials.length > 0) {
    const matLines = allMaterials
      .map((m) => {
        const lore = (m.extractedLore || m.aiSummary || stripHtml(m.content)).slice(0, 160);
        return `- 《${m.title}》：${lore || "参考资料"}`;
      })
      .join("\n");
    blocks.push(`【作者设定素材库】：\n${matLines}`);
  }

  // 按预算组装最终上下文块，避免超出 Token 预算
  let assembled = "";
  for (const block of blocks) {
    const next = assembled ? `${assembled}\n\n${block}` : block;
    if (next.length <= maxChars) {
      assembled = next;
    } else {
      const remain = maxChars - assembled.length - 4;
      if (remain > 120) {
        assembled = `${assembled}\n\n${block.slice(0, remain)}…`;
      }
      break;
    }
  }

  return {
    text: assembled,
    charText,
    ruleText,
  };
}
