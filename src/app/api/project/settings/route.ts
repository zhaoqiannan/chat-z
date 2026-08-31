import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters, outlines, characters, locations, factions, items, worldRules } from "@/db";
import { eq, and, asc } from "drizzle-orm";

/**
 * 获取项目详情与全本导出数据 (GET)
 * action: 'detail' | 'export_json' | 'export_txt' | 'export_md'
 */
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
        result: work,
      });
    }

    // 全量导出模式：聚合大纲、章节正文与世界观数据
    const chapterList = await db
      .select()
      .from(chapters)
      .where(eq(chapters.workId, workId))
      .orderBy(asc(chapters.chapterNumber), asc(chapters.createdAt))
      .all();

    const outlineList = await db
      .select()
      .from(outlines)
      .where(eq(outlines.workId, workId))
      .all();

    const charList = await db
      .select()
      .from(characters)
      .where(eq(characters.workId, workId))
      .all();

    const locList = await db
      .select()
      .from(locations)
      .where(eq(locations.workId, workId))
      .all();

    const factionList = await db
      .select()
      .from(factions)
      .where(eq(factions.workId, workId))
      .all();

    const itemList = await db
      .select()
      .from(items)
      .where(eq(items.workId, workId))
      .all();

    const ruleList = await db
      .select()
      .from(worldRules)
      .where(eq(worldRules.workId, workId))
      .all();

    // 1. JSON 全量备份导出
    if (action === "export_json") {
      const fullBackup = {
        meta: {
          exportTime: new Date().toISOString(),
          version: "1.0.0",
        },
        work,
        outlines: outlineList,
        chapters: chapterList,
        characters: charList,
        locations: locList,
        factions: factionList,
        items: itemList,
        worldRules: ruleList,
      };

      return new NextResponse(JSON.stringify(fullBackup, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(work.title)}_全量备份.json"`,
        },
      });
    }

    // 2. Markdown 全书整合导出
    if (action === "export_md") {
      let md = `# ${work.title}\n\n`;
      md += `> 标签：${work.tag || "网络小说"} | 总字数：${work.wordCount || 0} 字\n\n`;
      if (work.description) {
        md += `## 作品简介\n${work.description}\n\n---\n\n`;
      }

      md += `## 正文章节\n\n`;
      for (const ch of chapterList) {
        if (ch.isVolume) {
          md += `# ${ch.title}\n\n`;
        } else {
          md += `### 第 ${ch.chapterNumber} 章 ${ch.title}${ch.subtitle ? ` · ${ch.subtitle}` : ""}\n\n`;
          if (ch.summary) {
            md += `> 【本章大纲要点】：${ch.summary}\n\n`;
          }
          md += `${ch.content || "（暂无正文）"}\n\n---\n\n`;
        }
      }

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(work.title)}_全书稿.md"`,
        },
      });
    }

    // 3. 纯文本 TXT 导出
    let txt = `《${work.title}》\n`;
    txt += `题材：${work.tag || "小说"} | 总字数：${work.wordCount || 0} 字\n`;
    if (work.description) {
      txt += `\n【简介】\n${work.description}\n\n`;
    }
    txt += `========================================\n\n`;

    for (const ch of chapterList) {
      if (ch.isVolume) {
        txt += `\n【${ch.title}】\n\n`;
      } else {
        txt += `第 ${ch.chapterNumber} 章 ${ch.title}${ch.subtitle ? ` · ${ch.subtitle}` : ""}\n\n`;
        txt += `${ch.content || ""}\n\n\n`;
      }
    }

    return new NextResponse(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(work.title)}_全书稿.txt"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "导出失败" }, { status: 500 });
  }
});

/**
 * 更新项目设置 (PUT)
 */
export const PUT = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const { id: rawId, title, tag, targetWords, description, coverUrl, status } = body;
    const id = Number(rawId);

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的工程 id" }, { status: 400 });
    }

    const updatedData: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updatedData.title = title.trim();
    if (tag !== undefined) updatedData.tag = tag;
    if (targetWords !== undefined) updatedData.targetWords = Number(targetWords) || 0;
    if (description !== undefined) updatedData.description = description;
    if (coverUrl !== undefined) updatedData.coverUrl = coverUrl;
    if (status !== undefined) updatedData.status = status;

    await db.update(works).set(updatedData).where(and(eq(works.id, id), eq(works.userId, user.userId)));

    return NextResponse.json({
      success: true,
      message: "保存项目设置成功",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "更新项目设置失败" }, { status: 500 });
  }
});
