// API: AI 结合上传文件/文本与作者自定义指令提取智能摘要、设定与素材笔记
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      return NextResponse.json({ success: false, message: "无效的请求 JSON 数据" }, { status: 400 });
    }

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim().slice(0, 3000); // 安全截断防止超长
    const fileName = String(body.fileName || "").trim();
    const fileType = String(body.fileType || "document").trim();
    const customPrompt = String(body.customPrompt || "").trim();
    const sourceUrl = String(body.sourceUrl || "").trim();

    if (!title && !content && !fileName && !customPrompt) {
      return NextResponse.json({ success: false, message: "请提供素材标题、文件信息或自定义提炼指令" }, { status: 400 });
    }

    // 如果上传的是图片且没有提供有效文本或自定义指令，给予友好提示
    if (fileType === "image" && !content && !customPrompt && !title) {
      return NextResponse.json({
        success: true,
        result: {
          aiSummary: `【图片素材】${fileName || "参考图片"} 已成功上传。`,
          extractedLore: `提示：当前系统接入的 Cloudflare Workers AI 为纯文本大模型，暂不支持直接对图片像素进行视觉识别。建议在上方「自定义指令」中输入您期望描绘的场景或角色细节，AI 将为您生成专属小说描写。`,
          suggestedTags: ["图片素材", "视觉参考"],
        },
      });
    }

    const systemPrompt = `你是一位专业的小说世界观与素材资料分析助手。
作者正在为小说创作整理和提炼素材。作者提供了素材基础信息，并可能输入了特定的分析指令。
请结合素材的基础信息、文本内容与作者的指令，进行针对性提炼，输出纯 JSON 格式：
{
  "aiSummary": "100~200字精炼的摘要，说明该素材的核心内容与对小说的参考价值",
  "extractedLore": "核心提取结果/回答（根据作者指令或素材核心提炼，使用分条●列出或连贯段落输出，方便作者直接采纳为创作笔记）",
  "suggestedTags": ["标签1", "标签2", "标签3"]
}
注意：
1. 若作者提供了【自定义指令/需求】，请务必以作者指令为最高优先级，精准提取或生成作者关心的内容。
2. 请严格只返回有效的 JSON 文本，不要附加任何 Markdown 代码块标签或其他无关寒暄。`;

    let userMessage = `素材标题：${title || fileName || "未命名素材"}\n附件类型：${fileType}\n原始文件名：${fileName || "无"}\n来源链接：${sourceUrl || "无"}`;

    if (customPrompt) {
      userMessage += `\n\n【作者自定义提炼指令/需求】：\n${customPrompt}`;
    }

    if (content) {
      userMessage += `\n\n【素材正文/解析文本】：\n${content}`;
    } else if (fileType === "image") {
      userMessage += `\n\n【说明】：这是一张小说创作参考图片（${fileName || title}）。请结合标题与作者指令构思并提供适合小说的氛围、细节描写与情节启发。`;
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.3,
      maxTokens: 2000,
    });

    const cleaned = cleanNovelStoryText(rawResponse);
    let parsed: any = null;

    try {
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (__) {}
      }
    }

    if (!parsed) {
      parsed = {
        aiSummary: cleaned.slice(0, 200),
        extractedLore: cleaned,
        suggestedTags: ["素材参考", "小说设定"],
      };
    }

    return NextResponse.json({
      success: true,
      result: {
        aiSummary: parsed.aiSummary || "",
        extractedLore: parsed.extractedLore || "",
        suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
      },
    });
  } catch (error: any) {
    console.error("AI Material summary error:", error);
    return NextResponse.json({
      success: false,
      message: `AI 提炼异常: ${error?.message || "网络请求失败"}。当前接入为纯文本模型，建议输入具体文本指令后重试。`,
    }, { status: 500 });
  }
});
