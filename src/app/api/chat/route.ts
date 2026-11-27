// API: 通用小说创作 AI 问答流式接口（修复 /home 页面 POST /api/chat 404 问题）
import { NextRequest, NextResponse } from "next/server";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callCloudflareAiStream, ChatMessage } from "@/utils/ai";
import { parseJsonBody } from "@/utils/ownership";

export const POST = withAuth(async (req: NextRequest, _user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const parsedBody = await parseJsonBody<{ message?: string; history?: ChatMessage[] }>(req);
    if (!parsedBody.ok) return parsedBody.response;

    const message = typeof parsedBody.data.message === "string" ? parsedBody.data.message.trim() : "";
    if (!message || message.length > 6000) {
      return NextResponse.json({ success: false, message: "请输入 1~6000 字的提问内容" }, { status: 400 });
    }

    const safeHistory: ChatMessage[] = Array.isArray(parsedBody.data.history)
      ? parsedBody.data.history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "你是 Novel Studio 的资深小说创作顾问与中文编辑。擅长世界观搭建、人物弧光设计、剧情冲突推演、文风润色与叙事节奏诊断。请用清晰、具体、可落地的中文回答作者问题，避免空洞套话。",
      },
      ...safeHistory,
      { role: "user", content: message },
    ];

    const stream = await callCloudflareAiStream(env.AI, messages, {
      taskType: "creative",
      temperature: 0.72,
      maxTokens: 3072,
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[API /api/chat] Error:", error);
    return NextResponse.json({ success: false, message: "AI 问答服务暂时繁忙，请稍后重试" }, { status: 500 });
  }
});
