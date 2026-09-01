// API: 检索作品世界观实体与大纲元数据供 AI 协同助手上下文标签关联
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, characters, locations, factions, items, worldRules, outlines, chapters } from "@/db";
import { eq } from "drizzle-orm";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const currentChapterId = Number(searchParams.get("chapterId") || 0);

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "workId 无效" }, { status: 400 });
    }

    const [charList, locList, facList, itemList, ruleList, outlineList, chapterList] = await Promise.all([
      db.select({ id: characters.id, name: characters.name, roleType: characters.roleType, identity: characters.identity }).from(characters).where(eq(characters.workId, workId)).all(),
      db.select({ id: locations.id, name: locations.name, type: locations.type, region: locations.region }).from(locations).where(eq(locations.workId, workId)).all(),
      db.select({ id: factions.id, name: factions.name, scale: factions.scale }).from(factions).where(eq(factions.workId, workId)).all(),
      db.select({ id: items.id, name: items.name, category: items.category, tier: items.tier }).from(items).where(eq(items.workId, workId)).all(),
      db.select({ id: worldRules.id, name: worldRules.name, category: worldRules.category }).from(worldRules).where(eq(worldRules.workId, workId)).all(),
      db.select({ id: outlines.id, title: outlines.title, type: outlines.type, goal: outlines.goal }).from(outlines).where(eq(outlines.workId, workId)).all(),
      db.select({ id: chapters.id, title: chapters.title, chapterNumber: chapters.chapterNumber, isVolume: chapters.isVolume, summary: chapters.summary }).from(chapters).where(eq(chapters.workId, workId)).all(),
    ]);

    const tags: Array<{ id: string | number; name: string; type: string; desc?: string }> = [];

    charList.forEach((c) => tags.push({ id: c.id, name: c.name, type: "character", desc: c.identity || c.roleType || "角色" }));
    locList.forEach((l) => tags.push({ id: l.id, name: l.name, type: "location", desc: l.region || l.type || "地点" }));
    facList.forEach((f) => tags.push({ id: f.id, name: f.name, type: "faction", desc: f.scale || "势力" }));
    itemList.forEach((i) => tags.push({ id: i.id, name: i.name, type: "item", desc: i.tier || i.category || "物品" }));
    ruleList.forEach((r) => tags.push({ id: r.id, name: r.name, type: "rule", desc: r.category || "法则" }));
    outlineList.forEach((o) => tags.push({ id: o.id, name: o.title, type: "outline", desc: o.goal || "大纲" }));
    chapterList.filter((ch) => !ch.isVolume && ch.id !== currentChapterId).forEach((ch) => tags.push({ id: ch.id, name: `第${ch.chapterNumber}章 ${ch.title}`, type: "chapter", desc: ch.summary || "章节" }));

    return NextResponse.json({ success: true, result: tags });
  } catch (error: any) {
    console.error("Fetch context tags error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取上下文标签失败" }, { status: 500 });
  }
});
