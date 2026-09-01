// API: 章节 AI 协同创作助手问答、多级上下文精准注入推演与对话记录管理
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters, chapterAiChats, characters, locations, factions, items, worldRules, outlines } from "@/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const chapterId = Number(searchParams.get("chapterId"));

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "chapterId 无效" }, { status: 400 });
    }

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS chapter_ai_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        chapter_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        action_type TEXT DEFAULT 'chat',
        selected_text TEXT,
        context_tags TEXT,
        applied INTEGER DEFAULT 0,
        created_at INTEGER
      )`);
    } catch (_) {}

    const chatList = await db.select().from(chapterAiChats).where(and(eq(chapterAiChats.chapterId, chapterId), eq(chapterAiChats.userId, user.userId))).orderBy(asc(chapterAiChats.createdAt)).all();

    return NextResponse.json({ success: true, result: chatList });
  } catch (error: any) {
    console.error("Get chapter AI chats error:", error);
    return NextResponse.json({ success: false, message: error?.message || "获取对话历史失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const workId = Number(body.workId);
    const chapterId = Number(body.chapterId);
    const userPrompt = String(body.prompt || "").trim();
    const actionType = String(body.actionType || "chat");
    const selectedText = String(body.selectedText || "").trim();
    const currentContent = String(body.currentContent || "");
    const contextTags: Array<{ id: string | number; name: string; type: string }> = Array.isArray(body.contextTags) ? body.contextTags : [];

    if (!workId || !chapterId) {
      return NextResponse.json({ success: false, message: "缺少 workId 或 chapterId" }, { status: 400 });
    }

    if (!userPrompt && !selectedText && actionType === "chat") {
      return NextResponse.json({ success: false, message: "提问指令或选中文本不能为空" }, { status: 400 });
    }

    const [work, chapter] = await Promise.all([
      db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get(),
      db.select().from(chapters).where(eq(chapters.id, chapterId)).get(),
    ]);

    if (!work || !chapter) {
      return NextResponse.json({ success: false, message: "作品或章节不存在" }, { status: 404 });
    }

    try {
      await db.run(`CREATE TABLE IF NOT EXISTS chapter_ai_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_id INTEGER NOT NULL,
        chapter_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        action_type TEXT DEFAULT 'chat',
        selected_text TEXT,
        context_tags TEXT,
        applied INTEGER DEFAULT 0,
        created_at INTEGER
      )`);
    } catch (_) {}

    const charIds = contextTags.filter((t) => t.type === "character").map((t) => Number(t.id)).filter(Boolean);
    const locIds = contextTags.filter((t) => t.type === "location").map((t) => Number(t.id)).filter(Boolean);
    const facIds = contextTags.filter((t) => t.type === "faction").map((t) => Number(t.id)).filter(Boolean);
    const itemIds = contextTags.filter((t) => t.type === "item").map((t) => Number(t.id)).filter(Boolean);
    const ruleIds = contextTags.filter((t) => t.type === "rule").map((t) => Number(t.id)).filter(Boolean);
    const outlineIds = contextTags.filter((t) => t.type === "outline").map((t) => String(t.id)).filter(Boolean);
    const otherChapterIds = contextTags.filter((t) => t.type === "chapter").map((t) => Number(t.id)).filter(Boolean);

    const [charsData, locsData, facsData, itemsData, rulesData, outlinesData, otherChaptersData] = await Promise.all([
      charIds.length > 0 ? db.select().from(characters).where(inArray(characters.id, charIds)).all() : [],
      locIds.length > 0 ? db.select().from(locations).where(inArray(locations.id, locIds)).all() : [],
      facIds.length > 0 ? db.select().from(factions).where(inArray(factions.id, facIds)).all() : [],
      itemIds.length > 0 ? db.select().from(items).where(inArray(items.id, itemIds)).all() : [],
      ruleIds.length > 0 ? db.select().from(worldRules).where(inArray(worldRules.id, ruleIds)).all() : [],
      outlineIds.length > 0 ? db.select().from(outlines).where(inArray(outlines.id, outlineIds)).all() : [],
      otherChapterIds.length > 0 ? db.select({ id: chapters.id, title: chapters.title, chapterNumber: chapters.chapterNumber, summary: chapters.summary }).from(chapters).where(inArray(chapters.id, otherChapterIds)).all() : [],
    ]);

    let structuredLoreContext = "";

    if (charsData.length > 0) {
      structuredLoreContext += "【关联人物设定】：\n" + charsData.map((c) => `- ${c.name} (${c.identity || c.roleType || "角色"}): 性格[${c.personality || "未知"}]，能力[${c.abilities || "无"}], 经历背景[${c.description || c.experiences || "无"}]`).join("\n") + "\n\n";
    }
    if (locsData.length > 0) {
      structuredLoreContext += "【关联地点设定】：\n" + locsData.map((l) => `- ${l.name} (${l.region || "区域"}): 类型[${l.type}], 特征[${l.features || l.climate || l.terrain || "无"}], 剧情关联[${l.plotPoints || "无"}]`).join("\n") + "\n\n";
    }
    if (facsData.length > 0) {
      structuredLoreContext += "【关联势力阵营】：\n" + facsData.map((f) => `- ${f.name}: 领袖[${f.leader || "未知"}], 立场[${f.alignment || "中立"}], 宗旨信条[${f.doctrine || "无"}]`).join("\n") + "\n\n";
    }
    if (itemsData.length > 0) {
      structuredLoreContext += "【关联法宝道具】：\n" + itemsData.map((i) => `- ${i.name} (${i.tier || "物品"}): 异能效果[${i.effects}], 使用代价/副作用[${i.drawbacks || "无"}]`).join("\n") + "\n\n";
    }
    if (rulesData.length > 0) {
      structuredLoreContext += "【关联世界法则/体系】：\n" + rulesData.map((r) => `- ${r.name}: 机制[${r.mechanisms || "无"}], 禁忌[${r.taboos || "无"}]`).join("\n") + "\n\n";
    }
    if (outlinesData.length > 0) {
      structuredLoreContext += "【关联故事大纲节拍】：\n" + outlinesData.map((o) => `- ${o.title}: 核心目标[${o.goal}], 关键冲突[${o.conflict || "无"}], 结果变化[${o.expectedOutcome || "无"}]`).join("\n") + "\n\n";
    }
    if (otherChaptersData.length > 0) {
      structuredLoreContext += "【其他关联章节提要】：\n" + otherChaptersData.map((ch) => `- 第${ch.chapterNumber}章 ${ch.title}: 提要[${ch.summary || "无"}]`).join("\n") + "\n\n";
    }

    let systemPrompt = `你是一位殿堂级网文金牌策划与白金作家协同助手，正在与作者共同打磨作品《${work.title}》（题材标签：${work.tag || "网络小说"}）。
