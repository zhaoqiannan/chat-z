// API: 章节 AI 协同创作助手问答、多级上下文精准注入推演与对话记录管理
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapters, chapterAiChats, characters, locations, factions, items, worldRules, outlines, materials } from "@/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText, cleanAnalysisText } from "@/utils/ai";

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const chapterId = Number(searchParams.get("chapterId"));

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "chapterId 无效" }, { status: 400 });
    }

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
      db.select().from(chapters).where(and(eq(chapters.id, chapterId), eq(chapters.workId, workId))).get(),
    ]);

    if (!work || !chapter) {
      return NextResponse.json({ success: false, message: "作品或章节不存在或无权访问" }, { status: 403 });
    }

    const charIds = contextTags.filter((t) => t.type === "character").map((t) => Number(t.id)).filter(Boolean);
    const locIds = contextTags.filter((t) => t.type === "location").map((t) => Number(t.id)).filter(Boolean);
    const facIds = contextTags.filter((t) => t.type === "faction").map((t) => Number(t.id)).filter(Boolean);
    const itemIds = contextTags.filter((t) => t.type === "item").map((t) => Number(t.id)).filter(Boolean);
    const ruleIds = contextTags.filter((t) => t.type === "rule").map((t) => Number(t.id)).filter(Boolean);
    const outlineIds = contextTags.filter((t) => t.type === "outline").map((t) => Number(t.id)).filter((n) => !isNaN(n) && n > 0);
    const otherChapterIds = contextTags.filter((t) => t.type === "chapter").map((t) => Number(t.id)).filter(Boolean);
    const materialIds = contextTags.filter((t) => t.type === "material").map((t) => Number(t.id)).filter(Boolean);

    // 所有标签查询均强制限定 eq(table.workId, workId)，彻底阻断跨租户上下文注入泄露
    const [charsData, locsData, facsData, itemsData, rulesData, outlinesData, otherChaptersData, materialsData] = await Promise.all([
      charIds.length > 0
        ? db.select().from(characters).where(and(eq(characters.workId, workId), inArray(characters.id, charIds))).all()
        : db.select().from(characters).where(eq(characters.workId, workId)).limit(10).all(),
      locIds.length > 0 ? db.select().from(locations).where(and(eq(locations.workId, workId), inArray(locations.id, locIds))).all() : [],
      facIds.length > 0 ? db.select().from(factions).where(and(eq(factions.workId, workId), inArray(factions.id, facIds))).all() : [],
      itemIds.length > 0 ? db.select().from(items).where(and(eq(items.workId, workId), inArray(items.id, itemIds))).all() : [],
      ruleIds.length > 0
        ? db.select().from(worldRules).where(and(eq(worldRules.workId, workId), inArray(worldRules.id, ruleIds))).all()
        : db.select().from(worldRules).where(eq(worldRules.workId, workId)).limit(6).all(),
      outlineIds.length > 0 ? db.select().from(outlines).where(and(eq(outlines.workId, workId), inArray(outlines.id, outlineIds))).all() : [],
      otherChapterIds.length > 0
        ? db
            .select({ id: chapters.id, title: chapters.title, subtitle: chapters.subtitle, chapterNumber: chapters.chapterNumber, summary: chapters.summary })
            .from(chapters)
            .where(and(eq(chapters.workId, workId), inArray(chapters.id, otherChapterIds)))
            .all()
        : [],
      materialIds.length > 0
        ? db.select().from(materials).where(and(eq(materials.workId, workId), inArray(materials.id, materialIds))).all()
        : db.select().from(materials).where(and(eq(materials.workId, workId), eq(materials.includeInAiContext, 1))).limit(6).all(),
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
      structuredLoreContext += "【其他关联章节提要】：\n" + otherChaptersData.map((ch) => `- ${ch.title || `第${ch.chapterNumber}章`}${ch.subtitle ? ` (${ch.subtitle})` : ""}: 提要[${ch.summary || "无"}]`).join("\n") + "\n\n";
    }
    if (materialsData.length > 0) {
      structuredLoreContext += "【关联素材资料库与作者设定笔记（写作需严格参考此资料，保持世界观与剧情设定一致）】：\n" + materialsData.map((m) => {
        const noteText = (m.content || "").replace(/<[^>]+>/g, "").trim().slice(0, 300);
        const loreText = (m.extractedLore || m.aiSummary || "").slice(0, 250);
        return `- 《${m.title}》: ${loreText ? `[设定要点: ${loreText}] ` : ""}${noteText ? `[重点笔记: ${noteText}]` : ""}`;
      }).join("\n") + "\n\n";
    }

    // 读取当前章节最近 6 条历史对话，对纯改写类长文压缩截断避免挤占多轮问答上下文
    const recentHistory = await db
      .select({ role: chapterAiChats.role, content: chapterAiChats.content, actionType: chapterAiChats.actionType })
      .from(chapterAiChats)
      .where(and(eq(chapterAiChats.chapterId, chapterId), eq(chapterAiChats.userId, user.userId)))
      .orderBy(desc(chapterAiChats.createdAt))
      .limit(6)
      .all();

    const historyMessages: ChatMessage[] = recentHistory
      .reverse()
      .filter((h) => h.role === "user" || h.role === "assistant")
      .map((h) => {
        const isDialogueAction = !h.actionType || h.actionType === "chat" || h.actionType === "critique" || h.actionType === "custom";
        const limit = h.role === "assistant" && !isDialogueAction ? 260 : 1000;
        const raw = String(h.content || "");
        return {
          role: h.role as "user" | "assistant",
          content: raw.length > limit ? `${raw.slice(0, limit)}…（前文已折叠）` : raw,
        };
      });

    // 1. SYSTEM 层：确立中性协同助手身份、指令优先级与核心防脑补/人物一致性铁律
    const SYSTEM_PROMPT = `你是一名专业的小说 AI 协同创作助手，协助作者进行正文润色、扩写、精简、续写、对白调整、局部改写、剧情审查与创作问答。

【核心铁律】
1. 忠于作品事实：提供的角色、地点、势力、道具、法则、大纲与素材均为既定事实，严禁擅自篡改人物立场、时间线、因果链或凭空捏造超规格设定。
2. 人物防 OOC：结合角色性格、当前情绪、目标与当下场景压力来写动作与对白，拒绝脸谱化。
3. 指令优先级：作者本次明确要求 > 当前任务模式 > 选中文本与前后文 > 作品设定资料 > 通用写作技巧。
4. 若作者要求与已有设定存在明显冲突：分析模式必须明确指出冲突；正文模式应在不破坏既定因果的前提下尽量满足。

【输出协议（严格隔离）】
- 正文直出模式（polish / expand / shorten / continue / tone）：只输出可直接替换或插入编辑器的纯小说正文，从第一个字到最后一个字均不得包含思考过程、开场白（如“好的”“以下是润色后的版本”）、修改说明或 Markdown 代码块。
- 自定义指令模式（custom）：若作者要求修改/重写/润色/扩写选中片段，直接输出修改后的纯正文；若作者是在提问或讨论，则条理清晰地直接回答。
- 分析问答模式（critique / chat）：使用清晰的分点结构直接作答，不伪装成小说正文（除非作者明确要求提供示范片段）。`;

    // 2. CONTEXT 层：组装上下文背景（划选局部文本时，同时提取前后文窗口防止断层）
    let contextMessage = `【作品信息】：《${work.title}》（题材：${work.tag || "小说"}）
当前章节：《${chapter.title || `第${chapter.chapterNumber}章`}${chapter.subtitle ? ` · ${chapter.subtitle}` : ""}》${chapter.summary ? `\n本章摘要：${chapter.summary}` : ""}\n\n`;

    if (structuredLoreContext) {
      contextMessage += `【作品设定资料】：\n${structuredLoreContext}\n`;
    }

    const hasSelection = Boolean(selectedText && selectedText.trim());
    const trimmedContent = currentContent.trim();
    const isFullChapterAction = !hasSelection && Boolean(trimmedContent);

    if (hasSelection) {
      const snippet = selectedText.trim();
      if (trimmedContent) {
        const idx = trimmedContent.indexOf(snippet);
        let surrounding = "";
        if (idx !== -1) {
          const before = trimmedContent.slice(Math.max(0, idx - 600), idx).trim();
          const after = trimmedContent.slice(idx + snippet.length, idx + snippet.length + 600).trim();
          if (before) surrounding += `[前文]\n${before}\n`;
          if (after) surrounding += `[后文]\n${after}\n`;
        } else {
          surrounding = trimmedContent.slice(0, 1200);
        }
        if (surrounding) {
          contextMessage += `【当前章节前后文参考（仅供衔接语境，严禁重复输出）】：\n"""\n${surrounding.trim()}\n"""\n\n`;
        }
      }
      contextMessage += `【作者选中的目标文本片段（本次任务聚焦于此）】：\n"""\n${snippet}\n"""\n\n`;
    } else if (isFullChapterAction) {
      let contentForPrompt = "";
      if (actionType === "continue") {
        contentForPrompt = trimmedContent.slice(-3000);
      } else if (actionType === "critique" && trimmedContent.length > 5000) {
        contentForPrompt = `${trimmedContent.slice(0, 3200)}\n\n……（中段略）……\n\n${trimmedContent.slice(-1800)}`;
      } else {
        contentForPrompt = trimmedContent.slice(0, 5000);
      }
      contextMessage += `【当前章节正文内容${trimmedContent.length > 5000 && actionType !== "continue" ? "（长章已按窗口节选）" : ""}】：\n"""\n${contentForPrompt}\n"""\n\n`;
    }

    // 3. ACTION 层：各任务详细准则与模式隔离
    const isAnalysisMode = actionType === "critique" || actionType === "chat";
    const isCustomMode = actionType === "custom";

    const ACTION_PROMPTS: Record<string, string> = {
      polish: `【任务：普通润色】
在保留原文事实、信息密度、人物行为与核心情绪的前提下，消除语病、重复与僵硬句式，提升流畅度与表现力。禁止擅自加戏或改写剧情走向。只输出润色后的纯正文。`,

      expand: `【任务：细节扩写】
基于已有内容补充合理的感官描写、微表情、肢体动作、心理暗流与对话细节，增强沉浸感。严禁引入新事件、新角色或改变事件结果。只输出扩写后的完整纯正文。`,

      shorten: `【任务：精简去水】
删减重复信息、无效修饰词与拖沓铺垫，保留所有关键事实、人物关系变化与伏笔，加快节奏。只删不增，只输出精简后的纯正文。`,

      continue: `【任务：情节续写】
紧接正文最后一个有效叙事节点自然续写（约 500~900 字）。严格延续当前叙事视角、时态、人物状态与场景节奏；用实时动作、对话与感官细节推进，严禁“很快”“转眼间”式快进概括，禁止滥用“嘴角勾起弧度”“空气仿佛凝固”“不禁/不由得”等 AI 套话与段尾说教总结；若处于日常/铺垫阶段则稳步推进，禁止强行空降冲突或机械降神。只输出续写部分的纯正文，不要重复前文。`,

      tone: `【任务：语气与对白改写】
依据角色档案与当下情境压力，打磨对话台词与神态细节，增强人物辨识度与潜台词，严防 OOC，不改变原剧情意图。只输出改写后的纯正文。`,

      custom: `【任务：自定义精准修改】
严格执行作者本次给出的具体指令。若指令是对选中片段的改写/润色/调整，只输出可直接替换选中片段的纯正文，不要包含前后文及多余解释；若指令是提问或探讨，则直接清晰作答。`,

      critique: `【任务：剧情与逻辑审查】
以资深剧情编辑视角，审查目标文本是否存在：1) 逻辑与世界观冲突；2) 人物动机不足或 OOC；3) 节奏拖沓或伏笔断裂。
请按以下三部分结构化输出（客观务实，没问题不要硬挑刺）：
一、【问题诊断】
二、【具体修改建议】
三、【参考改写示范】（约 200~400 字可直接参考的示范文本）`,

      chat: `【任务：创作问答与构思推演】
直接针对作者的问题结合作品设定与对话上下文作答。若涉及剧情走向建议，提供 2~3 个差异化方向，并简明列出各自的【优势】与【后续影响】。条理清晰，避免空泛套话。`,
    };

    const currentActionPrompt = ACTION_PROMPTS[actionType] || ACTION_PROMPTS.chat;

    // 4. AUTHOR REQUEST 层：作者本次明确指令包装
    const authorRequestMessage = userPrompt
      ? `【作者本次明确要求（最高优先级）】：\n${userPrompt}\n`
      : "";

    const finalUserContent = `${contextMessage}${currentActionPrompt}\n\n${authorRequestMessage}`;

    // 分析/问答/自定义模式携带近期对话历史实现真正的多轮记忆；纯正文一键操作保持干净单轮减少干扰
    const shouldIncludeHistory = isAnalysisMode || isCustomMode;
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(shouldIncludeHistory ? historyMessages : []),
      { role: "user", content: finalUserContent },
    ];

    const targetTemp = isAnalysisMode ? 0.4 : 0.7;
    const rawAiResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "creative",
      temperature: targetTemp,
      maxTokens: 8192,
    });

    // 关键修复：分析/问答/自定义模式使用轻度清洗，防止 Markdown 列表与总结被误删
    const aiContent =
      isAnalysisMode || isCustomMode
        ? cleanAnalysisText(rawAiResponse)
        : cleanNovelStoryText(rawAiResponse);

    if (!aiContent || !aiContent.trim()) {
      return NextResponse.json({ success: false, message: "AI 助手未能生成有效回复，请重试" }, { status: 500 });
    }

    const actionNameMap: Record<string, string> = {
      polish: "智能润色",
      expand: "场景扩写",
      shorten: "精简缩写",
      continue: "情节续写",
      tone: "语气改写",
      custom: "自定义修改",
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
