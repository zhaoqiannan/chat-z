// API: 剧情推演核心大模型（基于起点与终点，结合世界规则与人物设定推演多套转折路径）
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withAuth, CurrentUser } from "@/utils/serverAuth";
import { getDb, works, characters, worldRules, materials, outlines } from "@/db";
import { eq, and } from "drizzle-orm";
import { callCloudflareAi, ChatMessage, cleanNovelStoryText } from "@/utils/ai";

export const POST = withAuth(async (req: NextRequest, user: CurrentUser) => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    const body = await req.json();
    const {
      workId: rawWorkId,
      startPoint,
      targetPoint,
      involvedCharacters,
      pacePreference = "standard",
      stepCount = 3,
    } = body;

    const workId = Number(rawWorkId);
    if (!workId || isNaN(workId)) {
      return NextResponse.json({ success: false, message: "缺少作品ID" }, { status: 400 });
    }

    if (!startPoint?.trim() || !targetPoint?.trim()) {
      return NextResponse.json({ success: false, message: "起点剧情与目标终点剧情均不能为空" }, { status: 400 });
    }

    const work = await db.select().from(works).where(and(eq(works.id, workId), eq(works.userId, user.userId))).get();
    if (!work) {
      return NextResponse.json({ success: false, message: "作品不存在或无权限访问" }, { status: 403 });
    }

    const [charsList, rulesList, materialsList] = await Promise.all([
      db.select().from(characters).where(eq(characters.workId, workId)).all(),
      db.select().from(worldRules).where(eq(worldRules.workId, workId)).all(),
      db.select().from(materials).where(and(eq(materials.workId, workId), eq(materials.includeInAiContext, 1))).all(),
    ]);

    const charContext = charsList.length > 0
      ? charsList.slice(0, 6).map((c) => `【${c.name}】(${c.roleType || "重要角色"}): ${c.identity || ""} ${c.personality || ""} 功法能力: ${c.abilities || "普通"} 成长弧线: ${c.characterArc || "未设定"}`).join("\n")
      : "暂无特定人物库，按通用主角与反派推演";

    const ruleContext = rulesList.length > 0
      ? rulesList.slice(0, 4).map((r) => `【${r.name}】(${r.category}): ${r.mechanisms || r.description || ""}`).join("\n")
      : "遵循常规小说逻辑机制";

    const materialContext = materialsList.length > 0
      ? materialsList.slice(0, 3).map((m) => `【${m.title}】: ${m.aiSummary || m.extractedLore || ""}`).join("\n")
      : "";

    const systemPrompt = `你是一位顶级网文小说主编与情节推演架构师。
你的任务是：根据作者给出的【起点剧情】和【目标终点剧情】，运用该作品的世界观规则、战力体系与角色人设，推演出 3 套风格各异、戏剧冲突强烈、转折自然自洽的【过渡演进路线】。

小说基本信息：
- 书名：《${work.title}》
- 题材/标签：${work.tag || "综合小说"}
- 核心简介/主线：${work.description || "无"}

世界观与硬核机制约束：
${ruleContext}
${materialContext}

核心角色库参考：
${charContext}

请严格推演出 3 条不同的演进路线：
1. 【稳健因果流】：依靠逻辑推演、资源置换、信息差与稳扎稳打化解冲突，因果链极其严密；
2. 【惊天反转流】：利用隐藏伏笔、第三方势力介入、敌友身份误导或冷门机制打出意想不到的大逆转；
3. 【极限突破流】：主角面临绝境极限施压，付出沉重代价（重伤/法宝崩坏/牺牲）后战力或心境蜕变破局。

每条路线必须包含刚好 ${stepCount} 个具体的递进步骤情节点。
请严格输出为以下 JSON 格式：
{
  "paths": [
    {
      "id": 1,
      "title": "路线名称（如：稳扎稳打·暗度陈仓流）",
      "style": "稳健因果",
      "summary": "一句话核心转折逻辑概述",
      "steps": [
        {
          "stepIndex": 1,
          "title": "情节点标题（如：隐姓埋名入荒谷）",
          "content": "具体情节经过、发生何事、角色具体行动与矛盾碰撞",
          "keyConflict": "本步的核心阻碍与矛盾",
          "characterAction": "关键角色的选择与动作"
        }
      ]
    }
  ]
}
注意：只返回纯 JSON 格式文本，不要附加任何 Markdown 标记或多余解说。`;

    const userMessage = `【起点剧情点】：${startPoint.trim()}
【目标终点剧情】：${targetPoint.trim()}
【指定参演角色】：${involvedCharacters?.trim() || "根据剧情自然安排"}
【推演偏好风格】：${pacePreference}
【建议过渡步数】：${stepCount} 步`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const rawResponse = await callCloudflareAi(env.AI, messages, {
      temperature: 0.7,
      maxTokens: 2500,
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

    if (!parsed || !Array.isArray(parsed.paths) || parsed.paths.length === 0) {
      parsed = {
        paths: [
          {
            id: 1,
            title: "稳健因果推进流",
            style: "稳健因果",
            summary: "从起点通过信息差与暗中筹备稳步过渡到终点",
            steps: [
              {
                stepIndex: 1,
                title: "积蓄力量与寻找破局点",
                content: `主角在【${startPoint}】后暂避锋芒，利用周围资源探索破局线索。`,
                keyConflict: "外部压力与资源匮乏",
                characterAction: "保持克制，暗中布局",
              },
              {
                stepIndex: 2,
                title: "制造契机与借力打力",
                content: "通过第三方势力或关键机缘介入，改变原有实力对比，扭转局势。",
                keyConflict: "博弈风险与信任危机",
                characterAction: "果断出击，化被动为主动",
              },
              {
                stepIndex: 3,
                title: "达成终局目标",
                content: `所有前置铺垫彻底收束，顺理成章达成【${targetPoint}】。`,
                keyConflict: "终极决断",
                characterAction: "顺势而上，锁定胜局",
              },
            ],
          },
        ],
      };
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      message: "剧情推演生成成功",
    });
  } catch (error: any) {
    console.error("Plot deduction AI error:", error);
    return NextResponse.json({ success: false, message: error?.message || "剧情推演失败" }, { status: 500 });
  }
});
