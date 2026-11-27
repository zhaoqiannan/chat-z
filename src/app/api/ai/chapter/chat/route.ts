// API: 章节 AI 协同创作助手问答、自动全维上下文注入推演、SSE 流式输出与对话记录管理
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import {
  getDb,
  works,
  chapters,
  chapterAiChats,
  outlines,
  memoryFragments,
} from "@/db";
import { eq, and, desc, asc, inArray, lt } from "drizzle-orm";
import {
  callCloudflareAi,
  callCloudflareAiStream,
  ChatMessage,
  cleanNovelStoryText,
  cleanAnalysisText,
} from "@/utils/ai";
import { parseJsonBody } from "@/utils/ownership";
import { buildWorldLoreContext } from "@/utils/worldContext";

export type ChapterAiApplyMode =
  | "replace_selection"
  | "insert_after_selection"
  | "replace_full_chapter"
  | "readonly";

const SUB_MODE_GUIDANCE: Record<string, Record<string, string>> = {
  polish: {
    light: "【润色档位：轻度顺句】仅修正语病、重复词、标点与生硬衔接，最大程度保留作者原始用词习惯与句子结构。",
    refined: "【润色档位：流畅精炼】优化句式节奏、动词精准度与语感张力，消除口水话与翻译腔，保持原剧情事实不变。",
    vivid: "【润色档位：强画面感】在不改变事实与不强加戏的前提下，把平淡概括句替换为更具镜头感与感官细节的动词与意象。",
  },
  expand: {
    general: "【扩写侧重：综合沉浸】均衡补充动作微细节、环境氛围与角色神态反应，字数约为原文的 1.8~2.5 倍。",
    action: "【扩写侧重：动作与镜头】拆解肢体动作、受力反馈、呼吸与空间走位，像电影分镜一样拉满现场感。",
    atmosphere: "【扩写侧重：环境与氛围】通过光影、气味、声响、温度与周边动静烘托压迫感或情绪基调，借景抒情。",
    psychology: "【扩写侧重：心理暗流】刻画角色表面克制与内心权衡之间的拉扯，用生理微反应与潜意识联想替代直白说教。",
    dialogue: "【扩写侧重：对话张力】增加言外之意、停顿、打断、反问与神态博弈，让每一句台词都有目的与锋芒。",
  },
  shorten: {
    tight: "【精简档位：紧凑提速】剔除冗余修饰与重复铺垫，保留全部关键信息与情绪转折，字数缩减至原文 60%~75%。",
    compact: "【精简档位：极简干练】去水留骨，仅保留推动剧情与人设的核心动作和关键对白，字数缩减至原文 40%~55%。",
  },
  tone: {
    cold: "【目标风格：冷峻克制】多用短句与白描，少用形容词与感叹号，以冷静旁观视角呈现残酷或锋利感。",
    suspense: "【目标风格：悬疑紧绷】控制信息释放节奏，强化异常细节、沉默留白与危机逼近的窒息感。",
    humor: "【目标风格：轻快诙谐】加入恰如其分的反差吐槽、机锋对白与生动生活气息，但严禁出戏玩烂梗。",
    lyrical: "【目标风格：细腻抒情】注重韵律、留白与触景生情的细腻情绪流动，文字温润克制而不矫情。",
    ancient: "【目标风格：古风雅致】贴合古典语境，遣词凝练含蓄、具金石气韵，避免生硬堆砌生僻字或现代口语。",
  },
  continue: {
    natural: "【续写方向：自然推进】紧贴当前场景与情绪惯性平稳展开下一拍动作与对白（约 500~800 字）。",
    twist: "【续写方向：制造意外反转】基于前文已有线索或角色利益冲突，引出一个情理之中、意料之外的局势变化（约 500~800 字），严禁机械降神。",
    hook: "【续写方向：收束并留钩子】稳步推进本段戏份，在结尾落在一个强悬念、新危机或耐人寻味的台词/细节钩子上（约 450~700 字）。",
  },
};

