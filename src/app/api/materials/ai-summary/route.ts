// API: AI 自动提取素材智能摘要、硬核设定点与标签推荐
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const body = await req.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const sourceUrl = String(body.sourceUrl || "").trim();

    if (!title && !content) {
      return NextResponse.json({ success: false, message: "标题或内容不能为空" }, { status: 400 });
    }

    const systemPrompt = `你是一位专业的小说世界观与硬核资料分析助手。
请对用户提供的资料/素材进行深度解析，输出结构化的 JSON，格式如下：
{
  "aiSummary": "100~200字精炼的AI智能摘要，重点阐明该素材的核心机制与对小说设定的参考价值",
  "extractedLore": "提取的硬核设定点（使用符号●分条列出，如：● 蓝移碰撞路线...）",
  "suggestedTags": ["标签1", "标签2", "标签3"]
}
请严格只返回有效的 JSON 文本，不要附加任何 Markdown 代码块标签或其他解释。`;

    const userMessage = `素材标题：${title}\n来源链接：${sourceUrl || "无"}\n详细内容：\n${content.slice(0, 3000)}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.3,
      maxTokens: 1500,
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
        extractedLore: "● 核心设定点提炼自该素材内容",
        suggestedTags: ["参考资料", "设定"],
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
    return NextResponse.json({ success: false, message: error?.message || "AI 提取摘要失败" }, { status: 500 });
  }
});
