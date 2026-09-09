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
          content: `你是一位殿堂级网文白金作家。擅长把握读者情绪、环境渲染、人物动作神态与高潮爽点爆发。
请根据作者提供的设定与剧情要求，撰写出画面感极强、节奏紧凑、对话生动的正文章节。
【极其重要指令】：严禁输出任何思考过程、构思草稿或字数分析，直接从第一句正文开始输出！`,
        },
        {
          role: "user",
          content: `作品书名：《${work.title}》
题材标签：${work.tag || "网络小说"}
本章大致内容：${overview || "推进核心主线"}
核心事件安排：${events || "发生正面冲突与破局"}
剧情走向与高潮：${plotDirection || "主角绝境反击，震慑全场"}
登场人物与性格：${characters || "主角（沉着果决）"}
文风选择：${writingStyle || "网文快节奏爽文风"}
目标字数要求：约 ${targetWords || 2000} 字

请直接开始输出该章节正文故事：`,
        },
      ];

      const rawDraftText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.8,
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
          content: `你是一位殿堂级网文白金主编与金牌修文导师。
你的核心职责是对作者提交的原文章节进行【白金级深度文学润色与文笔重塑】。

【四大核心准则（严禁机械复读，严禁角色 OOC）】：
1. 【拒绝机械复读，实质升级文笔】：润色不是原样抄写！必须深入重构平铺直叙、干瘪寡淡的陈述，运用生动的动作细节、心理博弈与感官压迫感替代平淡流水账，大幅提升阅读快感与网文张力。
2. 【人物人设严格锁定（防 OOC）】：严格依照角色档案库中的性格基调与说话风格润色。冷酷者言简意赅如刀锋，狂傲者锋芒毕露，智谋者机锋暗藏。严禁千人一面，严禁任何角色说出出戏的现代流行语或软弱崩人设的台词！
3. 【四维具象化呈现】：
   - 动作具象化：用精准有力的动词替换抽象表达（如将“他很生气地出招”重构为“指节骤然捏白，剑锋撕裂空气带起刺耳尖啸”）；
   - 环境与情绪共鸣：光影、声效、空气粘稠度等感官沉浸；
   - 节奏把控：短句营造战斗/对峙紧迫感，长句渲染大场面厚重感，消除“只见”、“突然”、“紧接着”等平庸口头禅。
4. 【剧情骨架忠实】：100%保留核心情节走向、因果链条与关键事件，通篇完整输出所有润色后的段落，严禁中途截断、省略或打省略号。
5. 【纯正文直出】：第一字即为正文首字，尾字即为正文尾字！严禁输出任何思考过程、任务分析、修改说明或“【润色后正文】”等标记！`,
        },
        {
          role: "user",
          content: `作品：《${work.title}》（题材：${work.tag || "网络小说"}）
${loreContext ? `${loreContext}\n` : ""}润色优化目标：${optimizeGoal || "在保持原剧情脉络与角色人设的前提下，深度重塑干瘪语句，强化动词画面感、对话交锋与情绪张力，拒绝机械复读"}

【作者原始正文如下】：
${original}

【输出指令】：请严格依照上述准则逐段进行白金级深度文学润色，确保语言流畅洗练、角色鲜明生动。直接输出润色后的纯正文全文：`,
        },
      ];

      const rawOptimizedText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.70,
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
            promptSummary: optimizeGoal || "全文画面感与情绪张力润色",
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

      let systemPrompt = "你是一位殿堂级网文文学顾问与金牌修文导师。请针对作者在正文中划选的片段进行精准的文字升级与重塑。【铁律】：坚决避免机械复读！严格锚定角色性格防 OOC！只输出处理后的纯正文片段，绝对禁止输出任何思考过程、任务说明或前后置废话。";
      let userPrompt = `作品：《${work.title}》(${work.tag || "网文"})\n${charInfo}`;

      if (fullContext) {
        userPrompt += `【上下文背景参考】：\n${fullContext.slice(0, 800)}\n\n`;
      }

      userPrompt += `【作者划选的原始文本片段】：\n${selectedText}\n\n`;

      switch (actionType) {
        case "polish":
          systemPrompt += "你的任务是对划选片段进行高质量文笔重塑，用具象动作、感官沉浸与心理张力替代干瘪陈述，严禁机械复读原词。直接输出替换后的纯正文片段。";
          userPrompt += "任务要求：请对上述划选片段进行深度文学润色升华。";
          break;
        case "expand":
          systemPrompt += "你的任务是对划选片段进行细节扩写，丰富环境细节、心理活动、微表情与动作连贯度，增强代入感与画面感。直接输出扩写后的完整片段。";
          userPrompt += "任务要求：请丰富画面细节与心理动作，进行深度扩写。";
          break;
        case "shorten":
          systemPrompt += "你的任务是对划选片段进行去水精简，删减冗余虚词与重复修饰，使剧情推进更加凌厉紧凑。直接输出精炼后的片段。";
          userPrompt += "任务要求：请精炼浓缩上述文本，加快叙事节奏。";
          break;
        case "enrich_desc":
          systemPrompt += "你的任务是强化感官描写（视觉色彩、声响、光影质感与气味沉浸），使读者身临其境。直接输出描写强化后的片段。";
          userPrompt += "任务要求：强化环境氛围与感官细节描写。";
          break;
        case "dialogue":
          systemPrompt += "你的任务是强化角色的对话台词，使其更具性格辨识度、潜台词与针锋相对的戏剧张力，严守人设防 OOC。直接输出强化后的片段。";
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
