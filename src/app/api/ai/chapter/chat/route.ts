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
    } catch (_) { }

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
    } catch (_) { }

    const charIds = contextTags.filter((t) => t.type === "character").map((t) => Number(t.id)).filter(Boolean);
    const locIds = contextTags.filter((t) => t.type === "location").map((t) => Number(t.id)).filter(Boolean);
    const facIds = contextTags.filter((t) => t.type === "faction").map((t) => Number(t.id)).filter(Boolean);
    const itemIds = contextTags.filter((t) => t.type === "item").map((t) => Number(t.id)).filter(Boolean);
    const ruleIds = contextTags.filter((t) => t.type === "rule").map((t) => Number(t.id)).filter(Boolean);
    const outlineIds = contextTags.filter((t) => t.type === "outline").map((t) => String(t.id)).filter(Boolean);
    const otherChapterIds = contextTags.filter((t) => t.type === "chapter").map((t) => Number(t.id)).filter(Boolean);

    const [charsData, locsData, facsData, itemsData, rulesData, outlinesData, otherChaptersData] = await Promise.all([
      charIds.length > 0
        ? db.select().from(characters).where(inArray(characters.id, charIds)).all()
        : db.select().from(characters).where(eq(characters.workId, workId)).limit(10).all(),
      locIds.length > 0 ? db.select().from(locations).where(inArray(locations.id, locIds)).all() : [],
      facIds.length > 0 ? db.select().from(factions).where(inArray(factions.id, facIds)).all() : [],
      itemIds.length > 0 ? db.select().from(items).where(inArray(items.id, itemIds)).all() : [],
      ruleIds.length > 0
        ? db.select().from(worldRules).where(inArray(worldRules.id, ruleIds)).all()
        : db.select().from(worldRules).where(eq(worldRules.workId, workId)).limit(6).all(),
      outlineIds.length > 0 ? db.select().from(outlines).where(inArray(outlines.id, outlineIds)).all() : [],
      otherChapterIds.length > 0 ? db.select({ id: chapters.id, title: chapters.title, chapterNumber: chapters.chapterNumber, summary: chapters.summary }).from(chapters).where(inArray(chapters.id, otherChapterIds)).all() : [],
    ]);

    let structuredLoreContext = "";

    if (charsData.length > 0) {
      structuredLoreContext += "【核心角色人设与说话风格库（防OOC基准）】：\n" + charsData.map((c) => `- ${c.name} (${c.identity || c.roleType || "角色"}): 性格特质[${c.personality || "未知"}]，核心能力[${c.abilities || "无"}], 说话口吻与经历[${c.description || c.experiences || "无"}]`).join("\n") + "\n\n";
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

    let systemPrompt = `你是一位顶尖的网文白金作家与金牌主编协同助手，正在与作者共同打磨小说《${work.title}》（题材：${work.tag || "网络小说"}）。
当前章节：第${chapter.chapterNumber}章《${chapter.title}》${chapter.summary ? `（本章大纲摘要：${chapter.summary}）` : ""}。

【网文白金级创作与润色核心铁律（必须严格执行）】：
1. 【拒绝机械复读，实质升级文笔】：润色不是简单的校对或原样抄写！必须深入重构平铺直叙、干瘪寡淡的语句，将其转化为充满画面感、节奏快慢相宜、情绪张力饱满的优质网文正文。
2. 【人设严格锚定（绝对防 OOC）】：必须严格依照角色人设库中的性格与说话口吻写作。冷酷者言简意赅字字如刀，桀骜者狂放不羁傲骨毕露，智谋者机锋暗藏语带双关。严禁千人一面，严禁任何角色说出出戏的现代网络流行语或崩人设的软弱/客套台词！
3. 【四维具象化笔法】：
   - 动作描写具象有力：用高表现力的精准动词替代“他很愤怒地打过去”等空洞表述；
   - 感官与氛围沉浸：融合光影、音效、气流、压迫感等环境烘托；
   - 微表情与心理暗流：强化人物对峙时的眼神交锋与心理博弈；
   - 节奏凌厉：短句造势强化冲击力，长句铺陈增强厚重感，消除“只见”、“突然”、“紧接着”等平庸口癖。
4. 【作者内嵌批注精准转化】：若正文中出现 '( )' 或 '（ ）' 括号内容（如“（这里补充一段对峙对话）”、“（主角眼神变冷，拔剑）”），此为作者的具体修改指令，必须将其精准化为自然生动的正文描写，并剔除括号标记。
5. 【纯正文直出，严禁任何废话】：执行正文润色、扩写、续写或改写时，第一行第一个字必须是正文开头，最后一个字必须是正文结尾！绝对禁止输出任何思考过程、任务说明（如“任务：...”、“让我们构思...”）、前后引导语（如“以下是润色后的内容：”）或“【润色版】”等标记！`;

    let finalUserMessage = "";

    if (structuredLoreContext) {
      finalUserMessage += `【本作品核心设定与角色档案库】：\n${structuredLoreContext}\n`;
    }

    const hasSelection = Boolean(selectedText && selectedText.trim());
    const isFullChapterAction = !hasSelection && Boolean(currentContent && currentContent.trim());

    if (hasSelection) {
      finalUserMessage += `【作者划选的目标文本片段】：\n"""\n${selectedText.trim()}\n"""\n\n`;
    } else if (isFullChapterAction) {
      finalUserMessage += `【当前章节完整正文内容】：\n"""\n${currentContent.trim()}\n"""\n\n`;
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
        if (hasSelection) {
          finalUserMessage += `【最高执行指令：划选文本深度润色升级】
请对上述【作者划选的目标文本片段】进行白金级文学精修与深度重塑。
【核心要求】：
1. 坚决避免机械复读！请运用高级叙事笔法，大幅提升动作力量感、环境氛围与心理描写层次。
2. 严守角色性格基调，人物对白与行为严防 OOC。
3. 保持原有情节脉络与因果逻辑，使阅读体验更加扣人心弦。
${userPrompt ? `作者定制要求：${userPrompt}\n` : ""}
【输出铁律】：只输出润色后的纯正文片段，直接从第一个字开始，严禁任何分析说明或前后缀！`;
        } else {
          finalUserMessage += `【最高执行指令：全篇章节通篇文学润色重塑】
请对上述【当前章节完整正文内容】逐段进行白金级文笔精修与戏剧张力升级。
【核心要求】：
1. 坚决避免原样抄写！重构平淡流水账段落，增强感官沉浸感与情绪爆发力。
2. 严格锁定登场人物人设，台词交锋言如其人，严防人物 OOC。
3. 保持情节完整无损，逐段升华，严禁中途截断或省略。
${userPrompt ? `作者定制要求：${userPrompt}\n` : ""}
【输出铁律】：完整输出润色后的全章纯正文，直接从第一句到最后一句，严禁任何前言后语！`;
        }
        break;

      case "expand":
        if (hasSelection) {
          finalUserMessage += `【指令：划选文本深度场景扩写】
请对上述【划选目标文本】进行深度细节扩写，补充人物微表情、感官沉浸、肢体动作与心理博弈。
${userPrompt ? `作者额外要求：${userPrompt}\n` : ""}
【输出铁律】：只输出扩写后的纯正文文本，严禁包含任何思考过程或解释。`;
        } else {
          finalUserMessage += `【指令：核心场景深度扩写】
请结合当前章节的高潮或核心场景进行深度细节扩充，丰富动作与心理活动描写。
${userPrompt ? `作者额外要求：${userPrompt}\n` : ""}
【输出铁律】：只输出扩写后的纯正文文本，严禁包含任何思考过程或解释。`;
        }
        break;

      case "shorten":
        if (hasSelection) {
          finalUserMessage += `【指令：选中文本精简缩写】
请精炼浓缩上述【选中文本片段】，剔除废话赘词，加快叙事节奏，使其干练紧凑。
${userPrompt ? `作者额外要求：${userPrompt}\n` : ""}
【输出铁律】：只输出精简后的纯正文文本，严禁包含任何思考分析或说明。`;
        } else {
          finalUserMessage += `【指令：全篇内容精简去水】
请对上述【当前章节完整正文内容】进行通篇紧凑精简与去水，强化主线推进。
${userPrompt ? `作者额外要求：${userPrompt}\n` : ""}
【输出铁律】：只输出精简后的完整正文，严禁包含任何思考分析或说明。`;
        }
        break;

      case "continue":
        finalUserMessage += `【指令：章节情节顺畅续写】
请根据已有剧情走向与世界观设定，承接前文顺畅续写接下来的故事高潮或对话推进（约 500~1000 字）。
${userPrompt ? `作者额外要求：${userPrompt}\n` : ""}
【输出铁律】：只输出续写的纯正文故事文本，严禁包含任何前缀引导语或构思分析。`;
        break;

      case "tone":
        finalUserMessage += `【指令：角色语气与对白改写（防 OOC）】
请根据登场角色的性格特质与人设定位，重构上述文本中的对话与神态描写，增强个性辨识度与戏剧冲突。
${userPrompt ? `作者额外要求：${userPrompt}\n` : ""}
【输出铁律】：只输出改写后的纯正文文本，严禁包含任何思考过程或分析。`;
        break;

      case "critique":
        finalUserMessage += `【指令：剧情逻辑严谨纠错】
请结合当前章节与世界观设定，严谨审查当前情节是否存在战力崩塌、逻辑漏洞、人设前后矛盾或伏笔冲突，并给出具体可行的修正建议。
${userPrompt ? `作者具体问题：${userPrompt}\n` : ""}
【输出要求】：条理清晰地直接列出纠错点与修改建议，无需多余寒暄。`;
        break;

      case "chat":
      default:
        finalUserMessage += `【作者创作指令/提问】：
${userPrompt || "请结合上述设定与当前章节正文，给出专业的推演构思与创作建议。"}
【输出要求】：直接给出有深度的专业构思与建议，避免无意义的客套废话与元思考过程。`;
        break;
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: finalUserMessage },
    ];

    const targetTemp = actionType === "critique" ? 0.3 : 0.70;
    const rawAiResponse = await callCloudflareAi(env.AI, messages, {
      temperature: targetTemp,
      maxTokens: 8192,
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
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      try {
        const body = await req.json();
        id = Number(body?.id);
      } catch (_) { }
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db.delete(chapterAiChats).where(and(eq(chapterAiChats.id, id), eq(chapterAiChats.userId, user.userId))).run();

    return NextResponse.json({ success: true, message: "删除对话记录成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "删除对话异常" }, { status: 500 });
  }
});
