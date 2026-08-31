import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, chapterAiHistory } from "@/db";
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

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `你是一位专业文学编辑与网文润色大师。
你的任务是在严格保留作者原剧情、原人物设定的基础上，对原文进行全方位的文字润色、动词强化、画面感渲染和节奏张力提升。
请直接输出润色后的正文全文。`,
        },
        {
          role: "user",
          content: `小说：《${work.title}》(${work.tag || "网文"})
作者指定的润色优化目标：${optimizeGoal || "增强画面感、强化动词细节、提升打斗与情绪张力"}

【作者原始正文如下】：
${original}

请开始润色：`,
        },
      ];

      const rawOptimizedText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.7,
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

      let systemPrompt = "你是一位殿堂级网文文学顾问与金牌剧情架构师。请针对作者在正文中划选的片段进行精准的文字处理。";
      let userPrompt = `作品：《${work.title}》(${work.tag || "网文"})\n`;

      if (fullContext) {
        userPrompt += `【上下文背景参考】：\n${fullContext.slice(0, 800)}\n\n`;
      }

      userPrompt += `【作者划选的原始文本片段】：\n${selectedText}\n\n`;

      switch (actionType) {
        case "polish":
          systemPrompt += "你的任务是对划选片段进行高质量文笔润色，提升辞藻表现力、节奏感与文学张力，保留原意与角色关系。严禁输出多余闲聊，直接输出替换后的正文片段。";
          userPrompt += "任务要求：请对上述划选片段进行专业级润色升华。";
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
          systemPrompt += "你的任务是强化角色的对话台词，使其更具性格辨识度、潜台词与针锋相对的戏剧张力。直接输出强化后的片段。";
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
        temperature: 0.7,
        maxTokens: 4096,
      });

      if (!processedText || !processedText.trim()) {
        return NextResponse.json(
          { success: false, message: "AI 片段处理失败，未能获取到生成文本" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        result: {
          processedText: processedText.trim(),
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
