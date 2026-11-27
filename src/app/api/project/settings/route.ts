import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import {
  getDb,
  works,
  chapters,
  outlines,
  characters,
  characterRelations,
  locations,
  factions,
  items,
  worldRules,
  timelines,
  timelineEvents,
  notes,
  materials,
  memoryFragments,
  chapterVersions,
} from "@/db";
import { eq, and, asc } from "drizzle-orm";
import { isSafeUrl, parseJsonBody } from "@/utils/ownership";

/**
 * 按分卷层级正确组织章节顺序（避免所有分卷因 chapterNumber=1 全部堆叠在第 1 章前）
 */
function buildVolumeOrderedSections<T extends { id: number; isVolume: number | null; volumeId: number | null; chapterNumber: number | null }>(
  chapterList: T[]
): Array<{ volume: T | null; chapters: T[] }> {
  const volumes = chapterList.filter((c) => c.isVolume === 1);
  const bodyChapters = chapterList
    .filter((c) => c.isVolume !== 1)
    .sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0));

  const grouped = new Map<number, T[]>();
  volumes.forEach((v) => grouped.set(v.id, []));
  const unassigned: T[] = [];

  for (const ch of bodyChapters) {
    if (ch.volumeId && grouped.has(ch.volumeId)) {
      grouped.get(ch.volumeId)!.push(ch);
    } else {
      unassigned.push(ch);
    }
  }

  const sections: Array<{ volume: T | null; chapters: T[] }> = [];
  if (unassigned.length > 0) {
    sections.push({ volume: null, chapters: unassigned });
  }
  for (const vol of volumes) {
    sections.push({ volume: vol, chapters: grouped.get(vol.id) || [] });
  }
  return sections;
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const workId = Number(searchParams.get("workId"));
    const action = searchParams.get("action") || "detail";

    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少合法的 workId" }, { status: 400 });
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限" }, { status: 404 });
    }

    if (action === "detail") {
      return NextResponse.json({
        success: true,
        result: { ...work, targetWords: work.expectedWords, coverUrl: work.cover },
      });
    }

    const chapterList = await db
      .select()
      .from(chapters)
      .where(eq(chapters.workId, workId))
      .orderBy(asc(chapters.chapterNumber), asc(chapters.createdAt))
      .all();

    const buildDisposition = (fileName: string, ext: string) =>
      `attachment; filename="export.${ext}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

    if (action === "export_json") {
      const [
        outlineList,
        charList,
        relationList,
        locList,
        factionList,
        itemList,
        ruleList,
        timelineList,
        timelineEventList,
        noteList,
        materialList,
        fragmentList,
        versionList,
        masterOutlineRow,
        analysisRows,
      ] = await Promise.all([
        db.select().from(outlines).where(eq(outlines.workId, workId)).all(),
        db.select().from(characters).where(eq(characters.workId, workId)).all(),
        db.select().from(characterRelations).where(eq(characterRelations.workId, workId)).all(),
        db.select().from(locations).where(eq(locations.workId, workId)).all(),
        db.select().from(factions).where(eq(factions.workId, workId)).all(),
        db.select().from(items).where(eq(items.workId, workId)).all(),
        db.select().from(worldRules).where(eq(worldRules.workId, workId)).all(),
        db.select().from(timelines).where(eq(timelines.workId, workId)).all(),
        db.select().from(timelineEvents).where(eq(timelineEvents.workId, workId)).all(),
        db.select().from(notes).where(eq(notes.workId, workId)).all(),
        db.select().from(materials).where(eq(materials.workId, workId)).all(),
        db.select().from(memoryFragments).where(and(eq(memoryFragments.workId, workId), eq(memoryFragments.userId, user.userId))).all(),
        db.select().from(chapterVersions).where(and(eq(chapterVersions.workId, workId), eq(chapterVersions.userId, user.userId))).all(),
        env.DB.prepare("SELECT * FROM work_master_outlines WHERE work_id = ? LIMIT 1").bind(workId).first().catch(() => null),
        env.DB.prepare("SELECT * FROM ai_analysis_reports WHERE work_id = ? AND user_id = ?").bind(workId, user.userId).all().then((r: any) => r?.results || []).catch(() => []),
      ]);

      return new NextResponse(
        JSON.stringify(
          {
            meta: { exportTime: new Date().toISOString(), version: "2.0.0" },
            work,
            masterOutline: masterOutlineRow || null,
            outlines: outlineList,
            chapters: chapterList,
            chapterVersions: versionList,
            characters: charList,
            characterRelations: relationList,
            locations: locList,
            factions: factionList,
            items: itemList,
            worldRules: ruleList,
            timelines: timelineList,
            timelineEvents: timelineEventList,
            notes: noteList,
            materials: materialList,
            memoryFragments: fragmentList,
            aiAnalysisReports: analysisRows,
          },
          null,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": buildDisposition(`${work.title}_全量备份.json`, "json"),
          },
        }
      );
    }

    const sections = buildVolumeOrderedSections(chapterList);

    if (action === "export_md") {
      let md = `# ${work.title}\n\n> 标签：${work.tag || "网络小说"} | 总字数：${work.wordCount || 0} 字\n\n`;
      if (work.description) md += `## 作品简介\n${work.description}\n\n---\n\n`;
      md += `## 正文章节\n\n`;
      for (const section of sections) {
        if (section.volume) {
          md += `## ${section.volume.title}\n\n`;
        }
        for (const ch of section.chapters) {
          md += `### 第 ${ch.chapterNumber} 章 ${ch.title}${ch.subtitle ? ` · ${ch.subtitle}` : ""}\n\n`;
          if (ch.summary) md += `> 【本章大纲要点】：${ch.summary}\n\n`;
          md += `${ch.content || "（暂无正文）"}\n\n---\n\n`;
        }
      }

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": buildDisposition(`${work.title}_全书稿.md`, "md"),
        },
      });
    }

    let txt = `《${work.title}》\n题材：${work.tag || "小说"} | 总字数：${work.wordCount || 0} 字\n`;
    if (work.description) txt += `\n【简介】\n${work.description}\n\n`;
    txt += `========================================\n\n`;
    for (const section of sections) {
      if (section.volume) {
        txt += `\n【${section.volume.title}】\n\n`;
      }
      for (const ch of section.chapters) {
        txt += `第 ${ch.chapterNumber} 章 ${ch.title}${ch.subtitle ? ` · ${ch.subtitle}` : ""}\n\n${ch.content || ""}\n\n\n`;
      }
    }

    return new NextResponse(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": buildDisposition(`${work.title}_全书稿.txt`, "txt"),
      },
    });
  } catch (err: any) {
    console.error("GET project/settings error:", err);
    return NextResponse.json({ success: false, message: "获取或导出项目失败" }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;
    const { id: rawId, title, tag, targetWords, expectedWords, expectedChapters, description, coverUrl, cover, status } = parsedBody.data;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的工程 id" }, { status: 400 });
    }

    const nextCover = cover !== undefined ? cover : coverUrl;
    if (nextCover && !isSafeUrl(nextCover)) {
      return NextResponse.json({ success: false, message: "非法的封面链接协议" }, { status: 400 });
    }

    const updatedData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updatedData.title = String(title).trim();
    if (tag !== undefined) updatedData.tag = tag;
    if (expectedWords !== undefined || targetWords !== undefined) {
      updatedData.expectedWords = Math.max(0, Number(expectedWords ?? targetWords) || 0);
    }
    if (expectedChapters !== undefined) {
      updatedData.expectedChapters = Math.max(1, Number(expectedChapters) || 100);
    }
    if (description !== undefined) updatedData.description = description;
    if (nextCover !== undefined) updatedData.cover = nextCover ? String(nextCover).trim() : null;
    if (status !== undefined) updatedData.status = status;

    await db.update(works).set(updatedData).where(and(eq(works.id, id), eq(works.userId, user.userId)));
    return NextResponse.json({ success: true, message: "保存项目设置成功" });
  } catch (err: any) {
    console.error("PUT project/settings error:", err);
    return NextResponse.json({ success: false, message: "更新项目设置失败" }, { status: 500 });
  }
});
