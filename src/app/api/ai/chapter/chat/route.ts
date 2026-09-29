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
    const outlineIds = contextTags.filter((t) => t.type === "outline").map((t) => Number(t.id)).filter((n) => !isNaN(n) && n > 0);
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
      structuredLoreContext += "【核心角色档案库（人物行为需符合其性格与当前状态，严防千人一面或无故崩人设）】：\n" + charsData.map((c) => `- ${c.name} (${c.identity || c.roleType || "角色"}): 性格[${c.personality || "未知"}], 能力[${c.abilities || "无"}], 口吻与经历[${c.description || c.experiences || "无"}]`).join("\n") + "\n\n";
    }
    if (locsData.length > 0) {
      structuredLoreContext += "【关联地点设定】：\n" + locsData.map((l) => `- ${l.name} (${l.region || "区域"}): 类型[${l.type}], 特征[${l.features || l.climate || l.terrain || "无"}], 剧情关联[${l.plotPoints || "无"}]`).join("\n") + "\n\n";
    }
    if (facsData.length > 0) {
      structuredLoreContext += "【关联势力阵营】：\n" + facsData.map((f) => `- ${f.name}: 领袖[${f.leader || "未知"}], 立场[${f.alignment || "中立"}], 宗旨信条[${f.doctrine || "无"}]`).join("\n") + "\n\n";
    }
    if (itemsData.length > 0) {
      structuredLoreContext += "【关联法宝道具】：\n" + itemsData.map((i) => `- ${i.name} (${i.tier || "物品"}): 效果[${i.effects}], 代价/限制[${i.drawbacks || "无"}]`).join("\n") + "\n\n";
    }
    if (rulesData.length > 0) {
      structuredLoreContext += "【关联世界法则/体系】：\n" + rulesData.map((r) => `- ${r.name}: 机制[${r.mechanisms || "无"}], 禁忌[${r.taboos || "无"}]`).join("\n") + "\n\n";
    }
    if (outlinesData.length > 0) {
      structuredLoreContext += "【关联故事大纲节拍】：\n" + outlinesData.map((o) => `- ${o.title}: 核心目标[${o.goal || "推进"}], 关键冲突[${o.conflict || "无"}], 预期结果[${o.expectedOutcome || "无"}]`).join("\n") + "\n\n";
    }
    if (otherChaptersData.length > 0) {
      structuredLoreContext += "【其他关联章节提要】：\n" + otherChaptersData.map((ch) => `- 第${ch.chapterNumber}章 ${ch.title}: 提要[${ch.summary || "无"}]`).join("\n") + "\n\n";
    }

    // 1. SYSTEM 层：确立中性协同助手身份、指令优先级与核心防脑补/人物一致性铁律
    const SYSTEM_PROMPT = `你是一名专业的小说 AI 协同创作助手，负责协助作者进行正文创作、润色、扩写、精简、续写、语气调整、剧情分析与创作问答。
你的首要目标不是替作者决定故事走向，而是在作者已有创作意图、作品设定和当前剧情事实基础上，提供准确、稳定、高度可控的协作。

【核心创作与设定原则】
1. 保持人物行为与对白符合已有设定与当前情境逻辑。
2. 保持世界观规则与力量体系严密一致。
3. 不擅自改变已经确定的剧情事实、人物关系、时间线和因果链条。
4. 【设定使用与禁止擅自补设定】：提供给你的设定资料为作品事实依据。禁止在没有依据的情况下擅自捏造重大背景历史、新增超规格能力/法宝或篡改人物立场；如需补充细节，采用“最小新增原则”，仅补充完成当前任务所必需的合规信息。
5. 【人物一致性判断】：结合角色性格、当前情绪、当前目标、立场、已知经历与当下场景压力综合判断，避免脸谱化套路。

【指令优先级】
当不同要求产生冲突时，严格按以下优先级执行：
1. 作者本次明确提出的具体要求（最高控制权）
2. 当前 action 对应的任务与模式要求
3. 当前作品已经确定的设定与剧情事实
4. 通用写作原则
注：作者要求若与已确定的世界观事实明显冲突，分析类任务应明确指出冲突，正文创作类任务应优先避免破坏既定因果。

【上下文优先级】
1. 作者本次明确要求 > 2. 当前选中文本 > 3. 当前章节正文 > 4. 相关角色/地点/势力/道具 > 5. 大纲节拍 > 6. 世界法则 > 7. 其他章节摘要。

【输出模式严格隔离】
- 【正文直出模式】(polish / expand / shorten / continue / tone):
  只输出最终正文文本，从首字直接输出到尾字。严禁输出任何思考过程、任务说明（如“好的，这是润色后的内容”）、修改对比或前后引导标记！
- 【分析审查模式】(critique / chat):
  条理清晰地输出分析、诊断或构思建议，使用结构化说明。除非作者明确要求生成正文，否则不得把分析内容伪装成小说正文输出。`;

    // 2. CONTEXT 层：组装上下文背景
    let contextMessage = `【作品基础信息】：书名《${work.title}》（题材：${work.tag || "网络小说"}）
当前章节：第${chapter.chapterNumber}章《${chapter.title}》${chapter.summary ? `（本章大纲摘要：${chapter.summary}）` : ""}\n\n`;

    if (structuredLoreContext) {
      contextMessage += `【作品事实与设定资料】：\n${structuredLoreContext}\n`;
    }

    const hasSelection = Boolean(selectedText && selectedText.trim());
    const isFullChapterAction = !hasSelection && Boolean(currentContent && currentContent.trim());

    if (hasSelection) {
      contextMessage += `【作者选中的目标文本片段】：\n"""\n${selectedText.trim()}\n"""\n\n`;
    } else if (isFullChapterAction) {
      contextMessage += `【当前章节正文内容】：\n"""\n${currentContent.trim()}\n"""\n\n`;
    }

    // 3. ACTION 层：各任务详细准则与模式隔离
    const isAnalysisMode = actionType === "critique" || actionType === "chat";

    const ACTION_PROMPTS: Record<string, string> = {
      polish: `【任务：普通润色】
目标：在严格保留原文信息密度、剧情事实、人物行为、核心情绪与整体语调的前提下提升文字表现力。
执行要点：
1. 重点优化：消灭语病、不自然表达、僵硬句式、生硬对白与节奏拖沓。
2. 只有确实能够提升阅读流畅感时才调整句式结构。
3. 禁止为了体现“文笔”而无意义地大幅增加剧情、擅自加戏、增加复杂心理或大段空洞环境描写。
4. 严格只输出润色后的纯正文。`,

      expand: `【任务：细节扩写】
目标：扩写已有内容，增强场景沉浸感，而非擅自续写新的剧情事件。
执行要点：
1. 允许增加：感官细节（视听光影）、具体肢体动作、人物心理暗流、微表情与自然对话细节。
2. 严厉禁止：改变事件结果、新增关键人物、新增重大设定、改变人物立场或时间线。
3. 严格只输出扩写后的纯正文。`,

      shorten: `【任务：精简去水】
目标：在保留核心剧情因果、人物性格与关键情绪转折的前提下，最大程度减少冗余。
执行要点：
1. 优先删除：重复信息、无效修饰词、套路化动作、重复心理描写与无关主线的环境堆砌。
2. 必须保留：关键事实信息、人物关系变化、核心对白与伏笔线索。
3. 只能减少，严禁为了所谓“提升文采”重新创作新内容。
4. 严格只输出精简后的纯正文。`,

      continue: `【任务：情节续写】
目标：承接当前正文最后一个有效叙事节点继续创作。
执行要点：
1. 保持叙事视角、时间顺序、人物当前状态、情绪与行文节奏。
2. 保持当前节奏：如果当前处于日常、过渡或铺垫阶段，应稳步推进，不得为了制造戏剧性而强行制造高潮冲突或突然空降新人物。
3. 结合人物当前动机与场景真实阻力推进故事。
4. 严格只输出续写的纯正文（约 500~1000 字）。`,

      tone: `【任务：语气与对白改写】
目标：调整人物说话语气与神态细节，强化角色鲜明辨识度与潜台词。
执行要点：
1. 结合角色性格、当前情绪、动机与与对方的关系进行微调。
2. 严禁为了突出刻板标签而扭曲原有剧情含义或造成 OOC。
3. 严格只输出改写后的纯正文。`,

      critique: `【任务：剧情审查（编辑诊断 + 示范改写建议）】
目标：以资深网文剧情主编视角，审查当前正文/划选片段是否存在逻辑漏洞、人设矛盾或节奏问题，并提供切实可行的修改建议以及一段可供作者直接参考/复制的示范修改文本。
审查维度：
一、逻辑自洽与战力/世界观设定冲突
二、人物行为动机与心理演进是否合理（是否突兀、OOC或沦为工具人）
三、叙事节奏、铺垫张力与前后伏笔衔接
输出格式规范（必须条理清晰）：
一、【问题诊断】
精准指出具体存在的情节矛盾、逻辑漏洞或节奏问题。
二、【修改思路与建议】
列出 1~2 个最符合主线逻辑的具体调整方案与情节补救方向。
三、【推荐参考改写文本（供作者自由复制采纳）】
提供一段结构完整、文学语感精炼且修复了上述问题的示范改写正文（约 200~500 字），作者可自由复制挑选替换。
注：若原文本逻辑通畅，客观陈述其亮点即可，并在第三部分提供进一步增强文学张力的进阶示范写法。`,

      chat: `【任务：创作问答与多方案构思】
目标：根据作者提出的问题或构思进行专业分析与推演。
执行要点：
1. 可提供多个合理的剧情推进方向，并分别列出各自的【优势】、【潜在风险】与【对后续剧情的影响】。
2. 语言清晰有条理，避免空泛套话，不伪装成小说正文。`,
    };

    const currentActionPrompt = ACTION_PROMPTS[actionType] || ACTION_PROMPTS.chat;

    // 4. AUTHOR REQUEST 层：作者本次明确指令包装
    let authorRequestMessage = "";
    if (userPrompt) {
      authorRequestMessage = `【作者本次明确要求（最高优先级）】：\n${userPrompt}\n`;
    }

    const finalUserContent = `${contextMessage}${currentActionPrompt}\n\n${authorRequestMessage}请依据上述系统原则与优先级执行处理：`;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: finalUserContent },
    ];

    const targetTemp = isAnalysisMode ? 0.35 : 0.70;
    const rawAiResponse = await callCloudflareAi(env.AI, messages, {
      temperature: targetTemp,
      maxTokens: 8192,
    });

    const aiContent = cleanNovelStoryText(rawAiResponse);

    if (!aiContent || !aiContent.trim()) {
      return NextResponse.json({ success: false, message: "AI 助手未能生成有效回复，请重试" }, { status: 500 });
    }

    const actionNameMap: Record<string, string> = {
      polish: "智能润色",
      expand: "场景扩写",
      shorten: "精简缩写",
      continue: "情节续写",
      tone: "语气改写",
      critique: "逻辑审查",
      chat: "创作问答",
    };
    const actionName = actionNameMap[actionType] || "协同创作";

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