当前章节：第${chapter.chapterNumber}章《${chapter.title}》${chapter.summary ? `（本章大纲摘要：${chapter.summary}）` : ""}。
你的职责是精准理解作者的创作诉求，结合提供的世界观人物设定进行逻辑严密、文笔出众、情节张力十足的协同推演与润色续写。
【核心要求】：直接输出最优质的建议或创作成果，避免冗余寒暄与无意义的打招呼。如果生成正文内容，请注重沉浸感与画面感。`;

    let finalUserMessage = "";

    if (structuredLoreContext) {
      finalUserMessage += `【当前关联世界观与人物知识库】：\n${structuredLoreContext}\n`;
    }

    if (selectedText) {
      finalUserMessage += `【作者在编辑器中选中的文本片段】：\n"""\n${selectedText}\n"""\n\n`;
    } else if (currentContent) {
      const recentText = currentContent.slice(-1200);
      finalUserMessage += `【当前章节前文参考（节选末尾）】：\n"""\n${recentText}\n"""\n\n`;
    }

    const actionNameMap: Record<string, string> = {
      polish: "智能润色",
      expand: "场景扩写",
      shorten: "精简缩写",
      continue: "情节续写",
      tone: "语气改写",
      critique: "逻辑纠错",
      chat: "创作问答",
    };
    const actionName = actionNameMap[actionType] || "协同创作";

    switch (actionType) {
      case "polish":
        finalUserMessage += `【协同指令 - 智能润色】：请对选中文本或当前场景进行专业文学润色，提升动词表现力与环境画面感，保持原意与角色语调。${userPrompt ? `作者具体要求：${userPrompt}` : ""}`;
        break;
      case "expand":
        finalUserMessage += `【协同指令 - 场景扩写】：请对选中文本或当前场景进行细节扩充，丰富角色的微表情、心理博弈、动作细节与感官描写，使场景更具张力。${userPrompt ? `作者具体要求：${userPrompt}` : ""}`;
        break;
      case "shorten":
        finalUserMessage += `【协同指令 - 精简缩写】：请精炼浓缩选中文本，剔除废话修饰，强化叙事节奏，使其凌厉紧凑。${userPrompt ? `作者具体要求：${userPrompt}` : ""}`;
        break;
      case "continue":
        finalUserMessage += `【协同指令 - 情节续写】：请结合前文剧情走向与关联设定，为当前章节顺畅续写接下来的高潮情节或对话推进（约 400~800 字）。${userPrompt ? `作者具体要求：${userPrompt}` : ""}`;
        break;
      case "tone":
        finalUserMessage += `【协同指令 - 语气改写】：请根据登场角色的性格特质与人设，重构对话与神态描写，使其更具辨识度与戏剧张力。${userPrompt ? `作者具体要求：${userPrompt}` : ""}`;
        break;
      case "critique":
        finalUserMessage += `【协同指令 - 逻辑纠错】：请结合上下文与世界观法则，严谨审查当前情节是否存在战力崩塌、逻辑漏洞、人设前后矛盾或伏笔冲突，并给出具体修正建议。${userPrompt ? `作者具体要求：${userPrompt}` : ""}`;
        break;
      case "chat":
      default:
        finalUserMessage += `【作者指令与问题】：\n${userPrompt || "请根据上述设定，对本章节的推进和细节给出专业构思与建议。"}`;
        break;
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: finalUserMessage },
    ];

    const rawAiResponse = await callCloudflareAi(env.AI, messages, {
      temperature: actionType === "critique" ? 0.4 : 0.75,
      maxTokens: 4096,
    });

    const aiContent = cleanNovelStoryText(rawAiResponse);

    if (!aiContent || !aiContent.trim()) {
      return NextResponse.json({ success: false, message: "AI 助手未能生成有效回复，请重试" }, { status: 500 });
    }

    let userMessageContent = "";
    if (actionType !== "chat") {
      if (selectedText) {
        userMessageContent = userPrompt
          ? `【${actionName}】${userPrompt}\n\n选中文本片段：\n"${selectedText}"`
          : `请对以下选中文本进行【${actionName}】：\n"${selectedText}"`;
      } else {
        userMessageContent = userPrompt
          ? `【${actionName}】${userPrompt}`
          : `请结合当前章节正文与世界观设定，执行【${actionName}】。`;
      }
    } else {
      if (selectedText) {
        userMessageContent = `${userPrompt || "针对选中文本提出构思："}\n\n【选中文本】：\n"${selectedText}"`;
      } else {
        userMessageContent = userPrompt || "请根据设定对本章节给出专业构思建议。";
      }
    }

    await db.insert(chapterAiChats).values({
      workId,
      chapterId,
      userId: user.userId,
      role: "user",
      content: userMessageContent,
      actionType,
      selectedText: selectedText || undefined,
      contextTags,
      applied: 0,
      createdAt: new Date(),
    }).run();

    const insertResult = await db.insert(chapterAiChats).values({
      workId,
      chapterId,
      userId: user.userId,
      role: "assistant",
      content: aiContent.trim(),
      actionType,
      selectedText: selectedText || undefined,
      contextTags,
      applied: 0,
      createdAt: new Date(),
    }).returning().get();

    return NextResponse.json({
      success: true,
      result: insertResult,
      message: "AI 协同推演完成",
    });
  } catch (error: any) {
    console.error("Chapter AI chat error:", error);
    return NextResponse.json({ success: false, message: error?.message || "AI 协同服务异常" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const id = Number(body.id);
    const applied = body.applied ? 1 : 0;

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.update(chapterAiChats).set({ applied }).where(and(eq(chapterAiChats.id, id), eq(chapterAiChats.userId, user.userId))).run();

    return NextResponse.json({ success: true, message: "更新采纳状态成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "更新状态异常" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(chapterAiChats).where(and(eq(chapterAiChats.id, id), eq(chapterAiChats.userId, user.userId))).run();

    return NextResponse.json({ success: true, message: "删除对话记录成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除对话异常" }, { status: 500 });
  }
});
