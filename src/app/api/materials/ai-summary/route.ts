// API: AI 结合上传文件/文本与作者自定义指令提取智能摘要、设定与素材笔记
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { callCloudflareAi, ChatMessage, parseStructuredJson, cleanAnalysisText } from "@/utils/ai";

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

    const systemPrompt = `你是一位严谨的小说世界观与素材资料分析助手。
请结合素材的真实文本与作者的自定义指令进行精准提炼，仅输出合法 JSON：
{
  "aiSummary": "80~180字精炼摘要，概括素材核心信息与创作参考价值",
  "extractedLore": "针对作者指令的核心提取结果（使用分条 • 列出或清晰段落，便于直接采纳为笔记）",
  "suggestedTags": ["标签1", "标签2", "标签3"]
}
【核心准则】
1. 若提供了【素材正文/解析文本】，所有专有名词、数值与设定必须严格忠于原文，严禁编造原文不存在的数据。
2. 若仅有标题/图片名而无正文（纯文本模型无法读取图片像素），请如实基于标题与作者指令提供“创作描写参考/灵感构思”，切勿假装看到了图片中的具体画面细节。
3. 作者的【自定义提炼指令】为最高优先级。
4. 仅输出合法 JSON，严禁输出 Markdown 代码块或其他多余文字。`;

    let userMessage = `素材标题：${title || fileName || "未命名素材"}\n附件类型：${fileType}\n原始文件名：${fileName || "无"}\n来源链接：${sourceUrl || "无"}`;

    if (customPrompt) {
      userMessage += `\n\n【作者自定义提炼指令/需求】：\n${customPrompt}`;
    }

    if (content) {
      userMessage += `\n\n【素材正文/解析文本】：\n${content}`;
    } else if (fileType === "image") {
      userMessage += `\n\n【说明】：此素材为图片（${fileName || title}），当前为纯文本模型无法直接读取像素。请基于标题与作者指令，提供适配小说写作的氛围词句、描写参考与情节启发。`;
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      taskType: "structured",
      temperature: 0.3,
      maxTokens: 2000,
    });

    let parsed: any = parseStructuredJson<any>(rawResponse, null);

    if (!parsed || typeof parsed !== "object") {
      const cleaned = cleanAnalysisText(rawResponse);
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
