import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapterAiHistory, characters as dbCharacters, worldRules as dbWorldRules } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

/**
 * AI 章节初稿生成与正文润色优化接口 (基于 Cloudflare Workers AI，带历史归档与思考链纯化)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      chapterId: rawChapterId,
      mode, // 'draft' (生成初稿) | 'optimize' (润色优化) | 'selection_ai' (局部改写)
      // 初稿参数
      overview,
      events,
      plotDirection,
      characters,
      writingStyle,
      targetWords,
      // 优化参数
      currentContent,
      optimizeGoal,
    } = body;

    const workId = Number(body.workId);
    const chapterId = rawChapterId ? Number(rawChapterId) : 0;

    if (!workId || isNaN(workId)) {
      return NextResponse.json(
        { success: false, message: "无效的 workId" },
        { status: 400 }
      );
    }

    const work = await db
      .select()
      .from(works)
      .where(and(eq(works.id, workId), eq(works.userId, user.userId)))
      .get();

    if (!work) {
      return NextResponse.json(
        { success: false, message: "作品不存在或无权限" },
        { status: 404 }
      );
    }

    // 1. 生成初稿模式 (Draft) - 调用真实大模型创作
    if (mode === "draft") {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `你是一名专业的小说 AI 协同创作助手。
你的任务是根据作者提供的大纲概括、事件规划、人物性格与文风要求，撰写出情节自然连贯、人物符合设定、节奏适宜的正文章节。
【执行铁律】：
1. 严格忠于作者给出的事件安排与文风基准，不擅自修改既定设定。
2. 保持叙事视角与逻辑严密，严禁输出任何构思草稿、分析或引导语，直接从第一句正文输出到最后一句！`,
        },
        {
          role: "user",
          content: `作品书名：《${work.title}》
题材标签：${work.tag || "网络小说"}
本章大致内容：${overview || "推进核心主线"}
核心事件安排：${events || "按大纲事件展开"}
剧情走向与预期节点：${plotDirection || "自然推进至目标节点"}
登场人物与性格：${characters || "登场核心人物"}
文风选择：${writingStyle || "流畅通俗"}
目标字数要求：约 ${targetWords || 2000} 字

请直接开始输出该章节正文故事：`,
        },
      ];

      const rawDraftText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.75,
        maxTokens: 8192,
      });

      // 智能纯净化正文，剥离大模型思考废话
      const draftText = cleanNovelStoryText(rawDraftText);

      if (!draftText || !draftText.trim()) {
        return NextResponse.json(
          { success: false, message: "AI 初稿创作失败，未能获取到有效正文" },
          { status: 500 }
        );
      }

      const wordCount = draftText.trim().replace(/\s+/g, "").length;

      // 自动归档至 chapterAiHistory 历史记录表
      if (chapterId > 0) {
        try {
          await db.insert(chapterAiHistory).values({
            workId,
            chapterId,
            mode: "draft",
            title: `AI 初稿生成 (${wordCount} 字)`,
            promptSummary: overview || events || "根据剧情大纲生成正文",
            content: draftText.trim(),
            wordCount,
            createdAt: new Date(),
          }).run();
        } catch (histErr) {
          console.warn("保存章节 AI 初稿历史记录失败:", histErr);
        }
      }

      return NextResponse.json({
        success: true,
        result: {
          draftText: draftText.trim(),
          wordCount,
        },
        message: "AI 初稿生成成功！",
      });
    }

    // 2. 润色优化模式 (Optimize) - 调用真实大模型润色
    if (mode === "optimize") {
      const original = currentContent || "";
      if (!original.trim()) {
        return NextResponse.json(
          { success: false, message: "待优化的现有文章内容不能为空" },
          { status: 400 }
        );
      }

      const [workChars, workRules] = await Promise.all([
        db.select().from(dbCharacters).where(eq(dbCharacters.workId, workId)).limit(10).all(),
        db.select().from(dbWorldRules).where(eq(dbWorldRules.workId, workId)).limit(6).all(),
      ]);

      let loreContext = "";
      if (workChars.length > 0) {
        loreContext += "【核心角色档案与性格基准（严防 OOC）】：\n" + workChars.map((c) => `- ${c.name} (${c.identity || c.roleType || "角色"}): 性格特质[${c.personality || "未知"}], 能力[${c.abilities || "无"}], 说话口吻[${c.description || c.experiences || "无"}]`).join("\n") + "\n\n";
      }
      if (workRules.length > 0) {
        loreContext += "【世界观法则与修炼体系】：\n" + workRules.map((r) => `- ${r.name}: 机制[${r.mechanisms || "无"}]`).join("\n") + "\n\n";
      }

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `你是一名专业的小说 AI 协同修文助手。
你的核心职责是对作者提交的原文章节进行【高质量文学润色与语病修饰】。

【核心润色准则】：
1. 【忠于原文骨架与信息密度】：严格保留原作者的核心情节走向、因果链条、人物关系与事件事实，通篇完整输出所有润色后的段落，严禁中途截断、省略或打省略号。
2. 【消灭语病与表达僵硬】：深入优化平铺直叙、重复累赘的语句，使叙述生动准确、句式通顺自然。禁止为了体现所谓文采而擅自强行加戏或无依据脑补设定。
3. 【人物人设严格锁定（防 OOC）】：严格依照角色档案库中的性格基调与说话风格进行对白修润，言如其人，严防千人一面。
4. 【纯正文直出】：第一字即为正文首字，尾字即为正文尾字！严禁输出任何思考过程、任务分析、修改说明或前后缀标记！`,
        },
        {
          role: "user",
          content: `作品：《${work.title}》（题材：${work.tag || "网络小说"}）
${loreContext ? `${loreContext}\n` : ""}润色优化目标：${optimizeGoal || "在保持原剧情脉络与角色人设的前提下，优化干瘪病句，增强语言流畅度与画面感，消除重复赘述"}

【作者原始正文如下】：
${original}

【输出指令】：请严格依照上述准则逐段进行高质量文学润色，直接输出润色后的纯正文全文：`,
        },
      ];

      const rawOptimizedText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.65,
        maxTokens: 8192,
      });

      const optimizedText = cleanNovelStoryText(rawOptimizedText);

      if (!optimizedText || !optimizedText.trim()) {
        return NextResponse.json(
          { success: false, message: "AI 正文润色失败，未能获取到优化内容" },
          { status: 500 }
        );
      }

      const wordCount = optimizedText.trim().replace(/\s+/g, "").length;

      // 归档润色历史
      if (chapterId > 0) {
        try {
          await db.insert(chapterAiHistory).values({
            workId,
            chapterId,
            mode: "optimize",
            title: `全文润色优化 (${wordCount} 字)`,
            promptSummary: optimizeGoal || "全文语言流畅度与画面感润色",
            content: optimizedText.trim(),
            wordCount,
            createdAt: new Date(),
          }).run();
        } catch (histErr) {
          console.warn("保存章节 AI 润色历史记录失败:", histErr);
        }
      }

      return NextResponse.json({
        success: true,
        result: {
          optimizedText: optimizedText.trim(),
          wordCount,
        },
        message: "AI 润色优化完成！",
      });
    }

    // 3. 划选文本局部 AI 创作与润色 (Selection AI)
    if (mode === "selection_ai") {
      const selectedText = body.selectedText || "";
      const actionType = body.actionType || "polish"; // polish | expand | shorten | enrich_desc | dialogue | custom
      const customInstruction = body.customInstruction || "";
      const fullContext = body.fullContext || "";

      if (!selectedText.trim()) {
        return NextResponse.json(
          { success: false, message: "划选的待处理文本不能为空" },
          { status: 400 }
        );
      }

      const [workChars] = await Promise.all([
        db.select().from(dbCharacters).where(eq(dbCharacters.workId, workId)).limit(8).all(),
      ]);

      let charInfo = "";
      if (workChars.length > 0) {
        charInfo = "【核心角色性格（严防 OOC）】：\n" + workChars.map((c) => `- ${c.name}: 性格[${c.personality || "未知"}], 口吻[${c.description || "未知"}]`).join("\n") + "\n\n";
      }

      let systemPrompt = "你是一名专业的小说 AI 协同修文助手。请针对作者在正文中划选的片段进行精准的文字优化。【铁律】：保持人物性格一致防 OOC！不擅自更改事实！只输出处理后的纯正文片段，绝对禁止输出任何思考过程、任务说明或前后置废话。";
      let userPrompt = `作品：《${work.title}》(${work.tag || "网文"})\n${charInfo}`;

      if (fullContext) {
        userPrompt += `【上下文背景参考】：\n${fullContext.slice(0, 800)}\n\n`;
      }

      userPrompt += `【作者划选的原始文本片段】：\n${selectedText}\n\n`;

      switch (actionType) {
        case "polish":
          systemPrompt += "你的任务是对划选片段进行普通润色，优化病句、不自然表达与节奏，保持原剧情事实与信息密度不变。直接输出替换后的纯正文片段。";
          userPrompt += "任务要求：请对上述划选片段进行精炼通顺的润色优化。";
          break;
        case "expand":
          systemPrompt += "你的任务是对划选片段进行细节扩写，丰富环境细节、心理暗流、微表情与动作连贯度，严禁擅自引入新事件或新设定。直接输出扩写后的完整片段。";
          userPrompt += "任务要求：丰富画面细节与心理动作，进行深度扩写。";
          break;
        case "shorten":
          systemPrompt += "你的任务是对划选片段进行去水精简，删减冗余虚词与重复修饰，只删不增，使剧情推进更加凌厉紧凑。直接输出精炼后的片段。";
          userPrompt += "任务要求：请精炼浓缩上述文本，加快叙事节奏。";
          break;
        case "enrich_desc":
          systemPrompt += "你的任务是强化感官描写（视觉色彩、声响、光影质感与环境氛围），使读者身临其境。直接输出描写强化后的片段。";
          userPrompt += "任务要求：强化环境氛围与感官细节描写。";
          break;
        case "dialogue":
          systemPrompt += "你的任务是强化角色的对话台词，使其更具性格辨识度与潜台词，结合情境压力微调，严守人设防 OOC。直接输出强化后的片段。";
          userPrompt += "任务要求：让人物对话更生动、更具潜台词与个性。";
          break;
        case "custom":
        default:
          systemPrompt += "请严格遵循作者给出的具体修改指令，对划选文本进行重写或修饰。直接输出处理后的正文文本。";
          userPrompt += `作者特定修改要求：${customInstruction || "请根据上下文合理优化该段文字"}`;
          break;
      }

      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const processedText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.70,
        maxTokens: 4096,
      });

      const cleanedText = cleanNovelStoryText(processedText);

      if (!cleanedText || !cleanedText.trim()) {
        return NextResponse.json(
          { success: false, message: "AI 片段处理失败，未能获取到生成文本" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        result: {
          processedText: cleanedText.trim(),
          originalText: selectedText,
          actionType,
        },
        message: "AI 片段处理成功！",
      });
    }

    return NextResponse.json(
      { success: false, message: "未知的 AI 模式" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Chapter AI error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "AI 章节服务异常" },
      { status: 500 }
    );
  }
});
