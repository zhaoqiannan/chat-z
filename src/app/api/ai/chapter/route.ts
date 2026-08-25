import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage } from "@/utils/ai";

/**
 * AI 章节初稿生成与正文润色优化接口 (基于 Cloudflare Workers AI)
 */
export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      chapterId,
      mode, // 'draft' (生成初稿) | 'optimize' (润色优化)
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
不要输出任何前缀废话，直接输出正文内容。`,
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

请立即开始创作该章节正文：`,
        },
      ];

      const draftText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.8,
        maxTokens: 3500,
      });

      if (!draftText || !draftText.trim()) {
        return NextResponse.json(
          { success: false, message: "AI 初稿创作失败，未能获取到生成文本" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        result: {
          draftText: draftText.trim(),
          wordCount: draftText.trim().replace(/\s+/g, "").length,
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
请直接输出润色后的正文全文，并在文末另起一行附带一段【AI 优化批注】说明优化的核心要点。`,
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

      const optimizedText = await callCloudflareAi(env.AI, messages, {
        temperature: 0.7,
        maxTokens: 3500,
      });

      if (!optimizedText || !optimizedText.trim()) {
        return NextResponse.json(
          { success: false, message: "AI 正文润色失败，未能获取到优化内容" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        result: {
          optimizedText: optimizedText.trim(),
          wordCount: optimizedText.trim().replace(/\s+/g, "").length,
        },
        message: "AI 润色优化完成！",
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
