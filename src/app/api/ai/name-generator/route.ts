// API: 轻量 AI 起名引擎（人物/地点/势力/道具，支持前缀与严格字数约束）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { callCloudflareAi, ChatMessage, parseStructuredJson } from "@/utils/ai";

const TYPE_LABEL_MAP: Record<string, string> = {
  character: "小说角色姓名",
  location: "地点/城池/秘境名称",
  faction: "势力/宗门/组织名称",
  item: "法宝/武器/道具名称",
};

export const POST = withAuth(async (req: NextRequest, _user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const body = await req.json();

    const type = String(body.type || "character");
    const prefix = String(body.prefix || "").trim();
    const length = Math.max(1, Math.min(12, Number(body.length) || 3));
    const meaning = String(body.meaning || "").trim();
    const count = Math.max(1, Math.min(20, Number(body.count) || 10));

    const typeLabel = TYPE_LABEL_MAP[type] || TYPE_LABEL_MAP.character;

    const systemPrompt = `你是一位精通中文文学与网文命名的起名专家。
任务：根据用户给定的类型、字数、前缀与气质寓意，生成贴合语境、朗朗上口、避免俗套重复的中文名称。
输出协议：
1. 仅输出合法 JSON 对象：{"names": ["名字1", "名字2", ...]}
2. 每个名字必须严格为 ${length} 个汉字${prefix ? `，且必须以“${prefix}”开头` : ""}。
3. 严禁包含序号、标点、解释或 Markdown 代码块。`;

    const userPrompt = `命名对象：${typeLabel}
严格字数：${length} 个汉字
指定前缀：${prefix || "不限"}
风格/寓意/定位：${meaning || "自然大气、有记忆点"}
需要数量：${count} 个不重复的名字`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "fast",
      temperature: 0.85,
      maxTokens: 512,
    });

    const parsed = parseStructuredJson<{ names?: string[] }>(raw, {});
    let names: string[] = Array.isArray(parsed?.names) ? parsed.names : [];

    // 兜底：若模型以逗号/换行输出，兼容切分
    if (names.length === 0) {
      names = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .split(/[,，\n、\s]+/)
        .map((s) => s.replace(/[\d.、()（）"'[\]{}:]/g, "").trim())
        .filter(Boolean);
    }

    const filtered = Array.from(
      new Set(
        names
          .map((s) => String(s).replace(/[^\u4e00-\u9fa5]/g, "").trim())
          .filter((s) => s.length === length && (!prefix || s.startsWith(prefix)))
      )
    ).slice(0, count);

    return NextResponse.json({
      success: true,
      result: { names: filtered },
    });
  } catch (error: any) {
    console.error("[API /api/ai/name-generator] Error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "AI 起名服务异常" },
      { status: 500 }
    );
  }
});
