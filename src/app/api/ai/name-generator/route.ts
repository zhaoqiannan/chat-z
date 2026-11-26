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
    const allowDot = /西幻|外国|欧美|西方|日系|星际|科幻|译名|魔法|帝国/.test(meaning) || /[·•A-Za-z0-9]/.test(prefix);
    const requestCount = Math.min(28, count + 6);

    const systemPrompt = `你是一位精通中文文学与小说命名的起名专家。
任务：根据用户给定的类型、字数、前缀与气质寓意，生成贴合语境、朗朗上口、避免俗套重复的候选名称。
输出协议：
1. 仅输出合法 JSON 对象：{"names": ["名字1", "名字2", ...]}
2. 每个名字的总长度必须严格为 ${length} 个字${prefix ? `（**总字数包含前缀“${prefix}”本身**，例如前缀占 ${prefix.length} 字则后面仅接 ${Math.max(0, length - prefix.length)} 字），且必须以“${prefix}”开头` : ""}。
3. 请一次性生成 ${requestCount} 个不重复候选名，严禁包含序号、标点解释或 Markdown 代码块。`;

    const userPrompt = `命名对象：${typeLabel}
严格总字数：${length} 字${prefix ? `（含前缀“${prefix}”）` : ""}
指定前缀：${prefix || "不限"}
风格/寓意/定位：${meaning || "自然大气、有记忆点"}
请直接输出 ${requestCount} 个候选名称的 JSON：`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const extractAndFilter = (rawText: string): string[] => {
      const parsed = parseStructuredJson<{ names?: string[] }>(rawText, {});
      let names: string[] = Array.isArray(parsed?.names) ? parsed.names : [];

      if (names.length === 0) {
        names = rawText
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .replace(/<think>[\s\S]*$/gi, "")
          .split(/[,，\n、\s]+/)
          .map((s) => s.replace(/[\d.、()（）"'[\]{}:]/g, "").trim())
          .filter(Boolean);
      }

      const sanitizeRegex = allowDot ? /[^\u4e00-\u9fa5A-Za-z0-9·]/g : /[^\u4e00-\u9fa5]/g;
      return Array.from(
        new Set(
          names
            .map((s) => String(s).replace(sanitizeRegex, "").trim())
            .filter((s) => s.length === length && (!prefix || s.startsWith(prefix)))
        )
      ).slice(0, count);
    };

    const raw = await callCloudflareAi(env.AI, messages, {
      taskType: "fast",
      temperature: 0.85,
      maxTokens: 1536,
    });

    let filtered = extractAndFilter(raw);

    // 若首次因模型截断或字数偏差未产出有效名字，切换 structured 通道重试一次
    if (filtered.length === 0) {
      try {
        const retryRaw = await callCloudflareAi(env.AI, messages, {
          taskType: "structured",
          temperature: 0.75,
          maxTokens: 1536,
        });
        filtered = extractAndFilter(retryRaw);
      } catch (retryErr) {
        console.warn("[name-generator] 备选通道重试失败:", retryErr);
      }
    }

    if (filtered.length === 0) {
      return NextResponse.json(
        { success: false, message: "AI 未能生成符合字数与前缀条件的名称，请重试或调整条件" },
        { status: 500 }
      );
    }

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