const ACTION_NAME_MAP: Record<string, string> = {
  polish: "一键润色",
  expand: "细节扩写",
  shorten: "精简提速",
  continue: "顺着往下写",
  tone: "换个味道",
  custom: "自定义修改",
  critique: "挑挑毛病",
  chat: "创作问答",
};

function resolveApplyMode(actionType: string, hasSelection: boolean): ChapterAiApplyMode {
  if (actionType === "critique" || actionType === "chat") return "readonly";
  if (actionType === "continue") return "insert_after_selection";
  if (actionType === "expand" && !hasSelection) return "insert_after_selection";
  return hasSelection ? "replace_selection" : "replace_full_chapter";
}

function extractSseChunkText(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed || trimmed === "[DONE]") return "";
  try {
    const parsed = JSON.parse(trimmed);
    const delta = parsed?.choices?.[0]?.delta;
    if (typeof delta?.content === "string") return delta.content;
    if (typeof parsed?.response === "string") return parsed.response;
    if (typeof parsed?.text === "string") return parsed.text;
    return "";
  } catch {
    return "";
  }
}

export const GET = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    const chapterId = Number(searchParams.get("chapterId"));

    if (!chapterId || isNaN(chapterId)) {
      return NextResponse.json({ success: false, message: "chapterId 无效" }, { status: 400 });
    }

    const chatList = await db
      .select()
      .from(chapterAiChats)
      .where(and(eq(chapterAiChats.chapterId, chapterId), eq(chapterAiChats.userId, user.userId)))
      .orderBy(asc(chapterAiChats.createdAt))
      .all();

    return NextResponse.json({ success: true, result: chatList });
  } catch (error: any) {
    console.error("Get chapter AI chats error:", error);
    return NextResponse.json({ success: false, message: "获取对话历史失败" }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const parsedBody = await parseJsonBody<Record<string, any>>(req);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;

    const workId = Number(body.workId);
    const chapterId = Number(body.chapterId);
    const userPrompt = String(body.prompt || "").trim().slice(0, 4000);
    const actionType = String(body.actionType || "chat");
    const subMode = typeof body.subMode === "string" ? body.subMode.trim() : "";
    const selectedText = String(body.selectedText || "").trim().slice(0, 8000);
    const currentContent = String(body.currentContent || "").slice(0, 40000);
    const wantStream = Boolean(body.stream);
    const contextTags: Array<{ id: string | number; name: string; type: string }> = Array.isArray(body.contextTags)
      ? body.contextTags.slice(0, 20)
      : [];

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

    const matchTargetText = `${selectedText}\n${currentContent}\n${userPrompt}`;

    // 一次并行查全自动设定上下文 + 手动关联标签（全部强制绑定 workId）
    const [
      worldLore,
      outlinesData,
      chapterOutlines,
      otherChaptersData,
      fragmentsData,
      prevChapter,
      recentHistory,
    ] = await Promise.all([
      buildWorldLoreContext(db, workId, matchTargetText, {
        includeTimeline: true,
        includeMaterials: true,
        maxChars: 3400,
        explicitIds: { charIds, locIds, facIds, itemIds, ruleIds, materialIds },
      }),
      outlineIds.length > 0
        ? db.select().from(outlines).where(and(eq(outlines.workId, workId), inArray(outlines.id, outlineIds))).all()
        : Promise.resolve([]),
      db.select().from(outlines).where(and(eq(outlines.workId, workId), eq(outlines.chapterId, chapterId))).all(),
      otherChapterIds.length > 0
        ? db
            .select({ id: chapters.id, title: chapters.title, subtitle: chapters.subtitle, chapterNumber: chapters.chapterNumber, summary: chapters.summary })
            .from(chapters)
            .where(and(eq(chapters.workId, workId), inArray(chapters.id, otherChapterIds)))
            .all()
        : Promise.resolve([]),
      db
        .select()
        .from(memoryFragments)
        .where(and(eq(memoryFragments.workId, workId), eq(memoryFragments.userId, user.userId)))
        .orderBy(desc(memoryFragments.createdAt))
        .limit(5)
        .all(),
      (chapter.chapterNumber ?? 0) > 1
        ? db
            .select({
              title: chapters.title,
              subtitle: chapters.subtitle,
              chapterNumber: chapters.chapterNumber,
              summary: chapters.summary,
              content: chapters.content,
            })
            .from(chapters)
            .where(and(eq(chapters.workId, workId), eq(chapters.isVolume, 0), lt(chapters.chapterNumber, chapter.chapterNumber ?? 1)))
            .orderBy(desc(chapters.chapterNumber))
            .limit(1)
            .get()
        : Promise.resolve(null),
      db
        .select({ role: chapterAiChats.role, content: chapterAiChats.content, actionType: chapterAiChats.actionType })
        .from(chapterAiChats)
        .where(and(eq(chapterAiChats.chapterId, chapterId), eq(chapterAiChats.userId, user.userId)))
        .orderBy(desc(chapterAiChats.createdAt))
        .limit(6)
        .all(),
    ]);

    // 合并本章大纲 + 手动关联大纲（去重）
    const mergedOutlineMap = new Map<number, (typeof chapterOutlines)[number]>();
    chapterOutlines.forEach((o) => mergedOutlineMap.set(o.id, o));
    outlinesData.forEach((o) => mergedOutlineMap.set(o.id, o));
    const mergedOutlines = Array.from(mergedOutlineMap.values());

    let structuredLoreContext = worldLore.text ? `${worldLore.text}\n\n` : "";

    if (mergedOutlines.length > 0) {
      structuredLoreContext +=
        "【本章及关联剧情大纲】：\n" +
        mergedOutlines
          .map((o) => {
            const eventText = o.event || o.summary || o.goal || "推进剧情";
            const twistText = o.twist || o.conflict || "";
            const nextText = o.nextGoal || o.expectedOutcome || "";
            const suspenseText = o.suspense || "";
            return `- ${o.title}: 核心事件[${eventText.slice(0, 160)}]${twistText ? ` | 转折冲突[${twistText.slice(0, 100)}]` : ""}${nextText ? ` | 推进目标[${nextText.slice(0, 100)}]` : ""}${suspenseText ? ` | 悬念伏笔[${suspenseText.slice(0, 100)}]` : ""}`;
          })
          .join("\n") +
        "\n\n";
    }
    if (otherChaptersData.length > 0) {
      structuredLoreContext +=
        "【其他关联章节提要】：\n" +
        otherChaptersData
          .map((ch) => `- ${ch.title || `第${ch.chapterNumber}章`}${ch.subtitle ? ` (${ch.subtitle})` : ""}: 提要[${ch.summary || "无"}]`)
          .join("\n") +
        "\n\n";
    }
    if (fragmentsData.length > 0 && (actionType === "continue" || actionType === "chat" || actionType === "expand")) {
      structuredLoreContext +=
        "【作者近期灵感/记忆碎片】：\n" +
        fragmentsData.map((f) => `- ${f.title}: ${f.content.slice(0, 140)}`).join("\n") +
        "\n\n";
    }

    const historyMessages: ChatMessage[] = recentHistory
      .reverse()
      .filter((h) => h.role === "user" || h.role === "assistant")
      .map((h) => {
        const isDialogueAction = !h.actionType || h.actionType === "chat" || h.actionType === "critique" || h.actionType === "custom";
        const limit = h.role === "assistant" && !isDialogueAction ? 260 : 900;
        const raw = String(h.content || "");
        return {
          role: h.role as "user" | "assistant",
          content: raw.length > limit ? `${raw.slice(0, limit)}…（前文已折叠）` : raw,
        };
      });

    const SYSTEM_PROMPT = `你是一名资深中文小说协同编辑与代笔搭档，协助作者完成局部润色、扩写、精简、风格改写、无缝续写、剧情审查与构思问答。

【核心铁律】
1. 忠于作品事实与承接：所有角色、关系、法则、大纲与前文结尾均为既定事实，严禁擅自改写人物立场、时间线或凭空引入机械降神设定。
2. 人物防 OOC：严格按角色性格、身份、当下处境写动作与对白，拒绝脸谱化与说教口吻。
3. 严禁 AI 味与套话（正文改写/续写模式强制生效）：禁止滥用“嘴角勾起一抹弧度/冷笑”“空气仿佛凝固”“瞳孔骤缩”“心中泛起涟漪”“不由得/不禁”“微微一怔”“这一刻”“命运的齿轮”“深吸一口气”“总之/由此可见”等 AI 腔模板；用具体动作、声音、感官与潜台词展示情绪，而非直接报幕情绪名。
4. 保持叙事一致性：严守原文的人称视角（第一/第三人称）、时态与中文全角标点习惯。
5. 指令优先级：作者本次明确要求 > 档位/子模式要求 > 任务模式 > 选中片段与前后文 > 作品设定资料。

【输出协议（严格隔离）】
- 正文直出模式（polish / expand / shorten / continue / tone）：只输出可直接替换或插入编辑器的纯小说正文，从第一个字到最后一个字均不得包含开场白（如“好的”“以下是润色后的版本”）、思考过程、修改说明、字数统计或 Markdown 代码块。
- 自定义指令模式（custom）：若作者要求修改/重写选中片段，只输出可直接替换的纯正文；若是在提问讨论，直接分点回答。
- 分析问答模式（critique / chat）：使用清晰分点直击要点，客观务实，不注水不硬挑刺。`;

    let contextMessage = `【作品信息】：《${work.title}》（题材：${work.tag || "小说"}）
当前章节：《${chapter.title || `第${chapter.chapterNumber}章`}${chapter.subtitle ? ` · ${chapter.subtitle}` : ""}》${chapter.summary ? `\n本章摘要：${chapter.summary}` : ""}\n\n`;

    if (prevChapter) {
      const prevTail = (prevChapter.content || "").trim().slice(-800);
      contextMessage += `【上一章承接参考（《${prevChapter.title || `第${prevChapter.chapterNumber}章`}》）】：\n${prevChapter.summary ? `上章提要：${prevChapter.summary}\n` : ""}${prevTail ? `上章结尾片段：\n"""\n${prevTail}\n"""\n` : ""}\n`;
    }

    if (structuredLoreContext) {
      contextMessage += `【作品设定资料】：\n${structuredLoreContext}`;
    }

    const hasSelection = Boolean(selectedText);
    const trimmedContent = currentContent.trim();
    const applyMode = resolveApplyMode(actionType, hasSelection);

    if (hasSelection) {
      if (trimmedContent) {
        const idx = trimmedContent.indexOf(selectedText);
        let surrounding = "";
        if (idx !== -1) {
          const before = trimmedContent.slice(Math.max(0, idx - 600), idx).trim();
          const after = trimmedContent.slice(idx + selectedText.length, idx + selectedText.length + 600).trim();
          if (before) surrounding += `[紧邻前文]\n${before}\n`;
          if (after) surrounding += `[紧邻后文]\n${after}\n`;
        } else {
          surrounding = trimmedContent.slice(0, 1200);
        }
        if (surrounding) {
          contextMessage += `【当前章节前后文参考（仅供衔接语境，严禁重复输出）】：\n"""\n${surrounding.trim()}\n"""\n\n`;
        }
      }
      contextMessage += `【作者选中的目标文本片段（本次任务聚焦于此）】：\n"""\n${selectedText}\n"""\n\n`;
    } else if (trimmedContent) {
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

    const isAnalysisMode = actionType === "critique" || actionType === "chat";
    const isCustomMode = actionType === "custom";

    const ACTION_PROMPTS: Record<string, string> = {
      polish: `【任务：智能润色】
在完整保留原文事实、信息量、人物行为与核心情绪的前提下，消除语病、重复、松散与 AI 腔，让句式更有张力与阅读节奏。禁止擅自改写剧情走向或胡乱加戏。只输出可直接替换原文的纯正文。`,

      expand: `【任务：细节扩写】
基于目标片段补充真实可信的感官细节、动作拆解、潜台词或环境衬托，拉满画面感与代入感。严禁引入新事件、新角色或改变原有结果。只输出扩写后的纯正文。`,

      shorten: `【任务：精简提速】
精准砍掉注水铺垫、重复信息与空泛修饰，保留所有关键事实、情绪转折与伏笔钩子，明显加快阅读节奏。只删不增，只输出精简后的纯正文。`,

      continue: `【任务：无缝续写】
紧接正文最后一个有效叙事节点自然往下写，无缝承接当前人称视角、场景位置、人物状态与上一章伏笔。用实时动作、对话与感官推进剧情，禁止“很快”“转眼间”式快进概括，禁止段尾说教总结。只输出新续写部分的纯正文，不要重复前文。`,

      tone: `【任务：换个味道 / 风格与对白重塑】
依据角色档案与目标风格，重写目标文本的遣词、句式节奏、对白口吻与神态细节，增强辨识度与情绪质感，不改变核心剧情事实。只输出改写后的纯正文。`,

      custom: `【任务：自定义精准修改】
严格执行作者本次给出的具体指令。若指令是对选中片段的改写/调整，只输出可直接替换选中片段的纯正文，不要包含前后文及解释；若指令是提问或探讨，则直接清晰作答。`,

      critique: `【任务：挑挑毛病 / 逻辑与节奏审查】
以资深网文主编视角审视目标文本，重点排查：1) 逻辑、时间线或世界观法则冲突；2) 人物动机不足或 OOC；3) 节奏拖沓、信息平淡或情绪断层。
按以下三部分简洁输出（没毛病别硬挑刺）：
一、【核心问题定位】（附原句要点）
二、【一针见血修改方案】
三、【示范改写参考】（150~350 字可直接参考的示范段落）`,

      chat: `【任务：创作问答与构思推演】
结合作品设定、本章上下文与对话历史直接作答。若涉及剧情走向建议，提供 2~3 个有明显差异的方案，并简明标出各自的【看点】与【后续影响】。`,
    };

    const currentActionPrompt = ACTION_PROMPTS[actionType] || ACTION_PROMPTS.chat;
    const subModePrompt = subMode && SUB_MODE_GUIDANCE[actionType]?.[subMode] ? `\n${SUB_MODE_GUIDANCE[actionType][subMode]}` : "";
    const authorRequestMessage = userPrompt ? `\n\n【作者本次明确要求（最高优先级）】：\n${userPrompt}` : "";
    const finalUserContent = `${contextMessage}${currentActionPrompt}${subModePrompt}${authorRequestMessage}`;

    const shouldIncludeHistory = isAnalysisMode || isCustomMode;
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(shouldIncludeHistory ? historyMessages : []),
      { role: "user", content: finalUserContent },
    ];

    const actionName = ACTION_NAME_MAP[actionType] || "协同创作";
    let userMessageContent = "";
    if (actionType !== "chat") {
      if (selectedText) {
        userMessageContent = userPrompt
          ? `【${actionName}】${userPrompt}`
          : `对选中片段执行【${actionName}】`;
      } else {
        userMessageContent = userPrompt
          ? `【${actionName}】${userPrompt}`
          : `结合当前章节与作品设定，执行【${actionName}】`;
      }
    } else {
      userMessageContent = userPrompt || (selectedText ? "针对选中片段提出构思建议" : "请结合设定对本章给出构思建议");
    }

    const persistTurn = async (rawOutput: string) => {
      const cleaned =
        isAnalysisMode || isCustomMode ? cleanAnalysisText(rawOutput) : cleanNovelStoryText(rawOutput);
      const finalContent = cleaned.trim();
      if (!finalContent) return null;

      await db
        .insert(chapterAiChats)
        .values({
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
        })
        .run();

      return db
        .insert(chapterAiChats)
        .values({
          workId,
          chapterId,
          userId: user.userId,
          role: "assistant",
          content: finalContent,
          actionType,
          selectedText: selectedText || undefined,
          contextTags,
          applied: 0,
          createdAt: new Date(),
        })
        .returning()
        .get();
    };

    const targetTemp = isAnalysisMode ? 0.4 : 0.72;

    if (wantStream) {
      const upstream = await callCloudflareAiStream(env.AI, messages, {
        taskType: "creative",
        temperature: targetTemp,
        maxTokens: 4096,
      });

      const encoder = new TextEncoder();
      const decoder = new TextDecoder("utf-8");

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = upstream.getReader();
          let buffer = "";
          let fullRaw = "";
          let inThinkTag = false;
          let visibleBuffer = "";

          const emitChunk = (piece: string) => {
            if (!piece) return;
            fullRaw += piece;

            // 流式过滤 <think>...</think>，不把思考链推送给用户正文预览
            visibleBuffer += piece;
            while (visibleBuffer.length > 0) {
              if (inThinkTag) {
                const endIdx = visibleBuffer.search(/<\/(?:think|thought)>/i);
                if (endIdx === -1) {
                  visibleBuffer = visibleBuffer.slice(-12);
                  break;
                }
                const closeMatch = visibleBuffer.slice(endIdx).match(/^<\/(?:think|thought)>/i);
                visibleBuffer = visibleBuffer.slice(endIdx + (closeMatch?.[0].length || 8));
                inThinkTag = false;
              } else {
                const startIdx = visibleBuffer.search(/<(?:think|thought)>/i);
                if (startIdx === -1) {
                  // 保留末尾可能半截的标签前缀
                  const safeLen = Math.max(0, visibleBuffer.length - 10);
                  if (safeLen > 0) {
                    const out = visibleBuffer.slice(0, safeLen);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: out })}\n\n`));
                    visibleBuffer = visibleBuffer.slice(safeLen);
                  }
                  break;
                }
                if (startIdx > 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: visibleBuffer.slice(0, startIdx) })}\n\n`));
                }
                const openMatch = visibleBuffer.slice(startIdx).match(/^<(?:think|thought)>/i);
                visibleBuffer = visibleBuffer.slice(startIdx + (openMatch?.[0].length || 7));
                inThinkTag = true;
              }
            }
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const piece = extractSseChunkText(trimmed.slice(5));
                if (piece) emitChunk(piece);
              }
            }

            if (buffer.trim().startsWith("data:")) {
              const piece = extractSseChunkText(buffer.trim().slice(5));
              if (piece) emitChunk(piece);
            }

            if (!inThinkTag && visibleBuffer) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: visibleBuffer })}\n\n`));
            }

            const savedRecord = await persistTurn(fullRaw);
            if (savedRecord) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true, result: savedRecord, applyMode })}\n\n`)
              );
            } else {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: "AI 助手未能生成有效回复，请重试" })}\n\n`)
              );
            }
          } catch (streamErr: any) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: streamErr?.message || "流式生成中断" })}\n\n`)
            );
          } finally {
            reader.releaseLock();
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const rawAiResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "creative",
      temperature: targetTemp,
      maxTokens: 4096,
    });

    const insertResult = await persistTurn(rawAiResponse);
    if (!insertResult) {
      return NextResponse.json({ success: false, message: "AI 助手未能生成有效回复，请重试" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result: insertResult,
      applyMode,
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

    const parsedBody = await parseJsonBody<{ id?: number | string; applied?: boolean }>(req);
    if (!parsedBody.ok) return parsedBody.response;
    const id = Number(parsedBody.data.id);
    const applied = parsedBody.data.applied ? 1 : 0;

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db
      .update(chapterAiChats)
      .set({ applied })
      .where(and(eq(chapterAiChats.id, id), eq(chapterAiChats.userId, user.userId)))
      .run();

    return NextResponse.json({ success: true, message: "更新采纳状态成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "更新状态异常" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      const parsedBody = await parseJsonBody<{ id?: number | string }>(req);
      if (parsedBody.ok) id = Number(parsedBody.data.id);
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, message: "无效的 id" }, { status: 400 });
    }

    await db
      .delete(chapterAiChats)
      .where(and(eq(chapterAiChats.id, id), eq(chapterAiChats.userId, user.userId)))
      .run();

    return NextResponse.json({ success: true, message: "删除对话记录成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "删除对话异常" }, { status: 500 });
  }
});
